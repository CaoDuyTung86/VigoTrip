package com.booking.api.service;

import com.booking.api.entity.Voucher;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VoucherService {

    private final VoucherRepository voucherRepository;

    /**
     * Validate và tính toán giảm giá cho một mã voucher.
     * Trả về Map chứa thông tin: valid, discountAmount, message, voucher.
     */
    @Cacheable(value = "vouchers", key = "#code + #orderAmount")
    public Map<String, Object> validateVoucher(String code, java.math.BigDecimal orderAmount) {
        Map<String, Object> result = new HashMap<>();

        if (code == null || code.isBlank()) {
            result.put("valid", false);
            result.put("message", "Vui lòng nhập mã giảm giá.");
            return result;
        }

        Voucher voucher = voucherRepository.findByCodeIgnoreCase(code.trim()).orElse(null);

        if (voucher == null) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá \"" + code + "\" không tồn tại.");
            return result;
        }

        if (!voucher.getIsActive()) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã bị vô hiệu hóa.");
            return result;
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        if (voucher.getExpiryDate() != null && now.isAfter(voucher.getExpiryDate())) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã hết hạn.");
            return result;
        }

        if (voucher.getMaxUsage() != null && voucher.getCurrentUsage() >= voucher.getMaxUsage()) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã hết lượt sử dụng.");
            return result;
        }

        if (voucher.getMinOrderAmount() != null
                && orderAmount.compareTo(java.math.BigDecimal.valueOf(voucher.getMinOrderAmount())) < 0) {
            result.put("valid", false);
            result.put("message", String.format("Đơn hàng tối thiểu %,.0f VND để áp dụng mã này.", voucher.getMinOrderAmount()));
            return result;
        }

        // Tính số tiền giảm
        double discountDouble = orderAmount.doubleValue() * (voucher.getDiscountPercent() / 100.0);
        if (voucher.getMaxDiscountAmount() != null && discountDouble > voucher.getMaxDiscountAmount()) {
            discountDouble = voucher.getMaxDiscountAmount();
        }
        java.math.BigDecimal discountAmount = java.math.BigDecimal.valueOf(discountDouble)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        result.put("valid", true);
        result.put("discountAmount", discountAmount);
        result.put("discountPercent", voucher.getDiscountPercent());
        result.put("message", String.format("Áp dụng thành công! Giảm %,.0f VND (%.0f%%).", discountDouble, voucher.getDiscountPercent()));
        result.put("voucherId", voucher.getId());
        return result;
    }

    /**
     * Tăng lượt sử dụng khi voucher được apply vào đơn hàng thật.
     */
    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public void useVoucher(Long voucherId) {
        Voucher voucher = voucherRepository.findById(voucherId).orElse(null);
        if (voucher != null) {
            voucher.setCurrentUsage(voucher.getCurrentUsage() + 1);
            voucherRepository.save(voucher);
        }
    }
}
