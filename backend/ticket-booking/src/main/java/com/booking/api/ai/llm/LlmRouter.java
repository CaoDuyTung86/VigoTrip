package com.booking.api.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Điều phối lời gọi LLM qua một chuỗi nhà cung cấp có thứ tự, tự động chuyển sang
 * nhà kế tiếp khi nhà hiện tại hỏng.
 *
 * Trước đây chỉ có một nhà cung cấp duy nhất và cách xử lý 503 là sửa hằng số trong
 * code Java rồi deploy lại (xem lịch sử comment trong AIService).
 *
 * LƯU Ý QUAN TRỌNG: {@link #execute} chạy LẠI TOÀN BỘ action trên nhà cung cấp kế
 * tiếp. Action vì thế phải idempotent. Hiện các tool đều là truy vấn CHỈ ĐỌC
 * (search_trips, get_user_bookings, get_booking_by_id) nên chạy lại vô hại — nếu sau
 * này thêm tool có ghi dữ liệu thì phải xem lại chỗ này.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LlmRouter {

    private final LlmProperties properties;
    private final ProviderCircuitBreaker circuitBreaker;
    private final MeterRegistry meterRegistry;
    private final RestTemplate aiRestTemplate;
    private final HttpClient aiHttpClient;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<LlmTask, List<LlmProvider>> providersByTask = new EnumMap<>(LlmTask.class);

    @PostConstruct
    void buildProviders() {
        providersByTask.put(LlmTask.CHAT, build(properties.getTasks().getChat(), "chat"));
        providersByTask.put(LlmTask.ANALYSIS, build(properties.getTasks().getAnalysis(), "analysis"));
    }

    private List<LlmProvider> build(List<LlmProperties.Provider> configs, String taskLabel) {
        List<LlmProvider> result = new ArrayList<>();
        for (LlmProperties.Provider cfg : configs) {
            if (!cfg.isConfigured()) {
                log.info("[LlmRouter] Bỏ qua nhà cung cấp '{}' cho task '{}' — thiếu apiKey/baseUrl/model.",
                        cfg.getName(), taskLabel);
                continue;
            }
            result.add(new OpenAiCompatibleProvider(cfg, aiRestTemplate, aiHttpClient, objectMapper));
            log.info("[LlmRouter] Task '{}' <- nhà cung cấp '{}' (model {}).",
                    taskLabel, cfg.getName(), cfg.getModel());
        }
        if (result.isEmpty()) {
            log.warn("[LlmRouter] Task '{}' KHÔNG có nhà cung cấp nào khả dụng — tính năng AI liên quan sẽ báo lỗi.",
                    taskLabel);
        }
        return Collections.unmodifiableList(result);
    }

    /** Danh sách nhà cung cấp đã cấu hình cho một task, theo thứ tự ưu tiên. */
    public List<LlmProvider> providersFor(LlmTask task) {
        return providersByTask.getOrDefault(task, List.of());
    }

    public boolean hasProvider(LlmTask task) {
        return !providersFor(task).isEmpty();
    }

    /**
     * Chạy action trên nhà cung cấp khả dụng đầu tiên, chuyển sang nhà kế tiếp nếu lỗi
     * thuộc loại retryable.
     *
     * @throws LlmUnavailableException khi mọi nhà cung cấp đều hỏng hoặc chưa cấu hình
     */
    public <T> T execute(LlmTask task, Function<LlmProvider, T> action) {
        List<LlmProvider> providers = providersFor(task);
        if (providers.isEmpty()) {
            throw new LlmUnavailableException("Chưa cấu hình nhà cung cấp AI nào cho tác vụ " + task);
        }

        LlmProviderException lastError = null;
        String previousProvider = null;
        boolean allCircuitsOpen = true;

        for (LlmProvider provider : providers) {
            if (circuitBreaker.isOpen(provider.name())) {
                log.debug("[LlmRouter] Bỏ qua {} — mạch đang mở.", provider.name());
                continue;
            }
            allCircuitsOpen = false;

            if (previousProvider != null) {
                Counter.builder("llm_fallback_total")
                        .tag("from", previousProvider)
                        .tag("to", provider.name())
                        .description("Số lần chuyển sang nhà cung cấp LLM dự phòng")
                        .register(meterRegistry)
                        .increment();
                log.warn("[LlmRouter] Chuyển từ {} sang {}.", previousProvider, provider.name());
            }

            try {
                T result = attemptWithRetries(task, provider, action);
                circuitBreaker.recordSuccess(provider.name());
                return result;
            } catch (LlmProviderException e) {
                // Chuyển nhà cung cấp với MỌI loại lỗi, kể cả 4xx. Không thể suy ra
                // "request của ta sai" chỉ từ mã trạng thái: Gemini trả 400 khi API key
                // hỏng, và tên model, hạn mức, xác thực đều là chuyện riêng từng nhà.
                // Một lời gọi lãng phí cho request thực sự dị dạng rẻ hơn nhiều so với
                // việc để cả chatbot chết trong khi vẫn còn nhà cung cấp khỏe mạnh.
                lastError = e;
                circuitBreaker.recordFailure(provider.name());
                log.warn("[LlmRouter] {} thất bại ({}), thử nhà cung cấp tiếp theo.",
                        provider.name(), e.getMessage());
                previousProvider = provider.name();
            }
        }

        String reason = allCircuitsOpen
                ? "mọi nhà cung cấp AI đều đang bị tạm loại do lỗi liên tiếp"
                : "mọi nhà cung cấp AI đều thất bại";
        throw new LlmUnavailableException(reason, lastError);
    }

    private <T> T attemptWithRetries(LlmTask task, LlmProvider provider, Function<LlmProvider, T> action) {
        int maxAttempts = Math.max(1, properties.getRetry().getMaxAttempts());
        LlmProviderException last = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            Timer.Sample sample = Timer.start(meterRegistry);
            try {
                T result = action.apply(provider);
                stop(sample, task, provider, "success");
                countRequest(task, provider, "success");
                return result;
            } catch (LlmProviderException e) {
                stop(sample, task, provider, "error");
                countRequest(task, provider, e.getStatusCode() != null ? "http_" + e.getStatusCode() : "error");
                last = e;
                if (!e.isRetryable() || attempt == maxAttempts) {
                    throw e;
                }
                log.warn("[LlmRouter] {} lỗi ({}), thử lại {}/{}.",
                        provider.name(), e.getMessage(), attempt, maxAttempts);
                sleepBackoff(attempt);
            }
        }
        throw last;
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep(properties.getRetry().getBackoffMs() * attempt);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new LlmUnavailableException("Bị ngắt khi đang chờ thử lại", ie);
        }
    }

    private void stop(Timer.Sample sample, LlmTask task, LlmProvider provider, String outcome) {
        sample.stop(Timer.builder("llm_latency_seconds")
                .tag("task", task.name().toLowerCase())
                .tag("provider", provider.name())
                .tag("model", provider.model())
                .tag("outcome", outcome)
                .description("Độ trễ lời gọi LLM")
                .register(meterRegistry));
    }

    private void countRequest(LlmTask task, LlmProvider provider, String outcome) {
        Counter.builder("llm_requests_total")
                .tag("task", task.name().toLowerCase())
                .tag("provider", provider.name())
                .tag("model", provider.model())
                .tag("outcome", outcome)
                .description("Tổng số lời gọi LLM")
                .register(meterRegistry)
                .increment();
    }
}
