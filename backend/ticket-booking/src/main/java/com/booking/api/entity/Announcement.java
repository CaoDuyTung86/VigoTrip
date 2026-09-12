package com.booking.api.entity;

import com.booking.api.enums.AnnouncementKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Một mẩu tin nhập tay cho dải tin chạy — nhịp hai của bảng tin.
 *
 * <p>Nhịp một suy tin thẳng từ voucher đang hiệu lực nên không đụng lược đồ CSDL. Bảng này là
 * phần còn lại: những tin không có dữ liệu nào để suy ra, ví dụ tuyến mới mở bán và lịch bảo
 * trì. Hai nguồn được hợp nhất trong {@code AnnouncementService.getActiveAnnouncements()}.
 *
 * <p><b>Cặp hiệu lực là trường quan trọng nhất.</b> Tin phải tự hết hạn. Nếu việc tắt tin phụ
 * thuộc vào một người nhớ ra mà vào tắt, thì sớm muộn dải tin cũng treo khuyến mãi Tết vào
 * tháng Tư — và đó là kiểu lỗi không ai báo cáo, chỉ làm cả bảng tin mất uy tín dần.
 *
 * <p><b>Nguyên văn hai thứ tiếng, không phải khoá dịch.</b> Khác hẳn tin voucher: tin voucher
 * gửi {@code kind} + {@code params} để frontend ghép câu theo bảng dịch, còn tin nhập tay thì
 * câu chữ do người nhập viết ra, không có bảng dịch nào chứa nó. Bản tiếng Anh được phép để
 * trống, lúc đó giao diện hiện bản tiếng Việt chứ không ẩn tin.
 *
 * <p>Không có cờ "khẩn cấp". Dải tin là kênh đọc lướt cho tin KHÔNG khẩn cấp; thứ mà bỏ lỡ là
 * mất tiền hoặc mất chuyến thì thuộc về {@code HoldCountdownBanner} hoặc Toast, nơi người dùng
 * buộc phải thấy ngay tại chỗ mình đang làm.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "thong_bao", indexes = {
        // Truy vấn duy nhất của bảng này là "tin đang bật, đang trong hạn, xếp theo thứ tự".
        // Cột dang_bat đứng trước vì nó lọc mạnh nhất: phần lớn bản ghi cũ đều đã tắt.
        @Index(name = "idx_thong_bao_hieu_luc", columnList = "dang_bat, hieu_luc_tu, hieu_luc_den")
})
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "thong_bao_id")
    private Long id;

    /** Nguyên văn tiếng Việt. Bắt buộc — đây là bản hiện khi thiếu bản dịch. */
    @Column(name = "noi_dung_vi", nullable = false, length = 500)
    private String contentVi;

    /** Nguyên văn tiếng Anh. Để trống thì giao diện hiện bản tiếng Việt. */
    @Column(name = "noi_dung_en", length = 500)
    private String contentEn;

    /**
     * Đường dẫn nội bộ mở trang đầy đủ. Để trống thì mẩu tin không bấm được.
     *
     * <p>Cố ý KHÔNG mặc định về {@code /uu-dai} như tin voucher: một thông báo bảo trì dẫn
     * người đọc sang trang khuyến mãi thì tệ hơn hẳn một mẩu tin không bấm được.
     */
    @Column(name = "duong_dan", length = 300)
    private String link;

    @Enumerated(EnumType.STRING)
    @Column(name = "loai", nullable = false, length = 20)
    private AnnouncementKind kind = AnnouncementKind.INFO;

    /** Bắt đầu hiện. Để trống nghĩa là hiện ngay. */
    @Column(name = "hieu_luc_tu")
    private LocalDateTime startsAt;

    /** Thôi hiện. Để trống nghĩa là hiện tới khi có người tắt. */
    @Column(name = "hieu_luc_den")
    private LocalDateTime endsAt;

    /**
     * Thứ tự trong dải tin, nhỏ lên trước.
     *
     * <p>Cần một trường riêng vì tin nhập tay không có mốc nào để tự xếp hạng: tin voucher
     * xếp theo hạn sử dụng, còn hai mẩu "tuyến mới" và "bảo trì cuối tuần" thì chỉ người đăng
     * biết cái nào đáng đọc trước.
     */
    @Column(name = "thu_tu")
    private Integer sortOrder = 0;

    /**
     * Công tắc tay, độc lập với cặp hiệu lực.
     *
     * <p>Tắt là cách gỡ một mẩu tin mà vẫn giữ bản ghi, giống hệt {@code isActive} của
     * voucher: gõ lại một đoạn thông báo dài để bật lên vào tuần sau là việc không đáng.
     */
    @Column(name = "dang_bat")
    private Boolean active = true;
}
