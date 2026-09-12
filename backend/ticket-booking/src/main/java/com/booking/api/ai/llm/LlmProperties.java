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
    private Tools tools = new Tools();

    @Data
    public static class Tools {
        /**
         * Số lần gọi model tối đa trong MỘT lượt chat.
         *
         * Trước đây con số này bị đóng cứng ở 2: gọi model, chạy tool, gọi model lần nữa để lấy
         * câu trả lời. Hai lượt là đủ cho câu hỏi mà mọi thứ cần tra đều đã nằm sẵn trong câu
         * hỏi, nhưng không đủ cho câu hỏi mà kết quả tra lần một mới cho biết lần hai phải tra
         * gì: "vé sắp đi của tôi tới đâu, chỗ đó thời tiết thế nào" phải đọc đơn hàng xong mới
         * biết hỏi thời tiết ở nơi nào.
         *
         * Ba là mức đủ cho gần hết các chuỗi có thật trong nghiệp vụ này (tra một thứ, rồi tra
         * tiếp một thứ dựa trên kết quả đó) mà chưa biến một lượt chat thành một tràng lời gọi.
         * Lượt cuối LUÔN gọi không kèm định nghĩa tool, nên model buộc phải trả lời bằng chữ
         * thay vì xin thêm một lần tra nữa mà ta không phục vụ.
         */
        private int maxRounds = 3;

        /**
         * Tổng số lần chạy tool trong một lượt chat, cộng dồn qua mọi vòng.
         *
         * Trần vòng lặp một mình không đủ: model được phép xin nhiều tool trong CÙNG một vòng,
         * nên hai vòng vẫn có thể thành mười lăm lượt truy vấn cơ sở dữ liệu. Chạm trần thì
         * những lời gọi sau nhận về một câu báo đã hết lượt tra, chứ không phải một lỗi — model
         * đọc câu đó rồi trả lời bằng những gì đã có.
         */
        private int maxCallsPerTurn = 8;
    }

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
