package com.booking.api.repository;

import com.booking.api.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /**
     * VNPay báo kết quả qua cả Return (trình duyệt) lẫn IPN (server-to-server), nên cùng
     * một giao dịch có thể vào đây hai lần. Kiểm tra theo vnp_TxnRef để chỉ xử lý một lần.
     *
     * LOẠI TRỪ trạng thái INITIATED là điều bắt buộc, không phải tinh chỉnh: từ khi mỗi lần
     * mở cổng thanh toán đều ghi trước một dòng INITIATED mang đúng vnp_TxnRef đó, một phép
     * kiểm tra "đã tồn tại dòng nào chưa" sẽ thấy chính dòng ta vừa tự ghi và kết luận nhầm
     * rằng callback này đã được xử lý — hậu quả là KHÔNG đơn nào còn được xác nhận nữa.
     */
    boolean existsByTransactionRefAndPaymentStatusNot(String transactionRef, String paymentStatus);

    /** Dòng đã ghi trước lúc mở cổng, để callback cập nhật lại thay vì chèn thêm một dòng nữa. */
    Optional<Payment> findByTransactionRef(String transactionRef);

    /**
     * Các lần mở cổng thanh toán chưa có kết quả của một đơn — đây là toàn bộ manh mối để
     * hỏi cổng xem đơn quá hạn có thật sự đã bị trừ tiền hay chưa.
     */
    List<Payment> findByBooking_IdAndPaymentStatus(Long bookingId, String paymentStatus);
}
