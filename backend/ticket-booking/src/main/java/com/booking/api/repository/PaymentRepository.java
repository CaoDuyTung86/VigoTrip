package com.booking.api.repository;

import com.booking.api.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /**
     * VNPay báo kết quả qua cả Return (trình duyệt) lẫn IPN (server-to-server), nên cùng
     * một giao dịch có thể vào đây hai lần. Kiểm tra theo vnp_TxnRef để chỉ xử lý một lần.
     */
    boolean existsByTransactionRef(String transactionRef);
}
