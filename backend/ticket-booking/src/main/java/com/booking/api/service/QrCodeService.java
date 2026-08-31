package com.booking.api.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.EnumMap;
import java.util.Map;

/**
 * Sinh ảnh QR. Tách khỏi EmailService vì giờ có hai nơi cần: mail xác nhận booking
 * (nhúng qua URL) và endpoint public phục vụ chính URL đó.
 */
@Service
public class QrCodeService {

    /** Tiền tố của payload. Đổi ở đây thì phải đổi cả parseBookingId() bên ProviderCheckIn.jsx. */
    private static final String TICKET_PREFIX = "TICKET-";

    /**
     * ECC mức M (~15% chịu lỗi) thay cho mặc định L.
     *
     * Mã này gần như luôn được quét từ *màn hình điện thoại* chứ không phải giấy in:
     * loá màn, vân tay, độ sáng thấp đều ăn mất module. L không đủ đệm cho mấy thứ đó.
     * Phải khớp với level="M" của QRCodeCanvas bên MyBookings.jsx để hai nơi ra đúng
     * một ảnh giống hệt nhau.
     */
    private static final ErrorCorrectionLevel ECC_LEVEL = ErrorCorrectionLevel.M;

    public byte[] generatePng(String text, int width, int height) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();

        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ECC_LEVEL);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        // Vùng trắng 4 module là bắt buộc theo chuẩn QR; ZXing mặc định đã là 4 nhưng
        // ghi rõ ra để không phụ thuộc vào mặc định của phiên bản thư viện.
        hints.put(EncodeHintType.MARGIN, 4);

        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height, hints);

        ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
        return pngOutputStream.toByteArray();
    }

    /**
     * Nội dung nhúng trong QR của một booking.
     *
     * Dạng "TICKET-<id>", KHÔNG phải số trần. Hai lý do:
     *
     * 1. Trước đây mail nhúng số trần ("48"). Máy soát vé đọc được, nhưng app camera
     *    mặc định của điện thoại (iOS Camera, Google Lens, Zalo) coi một chuỗi số trần
     *    là nội dung không hành động được nên thường không hiện gì cả — khách quét thử
     *    mã trong mail thì tưởng mã hỏng.
     * 2. Web (MyBookings.jsx) lại nhúng một khối JSON. Cùng một vé mà mail và web ra hai
     *    mã khác hẳn nhau. Giờ cả hai cùng sinh đúng chuỗi này.
     *
     * parseBookingId() bên ProviderCheckIn.jsx vẫn nhận cả ba dạng cũ (JSON, số trần,
     * TICKET-...) nên vé đã phát hành trước đây không bị mất hiệu lực.
     */
    public String bookingPayload(Long bookingId) {
        return TICKET_PREFIX + bookingId;
    }
}
