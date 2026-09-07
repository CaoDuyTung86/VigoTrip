package com.booking.api.repository;

import com.booking.api.entity.SavedVoucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SavedVoucherRepository extends JpaRepository<SavedVoucher, Long> {
    List<SavedVoucher> findByUserId(Long userId);
    Optional<SavedVoucher> findByUserIdAndVoucherId(Long userId, Long voucherId);
    boolean existsByUserIdAndVoucherId(Long userId, Long voucherId);
    void deleteByUserIdAndVoucherId(Long userId, Long voucherId);

    /**
     * Gỡ voucher khỏi ví của mọi người dùng. Dùng khi admin xóa hẳn một voucher: cột
     * saved_vouchers.voucher_id là khóa ngoại NOT NULL nên nếu còn dòng nào trỏ tới,
     * lệnh xóa voucher sẽ bị database chặn (trả về 409).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM SavedVoucher sv WHERE sv.voucher.id = :voucherId")
    int deleteByVoucherId(@Param("voucherId") Long voucherId);
}
