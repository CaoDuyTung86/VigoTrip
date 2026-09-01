package com.booking.api.service;

import com.booking.api.dto.BookingConfirmationMail;
import jakarta.mail.BodyPart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khoá lại những gì làm cho mail đọc được trên Gmail điện thoại.
 *
 * Bug đã gặp (ảnh chụp từ máy khách): mail nhắc chuyến ở chế độ tối bị Gmail đảo màu toàn
 * bộ nên chữ trắng trên nền xanh lật thành chữ đen trên nền xanh, và khối thông tin dùng
 * display:flex bị ép thành ba cột chen nhau trên màn hình 375px. Cả hai đều là hệ quả của
 * việc mail được nối tay bằng chuỗi &lt;div&gt; không có &lt;head&gt;.
 *
 * Các test dưới đây chạy qua TẤT CẢ các loại mail, nên một mail mới quên dùng emailShell()
 * sẽ bị bắt ngay tại đây thay vì trong hòm thư của khách. Chúng cũng đổ bản HTML ra
 * target/mail-preview/ để xem lại bằng mắt khi cần.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Khung HTML của email")
class EmailTemplateTest {

    private static final Path PREVIEW_DIR = Path.of("target", "mail-preview");

    @Mock
    private JavaMailSender mailSender;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailService(mailSender);
        ReflectionTestUtils.setField(emailService, "backendUrl", "https://api.vigotrip.test");
        ReflectionTestUtils.setField(emailService, "frontendUrl", "https://vigotrip.test");

        when(mailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
    }

    /**
     * Một lượt gửi cho mỗi loại mail, rồi soi phần HTML thật sự đi ra ngoài.
     *
     * Gộp chung một test có chủ đích: điều cần bảo đảm là KHÔNG CÓ mail nào rơi ra ngoài
     * khung chung, mà điều đó chỉ kiểm được khi chạy hết cả bộ trong một lượt.
     */
    @Test
    @DisplayName("Mọi loại mail đều dùng chung khung an toàn với chế độ tối và màn hình hẹp")
    void everyTemplateUsesTheSharedShell() throws Exception {
        Map<String, String> mails = renderAllMails();

        assertThat(mails).hasSize(9);

        mails.forEach((name, html) -> {
            assertThat(html)
                    .as("%s phải là tài liệu HTML đủ đầu, không phải một cục div", name)
                    .startsWith("<!DOCTYPE html>");

            // Thiếu hai dòng này là Gmail chế độ tối tự đảo màu cả trang.
            assertThat(html)
                    .as("%s thiếu khai báo color-scheme", name)
                    .contains("name='color-scheme' content='light dark'")
                    .contains("name='supported-color-schemes' content='light dark'")
                    .contains("@media (prefers-color-scheme: dark)");

            // Client mail bỏ qua flex/grid; dùng chúng là bố cục vỡ trên màn hình hẹp.
            assertThat(html)
                    .as("%s dùng flex/grid — client mail không dựng được", name)
                    .doesNotContain("display:flex")
                    .doesNotContain("display: flex")
                    .doesNotContain("display:grid")
                    .doesNotContain("display: grid");

            // Bố cục phải co theo bề rộng máy, không chốt cứng 600px.
            assertThat(html)
                    .as("%s không co theo màn hình hẹp", name)
                    .contains("max-width:600px")
                    .contains("@media only screen and (max-width:600px)");
        });
    }

    /**
     * Lý do hoãn chuyến và ghi chú từ chối hoàn vé là chữ do quản trị viên tự gõ, tên hành
     * khách là chữ do khách tự nhập. Cả ba đi thẳng vào chuỗi HTML của thư gửi từ tên miền
     * của chính mình.
     */
    @Test
    @DisplayName("Chữ do người dùng nhập được rào trước khi vào HTML mail")
    void userSuppliedTextIsEscaped() throws Exception {
        String payload = "<script>alert(1)</script>";

        emailService.sendTripDelayEmail("khach@example.com", "HAN → SGN",
                "06:00 01/01/2026", "09:00 01/01/2026", payload);
        emailService.sendRefundRejectedEmail("khach@example.com", 7L, 52L, payload);

        for (String html : capturedHtml()) {
            assertThat(html).doesNotContain(payload);
            assertThat(html).contains("&lt;script&gt;");
        }
    }

