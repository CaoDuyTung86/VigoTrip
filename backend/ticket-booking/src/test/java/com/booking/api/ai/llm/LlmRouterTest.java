package com.booking.api.ai.llm;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Kiểm tra logic điều phối của LlmRouter mà không chạm mạng.
 *
 * Mẹo: execute() nhận vào một action dạng lambda, nên ta truyền thẳng lambda giả lập
 * thành công/thất bại thay vì phải dựng nhà cung cấp giả — đối tượng đang kiểm tra là
 * bản thân logic failover chứ không phải tầng HTTP.
 */
class LlmRouterTest {

    private LlmProperties properties;
    private ProviderCircuitBreaker circuitBreaker;
    private MeterRegistry meterRegistry;
    private LlmRouter router;

    private static LlmProperties.Provider provider(String name, String model) {
        LlmProperties.Provider p = new LlmProperties.Provider();
        p.setName(name);
        p.setBaseUrl("https://example.invalid/v1");
        p.setApiKey("dummy-key-" + name);
        p.setModel(model);
        p.setMaxTokens(800);
        p.setTemperature(0.7);
        return p;
    }

    private static LlmProviderException retryable(String providerName) {
        return new LlmProviderException(providerName, "quá tải", true, 429, null);
    }

    private static LlmProviderException fatal(String providerName) {
        return new LlmProviderException(providerName, "api key sai", false, 401, null);
    }

    @BeforeEach
    void setUp() {
        properties = new LlmProperties();
        properties.getTasks().setChat(new ArrayList<>(List.of(
                provider("primary", "model-a"),
                provider("secondary", "model-b"))));
        properties.getRetry().setMaxAttempts(1);   // tắt retry để cô lập hành vi failover
        properties.getRetry().setBackoffMs(1);
        properties.getCircuitBreaker().setFailureThreshold(3);
        properties.getCircuitBreaker().setOpenSeconds(60);

        circuitBreaker = new ProviderCircuitBreaker(properties);
        meterRegistry = new SimpleMeterRegistry();
        router = new LlmRouter(properties, circuitBreaker, meterRegistry,
                new RestTemplate(), HttpClient.newHttpClient());
        router.buildProviders();
    }

    private double counter(String name) {
        return meterRegistry.find(name).counters().stream()
                .mapToDouble(io.micrometer.core.instrument.Counter::count)
                .sum();
    }

    @Test
    @DisplayName("Nhà cung cấp thiếu api-key bị loại khỏi vòng chọn lúc khởi động")
    void providersWithoutApiKeyAreSkipped() {
        LlmProperties props = new LlmProperties();
        LlmProperties.Provider unconfigured = provider("groq", "llama");
        unconfigured.setApiKey("");
        props.getTasks().setChat(new ArrayList<>(List.of(provider("gemini", "flash"), unconfigured)));

        LlmRouter r = new LlmRouter(props, new ProviderCircuitBreaker(props), new SimpleMeterRegistry(),
                new RestTemplate(), HttpClient.newHttpClient());
        r.buildProviders();

        assertThat(r.providersFor(LlmTask.CHAT))
                .extracting(LlmProvider::name)
                .containsExactly("gemini");
    }

