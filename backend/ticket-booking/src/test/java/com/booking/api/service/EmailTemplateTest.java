package com.booking.api.service;

import com.booking.api.dto.BookingConfirmationMail;
import com.booking.api.i18n.Messages;
import com.booking.api.i18n.SupportedLocales;
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
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    private static final Locale VI = SupportedLocales.DEFAULT;
    private static final Locale EN = Locale.forLanguageTag("en");

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        // MessageSource thật, không phải mock: nửa giá trị của bộ test này là chứng minh
        // messages*.properties dựng ra được lá thư hoàn chỉnh, mà mock thì không chứng minh
        // được điều đó — nó chỉ trả về đúng cái mình đã bảo nó trả về.
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);

        emailService = new EmailService(mailSender, new Messages(source));
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
                "06:00 01/01/2026", "09:00 01/01/2026", payload, VI);
        emailService.sendRefundRejectedEmail("khach@example.com", 7L, 52L, payload, VI);

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
        emailService.sendBookingConfirmation("khach@example.com", sampleBooking(), VI);

        String html = capturedHtml().get(0);

        assertThat(html).contains("<img src='https://api.vigotrip.test/api/public/qr/booking/52'");
        assertThat(html).contains("width='220' height='220'");
        assertThat(html).contains("class='vt-qr'");
        assertThat(html).contains(".vt-qr { background-color:#ffffff !important;");
    }

    /**
     * Cùng một lá thư, đổi ngôn ngữ của người nhận thì đổi theo — kể cả chữ ở khung chung.
     *
     * <p>Đây là điều kiện để nút đổi ngôn ngữ có ý nghĩa ngoài phạm vi trình duyệt: mail
     * nhắc khởi hành do bộ lập lịch gửi lúc nửa đêm không có request nào để đọc header
     * Accept-Language, nó chỉ có ngôn ngữ đã lưu trên tài khoản.
     */
    @Test
    @DisplayName("Ngôn ngữ người nhận đổi thì cả tiêu đề, nội dung và chân thư đổi theo")
    void mailFollowsRecipientLanguage() throws Exception {
        emailService.sendTripReminderEmail("khach@example.com", 52L, "HAN → CXR", "06:00", VI);
        emailService.sendTripReminderEmail("khach@example.com", 52L, "HAN → CXR", "06:00", EN);

        List<String> htmls = capturedHtml();
        String vietnamese = htmls.get(0);
        String english = htmls.get(1);

        assertThat(vietnamese)
                .contains("<html lang='vi'>")
                .contains("Chuyến đi của bạn sắp khởi hành")
                .contains("Đội ngũ VigoTrip");

        assertThat(english)
                .contains("<html lang='en'>")
                .contains("Your trip departs soon")
                .contains("The VigoTrip Team")
                // Chân thư nằm trong khung chung — chỗ dễ quên nhất khi thêm mail mới.
                .contains("This is an automated message from VigoTrip")
                .doesNotContain("Đội ngũ VigoTrip")
                .doesNotContain("Trân trọng,");
    }

    /**
     * Số tiền trong thư đi theo NGƯỜI NHẬN, không theo locale của máy chủ chạy container.
     *
     * <p>Test này đi hết đường dây thật (EmailService.money -> mail.currency), khác với
     * MailLocalizationTest chỉ kiểm bảng dịch. Bug cũ nằm đúng ở khúc nối đó: bảng dịch
     * không sai, chỉ có String.format quên truyền Locale và chữ "đ" viết cứng trong Java.
     */
    @Test
    @DisplayName("Số tiền trong thư viết theo ngôn ngữ người nhận, không theo máy chủ")
    void moneyFollowsRecipientLanguage() throws Exception {
        emailService.sendTripCancelledEmail("khach@example.com", 52L, "HAN → CXR", 4_952_950d, VI);
        emailService.sendTripCancelledEmail("khach@example.com", 52L, "HAN → CXR", 4_952_950d, EN);

        List<String> htmls = capturedHtml();

        assertThat(htmls.get(0))
                .as("bản tiếng Việt: nhóm bằng dấu chấm, ký hiệu đ")
                .contains("4.952.950 đ");
        assertThat(htmls.get(1))
                .as("bản tiếng Anh: nhóm bằng dấu phẩy, ký hiệu VND, và không lẫn chữ Việt")
                .contains("4,952,950 VND")
                .doesNotContain("4.952.950")
                .doesNotContain(" đ<");
    }

    /**
     * ja/zh chưa dịch nên rơi về bản mặc định. Điều phải bảo đảm là nó rơi về TIẾNG ANH,
     * không phải rơi về locale của máy chủ — thứ mỗi nơi deploy một khác.
     */
    @Test
    @DisplayName("Ngôn ngữ chưa dịch rơi về tiếng Anh chứ không phải theo máy chủ")
    void untranslatedLanguageFallsBackToEnglish() throws Exception {
        emailService.sendTripReminderEmail("khach@example.com", 52L, "HAN → CXR", "06:00",
                Locale.forLanguageTag("ja"));

        assertThat(capturedHtml().get(0))
                .contains("<html lang='ja'>")
                .contains("Your trip departs soon");
    }

    /** Dựng đủ một lượt tất cả các mail và trả về HTML của từng cái, kèm bản đổ ra đĩa. */
    private Map<String, String> renderAllMails() throws Exception {
        renderAllMailsIn(VI);

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

    /** Một lượt gửi cho mỗi loại mail, bằng ngôn ngữ chỉ định. */
    private void renderAllMailsIn(Locale locale) {
        emailService.sendVerificationEmail("khach@example.com", "123456", locale);
        emailService.sendResetPasswordEmail("khach@example.com", "654321", locale);
        emailService.sendBookingConfirmation("khach@example.com", sampleBooking(), locale);
        emailService.sendTripReminderEmail("khach@example.com", 52L, "HAN → CXR", "06:00 ngày 02/09/2026", locale);
        emailService.sendSurveyEmail("khach@example.com", 52L, locale);
        emailService.sendTripDelayEmail("khach@example.com", "HAN → CXR",
                "06:00 ngày 02/09/2026", "09:30 ngày 02/09/2026", "Xe gặp sự cố kỹ thuật", locale);
        emailService.sendTripCancelledEmail("khach@example.com", 52L, "HAN → CXR", 4_952_950d, locale);
        emailService.sendRefundApprovedEmail("khach@example.com", 7L, 52L, new BigDecimal("4952950"), locale);
        emailService.sendRefundRejectedEmail("khach@example.com", 7L, 52L, "Yêu cầu gửi sau giờ khởi hành", locale);
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