    /**
     * Mã QR là thứ duy nhất trong mail phải giữ nền sáng ở mọi chế độ: camera soát vé cần
     * các module tối trên nền sáng kèm vùng lặng trắng bao quanh. Nếu khối này bị cuốn theo
     * nền tối của phần còn lại thì vùng lặng biến mất.
     */
    @Test
    @DisplayName("Khối mã QR giữ nền trắng cả ở chế độ tối, và ảnh trỏ đúng endpoint")
    void qrBlockStaysLightAndPointsAtTheServedImage() throws Exception {
        emailService.sendBookingConfirmation("khach@example.com", sampleBooking());

        String html = capturedHtml().get(0);

        assertThat(html).contains("<img src='https://api.vigotrip.test/api/public/qr/booking/52'");
        assertThat(html).contains("width='220' height='220'");
        assertThat(html).contains("class='vt-qr'");
        assertThat(html).contains(".vt-qr { background-color:#ffffff !important;");
    }

    /** Dựng đủ một lượt tất cả các mail và trả về HTML của từng cái, kèm bản đổ ra đĩa. */
    private Map<String, String> renderAllMails() throws Exception {
        emailService.sendVerificationEmail("khach@example.com", "123456");
        emailService.sendResetPasswordEmail("khach@example.com", "654321");
        emailService.sendBookingConfirmation("khach@example.com", sampleBooking());
        emailService.sendTripReminderEmail("khach@example.com", 52L, "HAN → CXR", "06:00 ngày 02/09/2026");
        emailService.sendSurveyEmail("khach@example.com", 52L);
        emailService.sendTripDelayEmail("khach@example.com", "HAN → CXR",
                "06:00 ngày 02/09/2026", "09:30 ngày 02/09/2026", "Xe gặp sự cố kỹ thuật");
        emailService.sendTripCancelledEmail("khach@example.com", 52L, "HAN → CXR", 4_952_950d);
        emailService.sendRefundApprovedEmail("khach@example.com", 7L, 52L, new BigDecimal("4952950"));
        emailService.sendRefundRejectedEmail("khach@example.com", 7L, 52L, "Yêu cầu gửi sau giờ khởi hành");

        List<String> htmls = capturedHtml();
        String[] names = {
                "01-xac-thuc-tai-khoan", "02-quen-mat-khau", "03-xac-nhan-dat-ve",
                "04-nhac-lich-khoi-hanh", "05-khao-sat", "06-doi-gio-khoi-hanh",
                "07-huy-chuyen", "08-hoan-ve-duyet", "09-hoan-ve-tu-choi"
        };

        Files.createDirectories(PREVIEW_DIR);
        Map<String, String> mails = new LinkedHashMap<>();
        for (int i = 0; i < htmls.size(); i++) {
            mails.put(names[i], htmls.get(i));
            Files.write(PREVIEW_DIR.resolve(names[i] + ".html"),
                    htmls.get(i).getBytes(StandardCharsets.UTF_8));
        }
        return mails;
    }

    private List<String> capturedHtml() throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, atLeastOnce()).send(captor.capture());

        return captor.getAllValues().stream().map(EmailTemplateTest::htmlOf).toList();
    }

    /** MimeMessageHelper(multipart) sinh cây part lồng nhau; phần HTML nằm ở lá. */
    private static String htmlOf(MimeMessage message) {
        try {
            return findHtml(message.getContent());
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được nội dung mail", e);
        }
    }

    private static String findHtml(Object content) throws Exception {
        if (content instanceof MimeMultipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                String html = findHtml(part.getContent());
                if (html != null) {
                    return html;
                }
            }
            return null;
        }
        if (content instanceof String text && text.startsWith("<!DOCTYPE html>")) {
            return text;
        }
        return null;
    }

    private static BookingConfirmationMail sampleBooking() {
        return new BookingConfirmationMail(
                52L,
                "HAN → CXR",
                "20:30 - 10/09/2026",
                "06:00 - 11/09/2026",
                "Nhà xe Phương Trang",
                "2E, 2F",
                List.of(new BookingConfirmationMail.Passenger("NGUYỄN VĂN A", "2E"),
                        new BookingConfirmationMail.Passenger("TRẦN THỊ B", "2F")),
                "Nguyễn Văn A",
                "khach@example.com",
                "0901234567",
                new BigDecimal("4952950"));
    }
}