    @Test
    @DisplayName("Lỗi 429 ở nhà cung cấp đầu → tự chuyển sang nhà thứ hai")
    void failsOverToSecondProviderOn429() {
        List<String> attempted = new ArrayList<>();

        String result = router.execute(LlmTask.CHAT, p -> {
            attempted.add(p.name());
            if ("primary".equals(p.name())) {
                throw retryable(p.name());
            }
            return "trả lời từ " + p.name();
        });

        assertThat(result).isEqualTo("trả lời từ secondary");
        assertThat(attempted).containsExactly("primary", "secondary");
        assertThat(counter("llm_fallback_total")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("Lỗi 4xx (ví dụ API key hỏng) VẪN phải failover sang nhà cung cấp khác")
    void failsOverOnClientErrorToo() {
        // Gemini trả HTTP 400 khi API key sai — không phải 401. Nếu coi 4xx là "lỗi
        // phía ta" và dừng lại thì một key hỏng sẽ làm sập chatbot dù Groq vẫn khỏe.
        // Xác thực, hạn mức và tên model đều là chuyện riêng của từng nhà cung cấp.
        List<String> attempted = new ArrayList<>();

        String result = router.execute(LlmTask.CHAT, p -> {
            attempted.add(p.name());
            if ("primary".equals(p.name())) {
                throw fatal(p.name());
            }
            return "trả lời từ " + p.name();
        });

        assertThat(result).isEqualTo("trả lời từ secondary");
        assertThat(attempted).containsExactly("primary", "secondary");
    }

    @Test
    @DisplayName("Lỗi 4xx KHÔNG được thử lại trên cùng một nhà cung cấp")
    void doesNotRetrySameProviderOnClientError() {
        properties.getRetry().setMaxAttempts(3);
        AtomicInteger primaryAttempts = new AtomicInteger();

        router.execute(LlmTask.CHAT, p -> {
            if ("primary".equals(p.name())) {
                primaryAttempts.incrementAndGet();
                throw fatal(p.name());
            }
            return "ok";
        });

        assertThat(primaryAttempts)
                .as("gửi lại đúng request đó cho đúng endpoint đó chỉ nhận lại đúng lỗi đó")
                .hasValue(1);
    }

    /** Ép primary lỗi đủ ngưỡng (secondary luôn trả lời được nên execute không ném). */
    private void tripPrimary() {
        for (int i = 0; i < properties.getCircuitBreaker().getFailureThreshold(); i++) {
            router.execute(LlmTask.CHAT, p -> {
                if ("primary".equals(p.name())) {
                    throw retryable(p.name());
                }
                return "ok";
            });
        }
    }

    /** Một lượt execute mà primary lỗi, secondary đỡ. */
    private void failPrimaryOnce() {
        router.execute(LlmTask.CHAT, p -> {
            if ("primary".equals(p.name())) {
                throw retryable(p.name());
            }
            return "ok";
        });
    }

    @Test
    @DisplayName("Sau đủ số lần lỗi liên tiếp, nhà cung cấp bị tạm loại khỏi vòng chọn")
    void opensCircuitAfterConsecutiveFailures() {
        int threshold = properties.getCircuitBreaker().getFailureThreshold();

        // Ép primary lỗi đủ ngưỡng (secondary luôn trả lời được nên execute không ném).
        for (int i = 0; i < threshold; i++) {
            router.execute(LlmTask.CHAT, p -> {
                if ("primary".equals(p.name())) {
                    throw retryable(p.name());
                }
                return "ok";
            });
        }
        assertThat(circuitBreaker.isOpen("primary")).isTrue();

        // Lượt sau đó primary phải bị bỏ qua hoàn toàn.
        List<String> attempted = new ArrayList<>();
        router.execute(LlmTask.CHAT, p -> {
            attempted.add(p.name());
            return "ok";
        });
        assertThat(attempted).containsExactly("secondary");
    }

    @Test
    @DisplayName("Mọi nhà cung cấp đều hỏng → ném LlmUnavailableException")
    void throwsWhenAllProvidersFail() {
        assertThatThrownBy(() -> router.execute(LlmTask.CHAT, p -> {
            throw retryable(p.name());
        }))
                .isInstanceOf(LlmUnavailableException.class)
                .hasMessageContaining("đều thất bại");
    }

    @Test
    @DisplayName("Task chưa cấu hình nhà cung cấp nào → ném ngay, không gọi action")
    void throwsWhenNoProviderConfigured() {
        AtomicInteger invocations = new AtomicInteger();

        assertThatThrownBy(() -> router.execute(LlmTask.ANALYSIS, p -> {
            invocations.incrementAndGet();
            return "không bao giờ tới đây";
        }))
                .isInstanceOf(LlmUnavailableException.class)
                .hasMessageContaining("Chưa cấu hình");

        assertThat(invocations).hasValue(0);
    }

    @Test
    @DisplayName("Retry trong cùng một nhà cung cấp trước khi chuyển nhà")
    void retriesWithinProviderBeforeFallingOver() {
        properties.getRetry().setMaxAttempts(2);
        AtomicInteger primaryAttempts = new AtomicInteger();

        String result = router.execute(LlmTask.CHAT, p -> {
            if ("primary".equals(p.name())) {
                primaryAttempts.incrementAndGet();
                throw retryable(p.name());
            }
            return "ok";
        });

        assertThat(result).isEqualTo("ok");
        assertThat(primaryAttempts)
                .as("primary phải được thử đúng max-attempts lần rồi mới chuyển nhà")
                .hasValue(2);
    }

    @Test
    @DisplayName("Ghi metric llm_requests_total cho cả lần thành công lẫn lần lỗi")
    void recordsMetricsForSuccessAndFailure() {
        router.execute(LlmTask.CHAT, p -> {
            if ("primary".equals(p.name())) {
                throw retryable(p.name());
            }
            return "ok";
        });

        assertThat(meterRegistry.find("llm_requests_total").tag("provider", "primary")
                .tag("outcome", "http_429").counter()).isNotNull();
        assertThat(meterRegistry.find("llm_requests_total").tag("provider", "secondary")
                .tag("outcome", "success").counter()).isNotNull();
        assertThat(meterRegistry.find("llm_latency_seconds").timers()).isNotEmpty();
    }

    @Test
    @DisplayName("Thành công làm reset bộ đếm lỗi liên tiếp")
    void successResetsFailureCount() {
        Map<String, Boolean> shouldFail = new java.util.HashMap<>(Map.of("primary", true));

        // 2 lần lỗi (dưới ngưỡng 3)
        for (int i = 0; i < 2; i++) {
            router.execute(LlmTask.CHAT, p -> {
                if (Boolean.TRUE.equals(shouldFail.get(p.name()))) {
                    throw retryable(p.name());
                }
                return "ok";
            });
        }
        assertThat(circuitBreaker.isOpen("primary")).isFalse();

        // primary hồi phục
        shouldFail.put("primary", false);
        router.execute(LlmTask.CHAT, p -> "ok");

        // 2 lần lỗi nữa vẫn chưa đủ ngưỡng vì bộ đếm đã reset
        shouldFail.put("primary", true);
        for (int i = 0; i < 2; i++) {
            router.execute(LlmTask.CHAT, p -> {
                if (Boolean.TRUE.equals(shouldFail.get(p.name()))) {
                    throw retryable(p.name());
                }
                return "ok";
            });
        }
        assertThat(circuitBreaker.isOpen("primary")).isFalse();
    }

    @Test
    @DisplayName("Hết thời gian mở mạch → HALF_OPEN, request kế tiếp là phép thử trên nhà chính")
    void halfOpenSendsOneProbeToPrimary() {
        properties.getCircuitBreaker().setOpenSeconds(0);   // hết hạn tức thì, khỏi phải chờ thật
        tripPrimary();
        assertThat(circuitBreaker.stateOf("primary")).isEqualTo(ProviderCircuitBreaker.State.HALF_OPEN);

        List<String> attempted = new ArrayList<>();
        router.execute(LlmTask.CHAT, p -> {
            attempted.add(p.name());
            return "ok";
        });

        assertThat(attempted).as("phép thử phải đi vào nhà chính").containsExactly("primary");
        assertThat(circuitBreaker.stateOf("primary"))
                .as("thăm dò thành công thì đóng mạch")
                .isEqualTo(ProviderCircuitBreaker.State.CLOSED);
    }

    @Test
    @DisplayName("HALF_OPEN chỉ cho đi MỘT request thăm dò, phần còn lại vẫn đi nhà dự phòng")
    void halfOpenAdmitsOnlyOneProbe() {
        properties.getCircuitBreaker().setOpenSeconds(0);
        tripPrimary();

        assertThat(circuitBreaker.tryAcquire("primary")).isTrue();
        assertThat(circuitBreaker.tryAcquire("primary"))
                .as("suất thăm dò đã có người giữ, chưa biết kết quả")
                .isFalse();

        List<String> attempted = new ArrayList<>();
        router.execute(LlmTask.CHAT, p -> {
            attempted.add(p.name());
            return "ok";
        });
        assertThat(attempted).containsExactly("secondary");
    }

    @Test
    @DisplayName("Thăm dò thất bại → mở lại mạch NGAY, không cần đủ ngưỡng lỗi lần nữa")
    void failedProbeReopensCircuitImmediately() {
        properties.getCircuitBreaker().setOpenSeconds(0);
        tripPrimary();
        assertThat(circuitBreaker.stateOf("primary")).isEqualTo(ProviderCircuitBreaker.State.HALF_OPEN);

        properties.getCircuitBreaker().setOpenSeconds(60);
        router.execute(LlmTask.CHAT, p -> {
            if ("primary".equals(p.name())) {
                throw retryable(p.name());
            }
            return "ok";
        });

        assertThat(circuitBreaker.stateOf("primary"))
                .as("một lần thăm dò hỏng là đủ, không phải %d lần",
                        properties.getCircuitBreaker().getFailureThreshold())
                .isEqualTo(ProviderCircuitBreaker.State.OPEN);
    }

    @Test
    @DisplayName("Thời gian tạm loại nhân đôi mỗi vòng mở mạch, chặn ở trần")
    void openDurationDoublesEachCycleUpToCap() {
        properties.getCircuitBreaker().setOpenSeconds(60);
        properties.getCircuitBreaker().setMaxOpenSeconds(900);

        assertThat(circuitBreaker.openSecondsForCycle(1)).isEqualTo(60);
        assertThat(circuitBreaker.openSecondsForCycle(2)).isEqualTo(120);
        assertThat(circuitBreaker.openSecondsForCycle(3)).isEqualTo(240);
        assertThat(circuitBreaker.openSecondsForCycle(4)).isEqualTo(480);
        assertThat(circuitBreaker.openSecondsForCycle(5)).as("960 > trần").isEqualTo(900);
        assertThat(circuitBreaker.openSecondsForCycle(500)).as("không tràn số").isEqualTo(900);
    }

    @Test
    @DisplayName("Thăm dò hỏng làm vòng mở mạch kế tiếp dài gấp đôi")
    void failedProbeDoublesNextOpenWindow() {
        properties.getCircuitBreaker().setOpenSeconds(0);
        tripPrimary();                                       // vòng 1: 0 giây → HALF_OPEN ngay

        properties.getCircuitBreaker().setOpenSeconds(60);
        failPrimaryOnce();                                   // thăm dò hỏng → vòng 2

        assertThat(circuitBreaker.secondsUntilRetry("primary"))
                .as("vòng 2 phải là 60 x 2, không phải 60")
                .isBetween(115L, 120L);
    }

    @Test
    @DisplayName("Một lần thành công đưa thời gian tạm loại về lại mốc đầu")
    void successResetsBackoffLadder() {
        properties.getCircuitBreaker().setOpenSeconds(0);
        tripPrimary();                                       // vòng 1 → HALF_OPEN

        router.execute(LlmTask.CHAT, p -> "ok");             // thăm dò thành công → CLOSED
        assertThat(circuitBreaker.stateOf("primary")).isEqualTo(ProviderCircuitBreaker.State.CLOSED);

        properties.getCircuitBreaker().setOpenSeconds(60);
        tripPrimary();

        assertThat(circuitBreaker.secondsUntilRetry("primary"))
                .as("bậc thang đã reset nên phải là 60, không phải 120")
                .isBetween(55L, 60L);
    }
}
