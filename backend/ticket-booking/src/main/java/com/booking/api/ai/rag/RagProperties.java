package com.booking.api.ai.rag;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "rag")
@Data
public class RagProperties {

    /** false = tắt hẳn RAG, prompt sẽ không có phần tri thức bổ sung. */
    private boolean enabled = true;

    /** Số chunk cuối cùng nhét vào prompt. Để cao sẽ loãng ngữ cảnh và tốn token. */
    private int topK = 4;

    /** Số ứng viên lấy từ MỖI nhánh trước khi hợp nhất. */
    private int candidatesPerBranch = 10;

    /**
     * Ngưỡng cosine tối thiểu cho nhánh ngữ nghĩa. Model embedding đa ngôn ngữ hiếm khi
     * cho điểm dưới 0.3 kể cả với cặp không liên quan, nên ngưỡng này lọc nhiễu rõ rệt.
     */
    private double minSimilarity = 0.55;

    /**
     * Hằng số k của Reciprocal Rank Fusion: score = Σ 1/(k + rank).
     * 60 là giá trị chuẩn trong tài liệu gốc; nó làm phẳng chênh lệch giữa các hạng đầu
     * nên ta không phải tự gán trọng số cho từng nhánh.
     */
    private int rrfK = 60;

    /** Tự động seed knowledge base lúc khởi động. */
    private boolean seedOnStartup = true;
}
