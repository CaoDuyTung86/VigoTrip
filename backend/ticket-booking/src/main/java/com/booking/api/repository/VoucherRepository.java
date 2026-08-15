package com.booking.api.repository;

import com.booking.api.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Long> {
    Optional<Voucher> findByCodeIgnoreCase(String code);
    java.util.List<Voucher> findByIsActiveTrue();
}
