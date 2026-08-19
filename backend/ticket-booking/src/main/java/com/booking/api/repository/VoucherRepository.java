package com.booking.api.repository;

import com.booking.api.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Long> {
    Optional<Voucher> findByCodeIgnoreCase(String code);

    java.util.List<Voucher> findByIsActiveTrue();

    /**
     * Tăng lượt dùng bằng một câu UPDATE duy nhất thay vì đọc — cộng — ghi.
     * Điều kiện maxUsage nằm ngay trong câu lệnh nên hai request song song không thể
     * cùng vượt qua: request thua sẽ nhận về 0 dòng bị ảnh hưởng.
     *
     * @return số dòng được cập nhật (1 = thành công, 0 = voucher đã hết lượt hoặc không tồn tại)
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Voucher v SET v.currentUsage = COALESCE(v.currentUsage, 0) + 1 " +
           "WHERE v.id = :id AND (v.maxUsage IS NULL OR COALESCE(v.currentUsage, 0) < v.maxUsage)")
    int incrementUsage(@Param("id") Long id);

    /**
     * Trả lại lượt dùng khi đơn bị hủy/hết hạn trước khi thanh toán. Không cho xuống dưới 0.
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Voucher v SET v.currentUsage = COALESCE(v.currentUsage, 0) - 1 " +
           "WHERE UPPER(v.code) = UPPER(:code) AND COALESCE(v.currentUsage, 0) > 0")
    int decrementUsageByCode(@Param("code") String code);
}
