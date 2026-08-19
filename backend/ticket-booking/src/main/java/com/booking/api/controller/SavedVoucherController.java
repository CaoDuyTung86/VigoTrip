package com.booking.api.controller;

import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.service.SavedVoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Voucher người dùng đã lưu vào tài khoản — dùng ở trang "Ưu đãi" và ở bước
 * nhập mã khuyến mãi khi đặt vé (mở nhanh danh sách đã lưu để áp mã).
 */
@RestController
@RequestMapping("/api/saved-vouchers")
@RequiredArgsConstructor
public class SavedVoucherController {

    private final SavedVoucherService savedVoucherService;

    @GetMapping
    public ResponseEntity<List<VoucherPublicDTO>> list(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Long providerId,
            @RequestParam(required = false) BigDecimal orderAmount) {
        return ResponseEntity.ok(savedVoucherService.getSavedVouchers(userDetails.getUsername(), providerId, orderAmount));
    }

    @PostMapping("/{voucherId}")
    public ResponseEntity<Void> save(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long voucherId) {
        savedVoucherService.saveVoucher(userDetails.getUsername(), voucherId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{voucherId}")
    public ResponseEntity<Void> unsave(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long voucherId) {
        savedVoucherService.unsaveVoucher(userDetails.getUsername(), voucherId);
        return ResponseEntity.noContent().build();
    }
}
