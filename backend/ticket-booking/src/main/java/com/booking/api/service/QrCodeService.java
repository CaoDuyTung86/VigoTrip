package com.booking.api.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;

/**
 * Sinh ảnh QR. Tách khỏi EmailService vì giờ có hai nơi cần: mail xác nhận booking
 * (nhúng qua URL) và endpoint public phục vụ chính URL đó.
 */
@Service
public class QrCodeService {

    public byte[] generatePng(String text, int width, int height) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height);

        ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
        return pngOutputStream.toByteArray();
    }

    /** Nội dung nhúng trong QR của một booking. Giữ nguyên định dạng cũ để máy soát vé không phải đổi. */
    public String bookingPayload(Long bookingId) {
        return "BOOKING_" + bookingId;
    }
}
