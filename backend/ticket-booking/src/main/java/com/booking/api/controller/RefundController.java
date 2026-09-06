package com.booking.api.controller;

import com.booking.api.dto.RefundRequest;
import com.booking.api.dto.RefundResponse;
import com.booking.api.service.RefundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final RefundService refundService;

    /** User gửi yêu cầu hoàn tiền */
    @PostMapping("/request")
    public ResponseEntity<RefundResponse> requestRefund(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody RefundRequest request) {
        return ResponseEntity.ok(refundService.requestRefund(userDetails.getUsername(), request));
    }

    /** User xem yêu cầu hoàn tiền của mình */
    @GetMapping("/my")
    public ResponseEntity<List<RefundResponse>> getMyRefunds(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(refundService.getMyRefunds(userDetails.getUsername()));
    }

    /** Provider/Admin xem tất cả yêu cầu hoàn tiền */
    @GetMapping("/all")
    public ResponseEntity<List<RefundResponse>> getAllRefunds() {
        return ResponseEntity.ok(refundService.getAllRefunds());
    }

    /** Provider duyệt yêu cầu hoàn tiền */
    @PutMapping("/{id}/approve")
    public ResponseEntity<RefundResponse> approveRefund(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        return ResponseEntity.ok(refundService.approveRefund(userDetails.getUsername(), id));
    }

    /** Provider từ chối yêu cầu hoàn tiền */
    @PutMapping("/{id}/reject")
    public ResponseEntity<RefundResponse> rejectRefund(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String note = body.getOrDefault("note", "");
        return ResponseEntity.ok(refundService.rejectRefund(userDetails.getUsername(), id, note));
    }
}
