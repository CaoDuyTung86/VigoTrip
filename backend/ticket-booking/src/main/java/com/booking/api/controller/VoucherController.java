package com.booking.api.controller;

import com.booking.api.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/voucher")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService voucherService;

    /**
     * POST /api/voucher/validate
     * Body: { "code": "WELCOME20", "orderAmount": 500000 }
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateVoucher(@RequestBody Map<String, Object> request) {
        String code = (String) request.get("code");
        Double orderAmount = request.get("orderAmount") != null
                ? Double.parseDouble(request.get("orderAmount").toString())
                : 0.0;

        Map<String, Object> result = voucherService.validateVoucher(code, orderAmount);
        return ResponseEntity.ok(result);
    }
}
