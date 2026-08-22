package com.booking.api.controller;

import com.booking.api.service.QrCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Phục vụ ảnh QR cho mail xác nhận booking.
 *
 * Trước đây ảnh được nhúng inline bằng `cid:qrcode`, nhưng Brevo API không hỗ trợ
 * Content-ID nên ảnh sẽ vỡ. Client mail cũng chặn `data:` URI, nên cách duy nhất chạy
 * được ở mọi hòm thư là trỏ <img> tới một URL công khai.
 *
 * Endpoint để public có chủ đích: QR chỉ chứa chuỗi "BOOKING_{id}" — đúng bằng thông
 * tin đã nằm sẵn trong email người nhận, không lộ thêm gì. Nó KHÔNG trả về dữ liệu
 * booking, và bản thân mã QR không phải vé hợp lệ nếu không qua bước soát vé.
 */
@RestController
@RequestMapping("/api/public/qr")
@RequiredArgsConstructor
public class QrCodeController {

    private final QrCodeService qrCodeService;

    @GetMapping(value = "/booking/{bookingId}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> bookingQr(@PathVariable Long bookingId) throws Exception {
        byte[] png = qrCodeService.generatePng(qrCodeService.bookingPayload(bookingId), 250, 250);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                // Ảnh sinh từ id nên bất biến; cache để không phải render lại mỗi lần mở mail.
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .body(png);
    }
}
