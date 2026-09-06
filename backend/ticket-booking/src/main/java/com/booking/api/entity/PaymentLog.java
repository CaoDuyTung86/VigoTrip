package com.booking.api.entity;

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
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Nhật ký thô của mọi lần hệ thống trao đổi với cổng thanh toán, và của mọi quyết định
 * hoàn tiền do con người bấm.
 *
 * VÌ SAO CẦN MỘT BẢNG, TRONG KHI ĐÃ CÓ log.info: log ứng dụng nằm trong container. Container
 * restart, hoặc nhà cung cấp xoay vòng log, là chứng cứ biến mất — mà tranh chấp tiền nong
 * thì thường nổ ra sau đó vài ngày. Đã có một khoản 680.000đ (booking 48) không truy được
 * vì đúng lý do này. Bảng này là thứ trả lời được câu "khách bảo đã trả tiền, hệ thống bảo
 * chưa" mà không cần mở app ngân hàng của khách.
 *
 * QUAN HỆ VỚI {@link Payment}: khác vai hoàn toàn. {@code thanh_toan} là TRẠNG THÁI HIỆN
 * TẠI của một giao dịch — mỗi giao dịch một dòng, bị ghi đè mỗi lần có tin mới. Bảng này là
 * LỊCH SỬ: mỗi lần cổng gọi tới hay ta gọi đi đều thêm một dòng, không bao giờ sửa. Chính vì
 * vậy nó ghi được cả những lượt mà {@code thanh_toan} không giữ lại dấu vết nào: callback
 * chữ ký sai, callback bị từ chối vì lệch tiền, những lượt hỏi querydr không kết luận được.
 *
 * KHÔNG CÓ KHÓA NGOẠI tới {@code don_hang} dù có cột {@code booking_id}. Cố ý: dòng nhật ký
 * phải ghi được cả khi mã đơn đọc ra từ callback là rác hoặc trỏ vào một đơn không tồn tại —
 * mà đó lại đúng là những callback đáng ghi nhất. Một khóa ngoại sẽ làm chính lúc đó ghi hỏng.
 *
 * KHÔNG CHỨA BÍ MẬT: {@code vnp_SecureHash} bị loại khỏi payload trước khi lưu (xem
 * {@code PaymentLogService}). Callback VNPay vốn không mang số thẻ — chỉ mã giao dịch, số
 * tiền, mã ngân hàng, thời gian.
 */
@Entity
@Table(name = "nhat_ky_thanh_toan", indexes = {
        @Index(name = "idx_nhat_ky_tt_created_at", columnList = "created_at"),
        @Index(name = "idx_nhat_ky_tt_txn_ref", columnList = "transaction_ref"),
        @Index(name = "idx_nhat_ky_tt_booking_id", columnList = "booking_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentLog {

    /**
     * Trần độ dài của hai cột payload, và cũng là mốc cắt bớt trong code.
     *
     * 4000 chứ không lớn hơn vì {@code use_nationalized_character_data} đang bật: cột chuỗi
     * ra kiểu NVARCHAR, mà NVARCHAR của SQL Server tối đa đúng 4000 ký tự trước khi phải
     * chuyển sang NVARCHAR(MAX) — một kiểu cột nặng hơn hẳn và cư xử khác nhau giữa các
     * dialect. Một callback VNPay dài khoảng 600 ký tự, phản hồi querydr khoảng 800, nên
     * 4000 đã là hơn năm lần chỗ cần.
     *
     * Lúc tạo bảng, SQL Server có thể cảnh báo rằng kích thước dòng TỐI ĐA (hai cột 4000 ký
     * tự cộng lại) vượt 8060 byte. Cảnh báo này vô hại: từ SQL Server 2005, phần vượt được
     * tự đẩy sang trang row-overflow, và mỗi cột vẫn dưới trần 8000 byte của một cột. Dòng
     * thật thì dài khoảng 1KB nên gần như không bao giờ chạm tới cơ chế đó.
     */
    public static final int MAX_PAYLOAD_CHARS = 4000;

    /** Lượt trao đổi thuộc kênh nào. Quyết định cách đọc hai cột payload. */
    public enum Channel {
        /** Cổng chuyển hướng trình duyệt khách về backend. */
        RETURN,
        /** Cổng gọi ngầm server-to-server. Đây mới là nguồn tin cậy về kết quả. */
        IPN,
        /** Ta chủ động hỏi cổng bằng lệnh querydr. */
        QUERYDR,
        /** Người vận hành duyệt một yêu cầu hoàn tiền. */
        REFUND_APPROVE,
        /** Người vận hành từ chối một yêu cầu hoàn tiền. */
        REFUND_REJECT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long id;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 20)
    private Channel channel;

    /** Mã đơn suy ra được từ callback. Null khi callback không nói rõ hoặc nói sai. */
    @Column(name = "booking_id")
    private Long bookingId;

    /** {@code vnp_TxnRef} — sợi dây duy nhất nối dòng này với sao kê của cổng. */
    @Column(name = "transaction_ref", length = 64)
    private String transactionRef;

    /**
     * Chữ ký HMAC của callback có hợp lệ không. Null với những kênh không có chữ ký
     * (querydr đi ra, quyết định hoàn tiền) hoặc khi lượt xử lý hỏng trước lúc kiểm tra.
     */
    @Column(name = "signature_valid")
    private Boolean signatureValid;

    /**
     * Kết luận của lượt này: mã RspCode với IPN, chuỗi kết quả với Return, verdict với
     * querydr. Đây là QUYẾT ĐỊNH TẠI THỜI ĐIỂM XỬ LÝ, không phải trạng thái cuối của đơn —
     * transaction có thể rollback sau đó. Trạng thái thật luôn đọc ở {@code don_hang}.
     */
    @Column(name = "outcome", length = 64)
    private String outcome;

    /** IP đã gọi vào endpoint callback. Trống với những kênh do chính ta khởi xướng. */
    @Column(name = "source_ip", length = 64)
    private String sourceIp;

    /** Email người bấm nút, với các kênh do con người quyết định. */
    @Column(name = "actor", length = 190)
    private String actor;

    /** Tham số nhận được (Return/IPN) hoặc gửi đi (querydr), đã loại chữ ký. */
    @Column(name = "request_payload", length = MAX_PAYLOAD_CHARS)
    private String requestPayload;

    /** Thứ ta trả lời lại cổng, hoặc thứ cổng trả lời lại ta. */
    @Column(name = "response_payload", length = MAX_PAYLOAD_CHARS)
    private String responsePayload;
}
