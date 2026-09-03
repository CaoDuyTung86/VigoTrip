package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thân request của POST /api/chat/feedback.
 *
 * Cố ý KHÔNG có trường userEmail: danh tính luôn lấy từ JWT, nhận từ body thì ai cũng
 * đánh giá hộ người khác được.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatFeedbackRequest {

    /** Định danh câu trả lời do client sinh. */
    private String messageRef;

    private String sessionId;

    /** "UP" hoặc "DOWN". */
    private String rating;

    /** Mã lý do cố định, chỉ gửi kèm đánh giá xấu. */
    private String reason;

    /** Câu người dùng đã hỏi. Server chỉ lưu khi người dùng đồng ý lưu hội thoại. */
    private String question;

    private String language;
}
