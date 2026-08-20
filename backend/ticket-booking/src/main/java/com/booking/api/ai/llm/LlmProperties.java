package com.booking.api.ai.llm;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Cấu hình tầng LLM. Trước đây tên model, URL và giới hạn token là hằng số
 * `private static final` trong AIService — đổi model là phải sửa code rồi deploy lại.
 */
@Component
@ConfigurationProperties(prefix = "llm")
@Data
public class LlmProperties {

    private Tasks tasks = new Tasks();
    private CircuitBreaker circuitBreaker = new CircuitBreaker();
    private Retry retry = new Retry();
    private History history = new History();

    @Data
    public static class History {
        /** Số cặp hỏi-đáp gần nhất thực sự gửi lên model. */
        private int maxPairs = 3;
        /** Cắt bớt mỗi tin nhắn trong lịch sử về ngần này ký tự để tiết kiệm token. */
        private int maxContentLength = 200;
    }

    @Data
    public static class Tasks {
        /** Chuỗi nhà cung cấp cho chatbot, thử theo đúng thứ tự khai báo. */
        private List<Provider> chat = new ArrayList<>();
        /** Chuỗi nhà cung cấp cho phân tích BI. */
        private List<Provider> analysis = new ArrayList<>();
    }

    @Data
    public static class Provider {
        /** Tên hiển thị trong log và nhãn metric, ví dụ "gemini", "groq". */
        private String name;
        /** Base URL tương thích OpenAI, KHÔNG kèm /chat/completions. */
        private String baseUrl;
        /** Bỏ trống = nhà cung cấp này bị loại lúc khởi động. */
        private String apiKey;
        private String model;
        private int maxTokens = 800;
        private double temperature = 0.7;

        public boolean isConfigured() {
            return apiKey != null && !apiKey.isBlank()
                    && !"YOUR_API_KEY_HERE".equals(apiKey)
                    && baseUrl != null && !baseUrl.isBlank()
                    && model != null && !model.isBlank();
        }
    }

    @Data
    public static class CircuitBreaker {
        /** Số lần lỗi liên tiếp trước khi tạm loại nhà cung cấp. */
        private int failureThreshold = 3;
        /** Thời gian tạm loại, tính bằng giây. */
        private long openSeconds = 60;
    }

    @Data
    public static class Retry {
        /**
         * Số lần thử trên MỖI nhà cung cấp. Để thấp có chủ ý: khi đã có nhà cung cấp
         * dự phòng thì chuyển sang nhà khác nhanh hơn nhiều so với ngồi retry một
         * endpoint đang quá tải.
         */
        private int maxAttempts = 2;
        private long backoffMs = 1000;
    }
}
