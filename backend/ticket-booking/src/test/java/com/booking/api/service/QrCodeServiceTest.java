package com.booking.api.service;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.EnumMap;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Khoá lại hợp đồng của mã QR vé.
 *
 * Bug đã gặp: mail xác nhận nhúng số bookingId trần còn web nhúng một khối JSON, cùng một
 * vé ra hai mã khác hẳn nhau; và số trần thì app camera mặc định của điện thoại không
 * coi là nội dung mở được nên khách tưởng mã hỏng. Các test dưới đây giữ cho payload
 * không lặng lẽ trôi trở lại một trong hai dạng đó.
 */
class QrCodeServiceTest {

    private final QrCodeService qrCodeService = new QrCodeService();

    /**
     * Bản sao của biểu thức trong parseBookingId() ở my-react-app/src/utils/ticketQr.js.
     * Máy soát vé chạy trên trình duyệt nên không có cách nào dùng chung code; chép lại
     * ở đây để nếu ai đổi định dạng payload bên Java thì test này vỡ ngay, thay vì phát
     * hiện ra lúc nhân viên đứng ở cửa soát vé.
     */
    private static final Pattern SCANNER_TICKET_FORM = Pattern.compile("^TICKET-(\\d+)(?:-.*)?$");

    @Test
    @DisplayName("Payload là chuỗi TICKET-<id>, không phải số trần")
    void bookingPayload_hasTicketPrefix() {
        assertEquals("TICKET-48", qrCodeService.bookingPayload(48L));
    }

    @ParameterizedTest
    @ValueSource(longs = {1L, 48L, 1234567L})
    @DisplayName("Payload luôn khớp biểu thức mà máy soát vé dùng để rút bookingId")
    void bookingPayload_isReadableByScanner(long bookingId) {
        var matcher = SCANNER_TICKET_FORM.matcher(qrCodeService.bookingPayload(bookingId));

        assertTrue(matcher.matches(), "máy soát vé sẽ báo 'mã vé phải là số' với payload này");
        assertEquals(String.valueOf(bookingId), matcher.group(1));
    }

    @Test
    @DisplayName("Ảnh PNG sinh ra giải mã ngược lại đúng payload đã yêu cầu")
    void generatePng_roundTrips() throws Exception {
        String payload = qrCodeService.bookingPayload(48L);

        byte[] png = qrCodeService.generatePng(payload, 660, 660);
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));

        assertEquals(660, image.getWidth());
        assertEquals(660, image.getHeight());
        assertEquals(payload, decode(image));
    }

    @Test
    @DisplayName("Vẫn đọc được sau khi ảnh bị thu nhỏ về đúng kích thước hiển thị trong mail")
    void generatePng_survivesDownscaleToMailSize() throws Exception {
        // Mail hiển thị ảnh ở 220px. Bản cũ sinh 250px rồi ép xuống 180px, tỉ lệ lẻ làm
        // nhoè viền module; kiểm tra rằng tỉ lệ 660 -> 220 hiện tại không dính lỗi đó.
        String payload = qrCodeService.bookingPayload(1234567L);

        byte[] png = qrCodeService.generatePng(payload, 660, 660);
        BufferedImage full = ImageIO.read(new ByteArrayInputStream(png));

        BufferedImage scaled = new BufferedImage(220, 220, BufferedImage.TYPE_INT_RGB);
        var g = scaled.createGraphics();
        g.drawImage(full.getScaledInstance(220, 220, java.awt.Image.SCALE_SMOOTH), 0, 0, null);
        g.dispose();

        assertEquals(payload, decode(scaled));
    }

    private String decode(BufferedImage image) throws Exception {
        var source = new BufferedImageLuminanceSource(image);
        var bitmap = new BinaryBitmap(new HybridBinarizer(source));

        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.CHARACTER_SET, "UTF-8");

        Result result = new MultiFormatReader().decode(bitmap, hints);
        return result.getText();
    }
}
