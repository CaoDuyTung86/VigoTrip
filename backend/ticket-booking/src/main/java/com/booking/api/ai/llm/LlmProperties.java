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
        /**
         * Thời gian tạm loại cho lần mở mạch ĐẦU TIÊN, tính bằng giây. Hết hạn thì
         * chuyển sang HALF_OPEN. Mỗi vòng mở mạch liên tiếp sau đó nhân đôi thời gian
         * này, tới trần maxOpenSeconds.
         */
        private long openSeconds = 60;
        /**
         * Trần thời gian tạm loại sau khi đã nhân đôi nhiều vòng.
         *
         * Nhà cung cấp chết 2 tiếng thì với 60 giây cố định ta ném 120 request thăm dò
         * vô ích vào nó; nhân đôi dần thì chỉ còn khoảng 10. Đặt trần để một nhà đã hồi
         * phục không phải chờ hàng giờ mới được thử lại — 15 phút là đủ thưa mà vẫn kịp
         * nhận ra nhà chính sống lại.
         */
        private long maxOpenSeconds = 900;
        /**
         * Hạn chót cho một request thăm dò ở trạng thái HALF_OPEN.
         *
         * Không phải timeout của lời gọi HTTP (cái đó do llm.timeouts lo) mà là chốt
         * chặn chống kẹt: nếu action ném ra một lỗi KHÔNG phải LlmProviderException
         * thì LlmRouter không bắt, breaker không bao giờ nhận được kết quả thăm dò, và
         * nếu thiếu hạn chót này thì nhà cung cấp đó bị bỏ qua vĩnh viễn. Phải dài hơn
         * trường hợp chậm nhất có thật: stream 120s.
         */
        private long probeTimeoutSeconds = 180;
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
