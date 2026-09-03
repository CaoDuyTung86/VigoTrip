package com.booking.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Một lượt đánh giá 👍/👎 cho câu trả lời của chatbot.
 *
 * Đây là tín hiệu chất lượng, không phải bản sao hội thoại. Ranh giới đó được giữ bằng
 * mấy quy tắc sau, đừng nới nếu chưa cân nhắc:
 *
 *  - KHÔNG lưu câu trả lời của bot, và KHÔNG có ô nhập tự do. Lý do chỉ được chọn từ
 *    một danh sách mã cố định, nên không có đường nào để thông tin cá nhân lọt vào đây
 *    ngoài ý muốn của người dùng.
 *  - {@code questionSnippet} — câu người dùng đã hỏi — CHỈ được lưu khi họ đã đăng nhập
 *    và đang bật đồng ý lưu hội thoại. Cùng một cái công tắc chi phối mọi chỗ lưu nội
 *    dung, để người dùng không phải đoán xem tắt nó thì còn sót lại ở đâu.
 *  - Khách vãng lai vẫn đánh giá được: cú bấm chính là sự đồng ý, và thứ được lưu chỉ là
 *    một điểm số ẩn danh.
 *  - Snippet bị xóa trắng sau thời hạn lưu trữ (mặc định 30 ngày), nhưng dòng điểm số
 *    thì giữ lại — thống kê chất lượng theo thời gian không cần tới nội dung.
 */
@Entity
@Table(name = "phan_hoi_chat",
        uniqueConstraints = @UniqueConstraint(name = "uk_phan_hoi_message", columnNames = "message_ref"),
        indexes = {
                @Index(name = "idx_phan_hoi_created_at", columnList = "created_at"),
                @Index(name = "idx_phan_hoi_rating", columnList = "rating")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "feedback_id")
    private Long id;

    /**
     * Định danh câu trả lời do client sinh. Dùng để người dùng đổi ý (👍 rồi 👎) thì sửa
     * dòng cũ chứ không đẻ thêm dòng mới làm lệch thống kê.
     */
    @Column(name = "message_ref", nullable = false, length = 64)
    private String messageRef;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    /** Email từ JWT, null với khách vãng lai. Không bao giờ nhận từ body request. */
    @Column(name = "user_email", length = 255)
    private String userEmail;

    /** "UP" hoặc "DOWN". */
    @Column(nullable = false, length = 8)
    private String rating;

    /** Mã lý do cố định, chỉ có ở đánh giá xấu. Xem ChatFeedbackService#ALLOWED_REASONS. */
    @Column(length = 32)
    private String reason;

    /** Câu hỏi của người dùng — chỉ có khi họ đã đồng ý lưu hội thoại. */
    @Column(name = "question_snippet", length = 500)
    private String questionSnippet;

    @Column(length = 8)
    private String lang;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
