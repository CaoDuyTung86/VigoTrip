package com.booking.api.controller;

import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/voucher")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService voucherService;

    /**
     * POST /api/voucher/validate
     * Body: { "code": "WELCOME20", "orderAmount": 500000, "providerId": 3 }
     * providerId là hãng phương tiện của chuyến đang đặt (không bắt buộc).
     * orderAmount phải là số tiền SAU giảm giá hạng thành viên — đúng thứ tự backend áp dụng
     * khi tạo booking, nếu không số tiền giảm hiển thị sẽ lệch với lúc thanh toán.
     * Nếu đã đăng nhập, kết quả còn tính cả việc tài khoản đã dùng mã này ở đơn khác hay chưa.
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateVoucher(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> request) {
        String code = (String) request.get("code");
        java.math.BigDecimal orderAmount = request.get("orderAmount") != null
                ? new java.math.BigDecimal(request.get("orderAmount").toString())
                : java.math.BigDecimal.ZERO;
        Long providerId = request.get("providerId") != null
                ? Long.valueOf(request.get("providerId").toString())
                : null;

        String email = userDetails != null ? userDetails.getUsername() : null;
        Map<String, Object> result = voucherService.validateVoucherForUser(code, orderAmount, providerId, email);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/voucher/list?providerId=3&orderAmount=500000
     * Danh sách voucher dùng cho trang "Ưu đãi" của người dùng. providerId/orderAmount không bắt buộc —
     * chỉ dùng để xác định chính xác voucher nào áp dụng được khi có ngữ cảnh đơn hàng.
     */
    @GetMapping("/list")
    public ResponseEntity<List<VoucherPublicDTO>> listVouchers(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Long providerId,
            @RequestParam(required = false) BigDecimal orderAmount) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(voucherService.getPublicVouchers(providerId, orderAmount, email));
    }
}
