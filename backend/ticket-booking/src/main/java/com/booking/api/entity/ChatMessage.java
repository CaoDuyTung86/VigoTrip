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
 * Một lượt tin nhắn trong hội thoại với chatbot.
 *
 * QUYỀN RIÊNG TƯ — những ràng buộc sau là có chủ đích, đừng nới lỏng nếu chưa cân nhắc:
 *
 *  - CHỈ lưu hội thoại của người dùng ĐÃ ĐĂNG NHẬP. Khách vãng lai không được lưu gì,
 *    vì họ không có cách nào xem lại hay yêu cầu xóa dữ liệu của mình.
 *  - Chỉ chính chủ đọc được lịch sử của mình. Không có API cho admin đọc hội thoại
 *    của người dùng.
 *  - Tự động xóa sau một số ngày cấu hình được (mặc định 30), do ChatHistoryCleanupService
 *    thực hiện. Tin nhắn chat có thể chứa thông tin cá nhân, giữ vô thời hạn là không nên.
 *
 * Lưu phẳng theo từng tin nhắn thay vì tách bảng hội thoại riêng: chatbot này chỉ có
 * một mạch hội thoại cho mỗi người dùng, thêm một bảng cha chỉ để chứa khóa ngoại là
 * phức tạp thừa.
 */
@Entity
@Table(name = "tin_nhan_chat", indexes = {
        @Index(name = "idx_chat_msg_user_time", columnList = "user_email, created_at"),
        @Index(name = "idx_chat_msg_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long id;

    /** Email lấy từ JWT. Không bao giờ nhận từ tham số do client hay model gửi lên. */
    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    /** Định danh phiên phía client, để tách các mạch hội thoại khác nhau. */
    @Column(name = "session_id", length = 100)
    private String sessionId;

    /** "user" hoặc "assistant", khớp quy ước vai trò của OpenAI. */
    @Column(nullable = false, length = 16)
    private String role;

    @Column(nullable = false, length = 4000)
    private String content;

    @Column(length = 8)
    private String lang;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
