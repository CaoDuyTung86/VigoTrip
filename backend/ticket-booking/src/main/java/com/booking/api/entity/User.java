package com.booking.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "nguoi_dung",
        // Chốt chặn cuối cùng chống tài khoản trùng email (đặc biệt khi 2 request
        // Google Login chạy song song cùng lúc tạo user). Không có ràng buộc này,
        // findByEmail trả về nhiều bản ghi → login 500 + mọi request kèm JWT đều 403.
        uniqueConstraints = @UniqueConstraint(name = "uk_nguoi_dung_email", columnNames = "email"))
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "membership_level_id")
    private Promotion promotion;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "points")
    private Integer points = 0;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password")
    private String password;

    @Column(name = "phone")
    private String phone;

    @Column(name = "role")
    private String role;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Booking> bookings;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Review> reviews;

    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private java.time.LocalDateTime resetTokenExpiry;

    @Column(name = "enabled")
    private Boolean enabled = false;

    @Column(name = "verification_code")
    private String verificationCode;

    /**
     * Người dùng có cho phép lưu nội dung hội thoại với trợ lý AI hay không.
     *
     * null = chưa từng bấm vào công tắc, hiểu là ĐỒNG Ý. Mặc định bật chứ không phải tắt
     * là một đánh đổi có chủ đích: tắt mặc định thì tính năng xem lại lịch sử chết ngay
     * với toàn bộ người dùng cũ. Bù lại, widget chat phải nói rõ đang lưu và tắt được ở
     * đâu — thiếu lời thông báo đó thì mặc định bật là lén lút, không phải tiện lợi.
     */
    @Column(name = "luu_lich_su_chat")
    private Boolean chatHistoryOptIn = true;
}
