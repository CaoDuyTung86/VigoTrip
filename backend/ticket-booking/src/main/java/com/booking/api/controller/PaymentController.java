package com.booking.api.controller;

import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Payment", description = "API thanh toán qua VNPay")
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(summary = "Tạo link thanh toán VNPay", description = "Tạo URL thanh toán cho booking, trả về link chuyển hướng đến cổng VNPay")
    @PostMapping("/create")
    public ResponseEntity<PaymentResponse> createPayment(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PaymentRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        fillReturnOrigin(request, httpRequest);
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
        fillReturnOrigin(request, httpRequest);
        PaymentResponse response = paymentService.createVNPayPayment(
                userDetails.getUsername(), request, ipAddress);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "VNPay callback", description = "Endpoint VNPay gọi sau khi user thanh toán xong (public endpoint)")
    @GetMapping("/vnpay-return")
    public ResponseEntity<Void> vnPayReturn(
            @RequestParam Map<String, String> params,
            HttpServletRequest httpRequest) {
        String result = returnResult(params, httpRequest);

        // Không dùng thẳng frontendUrl: khách phải quay về đúng tên miền họ đang mở,
        // nếu không token trong localStorage của tên miền kia coi như không tồn tại.
        String redirectUrl = paymentService.resolveReturnFrontendUrl(params) + "/my-bookings";
        if ("SUCCESS".equals(result)) {
            redirectUrl += "?payment=success";
        } else if ("LATE_REFUND".equals(result)) {
            // Tiền đã bị trừ nhưng đơn không còn hiệu lực -> đã tự mở yêu cầu hoàn tiền
            redirectUrl += "?payment=refund_pending";
        } else {
            redirectUrl += "?payment=failed";
        }

        return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                .location(java.net.URI.create(redirectUrl))
                .build();
    }

    @Operation(summary = "VNPay IPN", description = "Endpoint VNPay gọi ngầm để cập nhật trạng thái thanh toán (server-to-server)")
    @GetMapping("/vnpay-ipn")
    public Map<String, String> vnPayIPN(@RequestParam Map<String, String> params,
                                        HttpServletRequest httpRequest) {
        try {
            return paymentService.handleVNPayIPN(params, getClientIpAddress(httpRequest));
        } catch (DataIntegrityViolationException e) {
            if (!PaymentService.isDuplicateTransactionRef(e)) {
                throw e;
            }
            log.warn("IPN của giao dịch {} bị chốt chặn chống trùng dưới DB chặn lại — một luồng "
                    + "khác đã ghi nhận xong giao dịch này. Trả mã 02 để cổng thôi gửi lại.",
                    params.get("vnp_TxnRef"));
            return paymentService.duplicateTransactionIpnResponse();
        }
    }

    /**
     * Chạy luồng Return, và dịch riêng trường hợp bị chốt chặn chống trùng dưới DB chặn lại.
     *
     * VÌ SAO BẮT Ở ĐÂY chứ không bắt trong PaymentService: một lỗi vi phạm ràng buộc khiến
     * Hibernate đánh dấu transaction là rollback-only. Từ đó trở đi, mọi cố gắng "bắt lỗi rồi
     * trả về bình thường" ở bên trong đều bị Spring lật lại thành UnexpectedRollbackException
     * đúng lúc commit — giá trị vừa trả về không bao giờ tới được người gọi. Controller là
     * điểm đầu tiên nằm NGOÀI transaction, nên cũng là điểm đầu tiên nói được một câu trả lời
     * có hiệu lực.
     *
     * Chỉ nhận những lỗi đúng là do chống trùng; mọi lỗi toàn vẹn khác vẫn ném tiếp, vì báo
     * "thành công" cho một lỗi thật còn tệ hơn nhiều so với một trang lỗi.
     */
    private String returnResult(Map<String, String> params, HttpServletRequest httpRequest) {
        try {
            return paymentService.handleVNPayReturn(params, getClientIpAddress(httpRequest));
        } catch (DataIntegrityViolationException e) {
            if (!PaymentService.isDuplicateTransactionRef(e)) {
                throw e;
            }
            log.warn("Callback Return của giao dịch {} bị chốt chặn chống trùng dưới DB chặn lại — "
                    + "một luồng khác đã ghi nhận xong giao dịch này.", params.get("vnp_TxnRef"));
            return paymentService.duplicateTransactionReturnResult(params);
        }
    }

    /**
     * Client nên tự gửi returnOrigin; nhưng bản frontend cũ (đã cache trên máy người dùng)
     * thì không, nên suy ra từ header của chính request. PaymentService vẫn đối chiếu
     * giá trị này với allowlist trước khi tin.
     */
    private void fillReturnOrigin(PaymentRequest request, HttpServletRequest httpRequest) {
        if (request.getReturnOrigin() != null && !request.getReturnOrigin().isBlank()) {
            return;
        }
        String origin = httpRequest.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            origin = httpRequest.getHeader("Referer");
        }
        request.setReturnOrigin(origin);
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
