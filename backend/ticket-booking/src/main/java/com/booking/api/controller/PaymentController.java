package com.booking.api.controller;

import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
@Tag(name = "Payment", description = "API thanh toán qua VNPay")
public class PaymentController {

    private final PaymentService paymentService;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Operation(summary = "Tạo link thanh toán VNPay", description = "Tạo URL thanh toán cho booking, trả về link chuyển hướng đến cổng VNPay")
    @PostMapping("/create")
    public ResponseEntity<PaymentResponse> createPayment(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PaymentRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        PaymentResponse response = paymentService.createVNPayPayment(
                userDetails.getUsername(), request, ipAddress);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Tiếp tục thanh toán VNPay", description = "Tạo lại URL thanh toán cho booking PENDING")
    @PostMapping("/resume")
    public ResponseEntity<PaymentResponse> resumePayment(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody PaymentRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        PaymentResponse response = paymentService.createVNPayPayment(
                userDetails.getUsername(), request, ipAddress);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "VNPay callback", description = "Endpoint VNPay gọi sau khi user thanh toán xong (public endpoint)")
    @GetMapping("/vnpay-return")
    public ResponseEntity<Void> vnPayReturn(
            @RequestParam Map<String, String> params) {
        String result = paymentService.handleVNPayReturn(params);

        String redirectUrl = frontendUrl + "/my-bookings";
        if ("SUCCESS".equals(result)) {
            redirectUrl += "?payment=success";
        } else {
            redirectUrl += "?payment=failed";
        }

        return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                .location(java.net.URI.create(redirectUrl))
                .build();
    }

    @Operation(summary = "VNPay IPN", description = "Endpoint VNPay gọi ngầm để cập nhật trạng thái thanh toán (server-to-server)")
    @GetMapping("/vnpay-ipn")
    public Map<String, String> vnPayIPN(@RequestParam Map<String, String> params) {
        return paymentService.handleVNPayIPN(params);
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // Nếu có nhiều IP (proxy chain), lấy IP đầu tiên
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
