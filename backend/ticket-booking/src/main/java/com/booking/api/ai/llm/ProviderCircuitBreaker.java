package com.booking.api.ai.llm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Circuit breaker đơn giản theo từng nhà cung cấp.
 *
 * Khi một nhà cung cấp lỗi liên tiếp N lần, tạm loại nó khỏi vòng chọn trong T giây.
 * Không có trạng thái half-open có chủ ý: sau khi hết hạn mở mạch, lần gọi kế tiếp
 * chính là phép thử — với 2-3 nhà cung cấp thì thêm máy trạng thái đầy đủ chỉ làm
 * phức tạp mà không đổi được hành vi thực tế.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProviderCircuitBreaker {

    private final LlmProperties properties;

    private final Map<String, AtomicInteger> consecutiveFailures = new ConcurrentHashMap<>();
    private final Map<String, Instant> openUntil = new ConcurrentHashMap<>();

    /** true nếu nhà cung cấp đang bị tạm loại. */
    public boolean isOpen(String providerName) {
        Instant until = openUntil.get(providerName);
        if (until == null) {
            return false;
        }
        if (Instant.now().isAfter(until)) {
            openUntil.remove(providerName);
            consecutiveFailures.remove(providerName);
            log.info("[LlmCircuit] {} hết thời gian tạm loại, đưa trở lại vòng chọn.", providerName);
            return false;
        }
        return true;
    }

    public void recordSuccess(String providerName) {
        consecutiveFailures.remove(providerName);
        openUntil.remove(providerName);
    }

    /** Ghi nhận lỗi. Trả về true nếu lần lỗi này làm mạch bị mở. */
    public boolean recordFailure(String providerName) {
        int failures = consecutiveFailures
                .computeIfAbsent(providerName, k -> new AtomicInteger(0))
                .incrementAndGet();

        int threshold = properties.getCircuitBreaker().getFailureThreshold();
        if (failures >= threshold) {
            long openSeconds = properties.getCircuitBreaker().getOpenSeconds();
            openUntil.put(providerName, Instant.now().plusSeconds(openSeconds));
            log.warn("[LlmCircuit] {} lỗi {} lần liên tiếp — tạm loại {} giây.",
                    providerName, failures, openSeconds);
            return true;
        }
        return false;
    }

    /** Dùng cho test và cho endpoint chẩn đoán. */
    public void reset() {
        consecutiveFailures.clear();
        openUntil.clear();
    }
}
