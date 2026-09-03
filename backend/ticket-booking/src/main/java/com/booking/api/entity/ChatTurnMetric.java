package com.booking.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Số đo vận hành của MỘT lượt hỏi–đáp với chatbot.
 *
 * KHÔNG CÓ NỘI DUNG, KHÔNG CÓ DANH TÍNH — cố ý, và đó là toàn bộ lý do bảng này tồn tại
 * tách khỏi {@link ChatMessage}:
 *
 *  - Không có email, không có session id, không có câu hỏi, không có câu trả lời. Chỉ có
 *    độ dài, độ trễ và kết quả. Vì vậy nó KHÔNG cần sự đồng ý của người dùng và không bị
 *    ảnh hưởng bởi công tắc lưu lịch sử: không có gì ở đây quy được về một con người.
 *  - Ghi cho MỌI lượt chat, kể cả khách vãng lai. Đây là thứ duy nhất trong hệ thống cho
 *    biết chatbot đang chạy ra sao với nhóm người dùng đông nhất.
 *
 * Giữ lâu hơn tin nhắn (mặc định 90 ngày so với 30) vì so sánh theo tháng mới thấy được
 * xu hướng, mà việc giữ lại không đánh đổi gì về quyền riêng tư.
 */
@Entity
@Table(name = "chi_so_chat", indexes = {
        @Index(name = "idx_chi_so_chat_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatTurnMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "metric_id")
    private Long id;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 8)
    private String lang;

    /** Đã đăng nhập hay khách vãng lai. Chỉ là cờ, không kèm danh tính. */
    @Column(nullable = false)
    private boolean authenticated;

    /** Trả lời qua SSE hay qua POST thường — hai đường có đặc tính lỗi khác nhau. */
    @Column(nullable = false)
    private boolean streamed;

    @Column(name = "latency_ms", nullable = false)
    private int latencyMs;

    @Column(name = "question_chars", nullable = false)
    private int questionChars;

    @Column(name = "answer_chars", nullable = false)
    private int answerChars;

    /**
     * Số đoạn tri thức RAG tìm được cho câu hỏi này. Bằng 0 nghĩa là model phải trả lời
     * chay — tỉ lệ 0 cao chính là danh sách việc cần làm cho kho tri thức.
     */
    @Column(name = "rag_chunks", nullable = false)
    private int ragChunks;

    /** OK | EMPTY (model trả về rỗng) | ERROR (ném ngoại lệ). */
    @Column(nullable = false, length = 16)
    private String outcome;
}
