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

    /**
     * Ngôn ngữ người dùng đã chọn ('vi', 'en', 'ja', 'zh').
     *
     * Sống trong cơ sở dữ liệu chứ không chỉ trong localStorage vì nó phải dùng được ở
     * những nơi không có trình duyệt nào đang mở: mail nhắc khởi hành do bộ lập lịch gửi
     * lúc nửa đêm, mail báo hoãn/huỷ chuyến do quản trị viên bấm từ máy khác. Đọc ngôn ngữ
     * từ header Accept-Language của request thì mấy luồng đó không có request nào để mà
     * đọc — nên nơi duy nhất trả lời được "người này đọc tiếng gì" là chính bản ghi này.
     *
     * null = chưa từng chọn: hiểu là tiếng Việt (xem resolveLocale).
     */
    @Column(name = "ngon_ngu", length = 5)
    private String language;

    /**
     * Ngôn ngữ để soạn thư gửi cho người này. Không bao giờ trả về null.
     *
     * Đặt ở entity thay vì rải if-else tại từng chỗ gọi EmailService: có 11 chỗ gửi mail,
     * và chỗ nào quên xử lý null thì lỗi chỉ lộ ra trong hòm thư của khách.
     */
    public java.util.Locale resolveLocale() {
        return com.booking.api.i18n.SupportedLocales.parse(language);
    }
}
