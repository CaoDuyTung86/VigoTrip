package com.booking.api.repository;

import com.booking.api.entity.SavedVoucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedVoucherRepository extends JpaRepository<SavedVoucher, Long> {
    List<SavedVoucher> findByUserId(Long userId);
    Optional<SavedVoucher> findByUserIdAndVoucherId(Long userId, Long voucherId);
    boolean existsByUserIdAndVoucherId(Long userId, Long voucherId);
    void deleteByUserIdAndVoucherId(Long userId, Long voucherId);
}
