package com.booking.api.ai.embedding;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Cấu hình model embedding.
 *
 * LƯU Ý: tên model embedding của Google thay đổi khá thường xuyên. Nếu khởi động báo
 * 404 model không tồn tại, chạy `node test_gemini_models.js` ở thư mục gốc để liệt kê
 * model khả dụng với API key hiện tại rồi đặt lại RAG_EMBEDDING_MODEL cho đúng.
 */
@Component
@ConfigurationProperties(prefix = "rag.embedding")
@Data
public class EmbeddingProperties {

    /** Base URL tương thích OpenAI, KHÔNG kèm /embeddings. */
    private String baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    /** Bỏ trống = tắt embedding; hệ thống tự lùi về tìm kiếm từ khóa thuần. */
    private String apiKey = "";

    private String model = "gemini-embedding-001";

    /**
     * Số chiều đầu ra. gemini-embedding-001 cho phép rút gọn; 768 là điểm cân bằng
     * tốt giữa chất lượng và bộ nhớ (768 × 4 byte × vài trăm chunk ≈ vài MB).
     */
    private int dimensions = 768;

    /** Số văn bản gửi mỗi lời gọi khi seed hàng loạt. */
    private int batchSize = 32;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
                && !"YOUR_API_KEY_HERE".equals(apiKey)
                && baseUrl != null && !baseUrl.isBlank()
                && model != null && !model.isBlank();
    }
}
