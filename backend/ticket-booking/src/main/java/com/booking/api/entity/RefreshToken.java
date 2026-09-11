package com.booking.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Một phiên đăng nhập dài hạn (refresh token) của một tài khoản.
 *
 * Vì sao phải có bảng này thay vì ký thêm một JWT thứ hai: JWT là thứ KHÔNG thu hồi được.
 * Đã ký ra rồi thì nó có hiệu lực tới đúng giây hết hạn, kể cả khi người dùng bấm đăng xuất,
 * đổi mật khẩu, hay khi ta phát hiện token bị đánh cắp. Refresh token là chìa khoá sống lâu
 * (tính bằng tuần) nên nó bắt buộc phải thu hồi được — và muốn thu hồi thì máy chủ phải nhớ
 * nó ở đâu đó. Đây là chỗ đó.
 *
 * BA BẤT BIẾN của bảng này, đừng phá:
 *
 * 1. KHÔNG BAO GIỜ lưu token thô. Cột token_hash giữ SHA-256 của token. Ai đọc trộm được
 *    database (SQL injection, backup rò rỉ, log truy vấn) cũng không khôi phục ngược ra được
 *    chuỗi để đem đi dùng. Token có 256 bit ngẫu nhiên nên không dò ngược bằng từ điển như
 *    mật khẩu, vì vậy SHA-256 trần là đủ, không cần bcrypt (và bcrypt ở đây sẽ tốn ~100ms
 *    cho MỖI lần gọi /refresh).
 *
 * 2. MỘT TOKEN CHỈ DÙNG ĐƯỢC ĐÚNG MỘT LẦN. Mỗi lần /refresh thành công thì bản ghi cũ bị
 *    đánh dấu thu hồi và một bản ghi mới ra đời (xoay vòng - rotation). Nhờ vậy token đánh
 *    cắp có tuổi thọ tối đa bằng khoảng cách giữa hai lần nạn nhân gọi /refresh, chứ không
 *    phải trọn vẹn 14 ngày.
 *
 * 3. MỘT TOKEN ĐÃ THU HỒI MÀ QUAY LẠI = CÓ TRỘM. Chủ thật và kẻ trộm cùng cầm một chuỗi;
 *    ai gọi /refresh trước thì người kia cầm bản đã bị xoay. Khi bản đã xoay quay lại,
 *    máy chủ không có cách nào biết ai là chủ, nên thu hồi CẢ HỌ (family_id) và bắt cả hai
 *    đăng nhập lại. Phiền một lần, nhưng cắt đứt được phiên của kẻ trộm.
 */
@Data
@NoArgsConstructor
@Entity
@Table(
        name = "phien_dang_nhap",
        uniqueConstraints = @UniqueConstraint(name = "uk_phien_token_hash", columnNames = "token_hash"),
        indexes = {
                @Index(name = "idx_phien_family", columnList = "family_id"),
                @Index(name = "idx_phien_expires", columnList = "expires_at")
        })
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "session_id")
    private Long id;

    /** SHA-256 (hex thường, 64 ký tự) của token thô. Xem bất biến 1 ở trên. */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /**
     * Cả chuỗi xoay vòng sinh ra từ MỘT lần đăng nhập dùng chung giá trị này. Đây là đơn vị
     * bị thu hồi khi phát hiện dùng lại token cũ, và cũng là đơn vị mà màn "Thiết bị đang
     * đăng nhập" sẽ hiển thị (mỗi dòng một họ, không phải mỗi dòng một lần xoay).
     */
    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    /** Hạn của RIÊNG bản ghi này. Mỗi lần xoay lại được gia hạn (idle timeout). */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * Trần cứng của cả họ, tính từ lúc đăng nhập. Không có cột này thì người dùng hoạt động
     * liên tục sẽ không bao giờ phải đăng nhập lại — và một phiên bị chiếm mà kẻ trộm siêng
     * gọi /refresh cũng sống mãi theo.
     */
    @Column(name = "family_expires_at", nullable = false)
    private LocalDateTime familyExpiresAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /** null = còn hiệu lực. Khác null = đã xoay, đã đăng xuất, hoặc đã bị thu hồi. */
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    /** Vì sao bị thu hồi — xem RefreshTokenService.RevokeReason. Chỉ để điều tra. */
    @Column(name = "revoked_reason", length = 32)
    private String revokedReason;

    /**
     * Dấu vết thiết bị, cắt còn 180 ký tự. CHỈ để người dùng nhận ra phiên nào là của mình
     * trong màn quản lý thiết bị; KHÔNG dùng làm điều kiện xác thực. User-Agent do client tự
     * khai nên kẻ trộm sao chép được, mà mạng di động lại đổi nó sau mỗi lần cập nhật trình
     * duyệt — lấy nó làm khoá thì vừa không chặn được trộm vừa đá nhầm người thật.
     */
    @Column(name = "user_agent", length = 180)
    private String userAgent;

    public boolean isActive(LocalDateTime now) {
        return revokedAt == null
                && expiresAt.isAfter(now)
                && familyExpiresAt.isAfter(now);
    }
}
