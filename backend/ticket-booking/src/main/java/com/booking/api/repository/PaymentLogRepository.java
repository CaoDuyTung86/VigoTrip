package com.booking.api.repository;

import com.booking.api.entity.PaymentLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentLogRepository extends JpaRepository<PaymentLog, Long> {

    /**
     * Toàn bộ dấu vết của một mã giao dịch, theo đúng thứ tự đã xảy ra.
     *
     * Đây là truy vấn dùng khi có tranh chấp: khách đưa mã giao dịch trong app ngân hàng,
     * ta dán vào đây và thấy ngay cổng đã gọi về những lần nào, nói gì, ta trả lời ra sao.
     */
    List<PaymentLog> findByTransactionRefOrderByCreatedAtAsc(String transactionRef);

    /**
     * Như trên nhưng có trần số dòng. Đây là bản dùng cho lối vào từ web; bản không trần ở
     * trên chỉ dành cho code gọi nội bộ, nơi phạm vi dữ liệu đã biết trước.
     */
    List<PaymentLog> findByTransactionRefOrderByCreatedAtAsc(String transactionRef, Pageable pageable);

    /** Dấu vết theo đơn — dùng khi khách chỉ nhớ mã đơn chứ không có mã giao dịch. */
    List<PaymentLog> findByBookingIdOrderByCreatedAtAsc(Long bookingId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM PaymentLog p WHERE p.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
