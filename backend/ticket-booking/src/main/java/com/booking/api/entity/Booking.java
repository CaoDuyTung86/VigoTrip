package com.booking.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dat_ve", indexes = {
    @Index(name = "idx_booking_user_id", columnList = "user_id"),
    @Index(name = "idx_booking_status", columnList = "status"),
    @Index(name = "idx_booking_date", columnList = "booking_date"),
    @Index(name = "idx_booking_user_status", columnList = "user_id, status"),
    @Index(name = "idx_booking_checked_in", columnList = "is_checked_in, check_in_date")
})
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booking_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "booking_date")
    private LocalDateTime bookingDate;

    @Column(name = "total_price", precision = 15, scale = 2)
    private BigDecimal totalPrice = BigDecimal.ZERO;

    @Column(name = "status")
    private String status;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Ticket> tickets;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Payment> payments;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Refund> refunds;

    /**
     * KHÔNG cascade: dich_vu_bo_sung là bảng danh mục dùng chung, chỉ do
     * AdditionalServiceSeeder tạo ra. Lưu một đơn hàng không được phép chèn thêm dòng
     * danh mục — ở đây chỉ ghi dòng join-table theo service_id có sẵn.
     *
     * Trước đây có cascade = { PERSIST, MERGE }. Luồng đặt vé thật không lộ vấn đề vì
     * BookingService chạy trong @Transactional nên dịch vụ nạp ra đang managed; nhưng khi
     * dịch vụ được nạp ngoài transaction (entity detached) thì cascade PERSIST ném
     * "detached entity passed to persist" và làm chết cả tiến trình khởi động.
     */
    @ManyToMany
    @JoinTable(name = "dat_ve_dich_vu", joinColumns = @JoinColumn(name = "booking_id"), inverseJoinColumns = @JoinColumn(name = "service_id"))
    private List<AdditionalService> additionalServices;

    @Column(name = "voucher_code")
    private String voucherCode;

    @Column(name = "is_checked_in")
    private Boolean isCheckedIn = false;

    @Column(name = "check_in_date")
    private LocalDateTime checkInDate;

    @Column(name = "reminder_sent")
    private Boolean reminderSent = false;

    /** Đặt bởi NoShowScheduler khi quá giờ khởi hành (+ đệm) mà vé chưa được check-in. */
    @Column(name = "no_show")
    private Boolean noShow = false;

    /**
     * Hạn chót của phiên thanh toán đang mở ở cổng (VNPay). Còn hạn thì
     * BookingCleanupService không được hủy đơn, tránh cảnh cổng trừ tiền xong
     * mới phát hiện đơn đã bị dọn mất.
     */
    @Column(name = "payment_expires_at")
    private LocalDateTime paymentExpiresAt;

    /**
     * Origin của trang web đã mở phiên thanh toán gần nhất (vd https://vigotrip.vercel.app).
     * Cổng VNPay chỉ gọi ngược về backend, nên đây là manh mối duy nhất để đưa khách quay
     * lại đúng tên miền họ đang dùng. Trả về một tên miền khác đồng nghĩa với localStorage
     * khác -> mất token -> khách bị "văng ra" khỏi phiên đăng nhập ngay sau khi trả tiền.
     */
    @Column(name = "payment_return_origin", length = 255)
    private String paymentReturnOrigin;
}
