package com.booking.api.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.booking.api.dto.BookingConfirmationMail;
import com.booking.api.i18n.Messages;

import java.util.Locale;


@Service
@Async("emailTaskExecutor")
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final Messages messages;

    /**
     * Mọi hàm gửi mail đều nhận {@link Locale} từ bên gọi, không tự đi tra cứu.
     *
     * <p>Lý do giống hệt lý do {@code sendBookingConfirmation} nhận DTO đã phẳng hoá thay vì
     * nhận entity: cả class này chạy trên thread {@code @Async}, nơi không còn Hibernate
     * Session. Nếu ở đây tự gọi repository để hỏi "người này chọn ngôn ngữ gì", thì mỗi lá
     * mail thành một truy vấn thừa chạy ngoài transaction, và với đơn của khách vãng lai
     * (không có tài khoản) thì truy vấn đó còn không trả về gì. Việc đọc ngôn ngữ thuộc về
     * phía gọi, nơi vẫn còn entity trong tay.
     */
    private String t(Locale locale, String key, Object... args) {
        return messages.t(locale, key, args);
    }

    /**
     * Số tiền trong mail, viết theo quy ước của ngôn ngữ người nhận.
     *
     * <p>Trước đây là {@code String.format("%,.0f đ", x)}: chữ "đ" viết cứng, và không truyền
     * Locale nên dấu phân nhóm lấy theo locale MẶC ĐỊNH CỦA MÁY CHỦ. Hai lỗi cộng lại cho ra
     * "1,500,000 đ" trong lá mail tiếng Anh gửi từ container Render (locale en) — vừa lẫn chữ
     * Việt, vừa không phải cách viết số của tiếng Việt.
     *
     * <p>Truyền chuỗi đã định dạng vào {@code mail.currency} thay vì truyền số: MessageFormat
     * nhận đối số kiểu Number sẽ tự định dạng lại theo locale của bảng dịch và ghi đè mất
     * phần trên.
     */
    private String money(Locale locale, Number amount) {
        String digits = String.format(locale, "%,.0f", amount == null ? 0d : amount.doubleValue());
        return t(locale, "mail.currency", digits);
    }

    /**
     * Giá trị lấy từ đơn, hoặc chữ "đang cập nhật" nếu đơn chưa có dữ liệu đó.
     *
     * <p>{@link BookingConfirmationMail} cố tình để {@code null} ở những ô chưa có dữ liệu để
     * không phải nhúng câu chữ tiếng Việt vào tầng dữ liệu — chỗ điền vào nằm ở đây, nơi đã
     * có locale trong tay.
     */
    private String orPending(Locale locale, String value) {
        return value == null || value.isBlank() ? t(locale, "mail.booking.pending") : value;
    }

    /** URL gốc của chính backend, dùng để nhúng ảnh QR vào mail bằng <img src>. */
    @org.springframework.beans.factory.annotation.Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    /**
     * URL gốc của frontend, dùng cho các link trỏ về web trong mail (khảo sát, quản lý vé...).
     * Trước đây các link này bị hardcode http://localhost:5173, nên trên deploy khách bấm
     * vào là dính thẳng vào máy dev, không bao giờ tới được domain thật.
     */
    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    // Màu dải nhấn trên đầu mỗi loại mail. Chỉ là một vạch màu, không có chữ đặt lên trên,
    // nên nó giữ được nhận diện từng loại thông báo mà không sợ client mail đảo màu chữ.
    private static final String ACCENT_BLUE = "#2563eb";
    private static final String ACCENT_GREEN = "#10b981";
    private static final String ACCENT_INDIGO = "#4f46e5";
    private static final String ACCENT_AMBER = "#f59e0b";
    private static final String ACCENT_RED = "#dc2626";
    private static final String ACCENT_SLATE = "#64748b";

    public void sendResetPasswordEmail(String toEmail, String otpCode, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.reset.subject"));

            String content = heading(t(locale, "mail.reset.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.reset.intro", strong("VigoTrip")))
                    + otpBox(otpCode)
                    + alertBox(t(locale, "mail.reset.otpWarning"))
                    + paragraph(t(locale, "mail.reset.ignore"));

            helper.setText(emailShell(locale, ACCENT_BLUE, t(locale, "mail.reset.eyebrow"), content), true);
            mailSender.send(message);

            log.info("Reset password email sent successfully to {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send reset password email to {}", toEmail, e);
            throw new RuntimeException("Lỗi máy chủ khi gửi email khôi phục mật khẩu.");
        }
    }

    public void sendVerificationEmail(String toEmail, String otpCode, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.verify.subject"));

            String content = heading(t(locale, "mail.verify.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.verify.intro", strong("VigoTrip")))
                    + otpBox(otpCode)
                    + paragraph(t(locale, "mail.verify.expiry"));

            helper.setText(emailShell(locale, ACCENT_GREEN, t(locale, "mail.verify.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Verification email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}", toEmail, e);
        }
    }

    /**
     * Nhận dữ liệu đã phẳng hóa chứ không nhận entity Booking: hàm này chạy trên thread
     * @Async nên không còn Hibernate Session, đụng vào quan hệ LAZY ở đây là
     * LazyInitializationException. Việc đọc entity thuộc về phía gọi, trong transaction.
     *
     * <p>Bố cục của mail này cố tình giữ nguyên như bản đã chỉnh trước đây — nó đang đẹp và
     * đã in ra vé thật. Thay đổi duy nhất là các thẻ class="vt-..." gắn thêm vào những
     * phần tử sẵn có: ở chế độ sáng chúng không đổi gì, còn ở chế độ tối chúng cho phép
     * khối &lt;style&gt; của khung mail đổi màu đúng chỗ thay vì để Gmail đảo màu cả trang.
     */
    public void sendBookingConfirmation(String toEmail, BookingConfirmationMail data, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            Long bookingId = data.bookingId();

            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.booking.subject", String.valueOf(bookingId)));

            String qrUrl = backendUrl + "/api/public/qr/booking/" + bookingId;

            String content = heading(t(locale, "mail.booking.heading"))
                    + paragraph(t(locale, "mail.booking.intro"))

                    + tripSummaryBlock(data, locale)
                    + bookingDetailBlock(data, locale)
                    + passengerBlock(data, locale)
                    + contactBlock(data, locale)

                    // vt-qr giữ khối này luôn nền trắng, kể cả khi phần còn lại của mail
                    // chuyển sang nền tối: mã QR phải nằm trên nền sáng kèm vùng lặng
                    // trắng quanh nó thì camera soát vé mới bắt được.
                    + "<div class='vt-qr' style='text-align: center; margin-bottom: 24px; padding: 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;'>"
                    + "<p style='margin: 0 0 12px 0; font-size: 13.5px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;'>" + t(locale, "mail.booking.qrLabel") + "</p>"
                    // width/height đặt cả ở attribute lẫn style: Outlook đọc attribute, các
                    // client khác đọc style. Thiếu attribute thì Outlook giãn ảnh ra 660px thật.
                    + "<img src='" + qrUrl + "' alt='" + esc(t(locale, "mail.booking.qrAlt", String.valueOf(bookingId))) + "' width='220' height='220' style='width: 220px; height: 220px; display: block; margin: 0 auto; border: 0;' />"
                    + "<p style='margin: 12px 0 0 0; font-size: 12.5px; color: #94a3b8;'>" + t(locale, "mail.booking.qrNote") + "</p>"
                    + "</div>";

            helper.setText(emailShell(locale, ACCENT_BLUE, t(locale, "mail.booking.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Booking confirmation email with QR code sent successfully to {}", toEmail);
        } catch (Exception e) {
            // Nhét luôn lý do vào dòng log: giao diện log của Render gộp stacktrace lại,
            // không có cái này thì chỉ thấy "gửi hỏng" mà không biết hỏng vì đâu.
            log.error("Failed to send booking confirmation email with QR code to {}: {}",
                    toEmail, e.toString(), e);
        }
    }

    /** Dải hành trình nổi bật ở đầu vé: điểm đi ➔ điểm đến, nhà xe/hãng, giờ đi - giờ đến. */
    private String tripSummaryBlock(BookingConfirmationMail data, Locale locale) {
        return "<div class='vt-surface' style='background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px;'>"
                + "<div class='vt-accent' style='font-size: 20px; font-weight: 800; color: #1d4ed8; margin-bottom: 6px;'>" + esc(orPending(locale, data.route())) + "</div>"
                + "<div class='vt-accent' style='font-size: 13px; color: #1e40af;'>" + esc(orPending(locale, data.carrier())) + "</div>"
                + "<div class='vt-accent' style='font-size: 13.5px; color: #1e3a8a; margin-top: 10px;'>"
                + t(locale, "mail.booking.departs") + ": <strong>" + esc(orPending(locale, data.departureTime())) + "</strong>"
                + "<br/>" + t(locale, "mail.booking.arrives") + ": <strong>" + esc(orPending(locale, data.arrivalTime())) + "</strong>"
                + "</div>"
                + "</div>";
    }

    /**
     * Khối thông tin đơn, dựng bằng &lt;table&gt; chứ không phải flexbox.
     *
     * Bản cũ dùng display:flex + justify-content:space-between cho từng dòng nhãn/giá trị.
     * Gmail và Outlook lọc bỏ thuộc tính flex, nên hai vế dính liền nhau thành
     * "Mã đơn vé:#48" lệch hết về trái. Table hai cột là cách duy nhất canh phải chạy
     * được ở mọi hòm thư.
     */
    private String bookingDetailBlock(BookingConfirmationMail data, Locale locale) {
        return "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' class='vt-surface' style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; margin-bottom: 16px;'>"
                + "<tr><td style='padding: 20px 24px;'>"
                + "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='border-collapse: collapse;'>"
                + detailRow(t(locale, "mail.booking.bookingId"), "#" + data.bookingId(), "#2563eb", "vt-accent")
                + detailRow(t(locale, "mail.booking.route"), esc(orPending(locale, data.route())), "#0f172a", "vt-ink")
                + detailRow(t(locale, "mail.booking.departs"), esc(orPending(locale, data.departureTime())), "#dc2626", "vt-danger")
                + detailRow(t(locale, "mail.booking.seats"), esc(orPending(locale, data.seats())), "#0f172a", "vt-ink")
                + "<tr>"
                + "<td class='vt-ink vt-hairline' style='padding: 12px 0 0 0; border-top: 1px dashed #cbd5e1; color: #0f172a; font-size: 14.5px; font-weight: 700;'>" + t(locale, "mail.booking.total") + "</td>"
                + "<td align='right' class='vt-warn vt-hairline' style='padding: 12px 0 0 0; border-top: 1px dashed #cbd5e1; text-align: right; color: #f97316; font-size: 18px; font-weight: 800; white-space: nowrap;'>"
                + money(locale, data.totalPrice()) + "</td>"
                + "</tr>"
                + "</table>"
                + "</td></tr></table>";
    }

    private String detailRow(String label, String value, String valueColor, String valueClass) {
        return "<tr>"
                + "<td class='vt-muted' style='padding: 0 0 12px 0; color: #64748b; font-size: 13.5px; vertical-align: top;'>" + label + "</td>"
                + "<td align='right' class='" + valueClass + "' style='padding: 0 0 12px 0; text-align: right; color: " + valueColor + "; font-size: 15px; font-weight: 700; vertical-align: top;'>" + value + "</td>"
                + "</tr>";
    }

    /**
     * Bảng hành khách: mỗi ghế một dòng tên + số ghế.
     *
     * Tên đã được in hoa sẵn ở BookingConfirmationMail. Đơn nhiều người vẫn chỉ có một
     * mã QR ở cuối mail — check-in là thuộc tính của cả đơn (Booking.isCheckedIn), không
     * phải của từng vé, nên gửi 5 mã cho 5 khách sẽ là 5 mã trỏ về đúng một trạng thái.
     */
    private String passengerBlock(BookingConfirmationMail data, Locale locale) {
        if (data.passengers() == null || data.passengers().isEmpty()) {
            return "";
        }

        StringBuilder rows = new StringBuilder();
        int index = 1;
        for (BookingConfirmationMail.Passenger p : data.passengers()) {
            String name = p.name() == null || p.name().isBlank()
                    ? t(locale, "mail.booking.noName")
                    : esc(p.name());
            rows.append("<tr>")
                    .append("<td class='vt-hairline vt-muted' style='padding: 10px 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; width: 32px;'>").append(index++).append("</td>")
                    .append("<td class='vt-hairline vt-ink' style='padding: 10px 12px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700; letter-spacing: 0.3px;'>").append(name).append("</td>")
                    .append("<td align='right' class='vt-hairline vt-accent' style='padding: 10px 12px; border-top: 1px solid #e2e8f0; text-align: right; color: #2563eb; font-size: 14px; font-weight: 700; white-space: nowrap;'>").append(esc(p.seat())).append("</td>")
                    .append("</tr>");
        }

        return "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' class='vt-hairline' style='border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: collapse; margin-bottom: 24px;'>"
                + "<tr>"
                + "<td colspan='2' class='vt-surface vt-muted' style='padding: 12px 12px 10px 12px; background-color: #f8fafc; color: #64748b; font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px;'>" + t(locale, "mail.booking.passengerList", String.valueOf(data.passengers().size())) + "</td>"
                + "<td align='right' class='vt-surface vt-muted' style='padding: 12px 12px 10px 12px; background-color: #f8fafc; text-align: right; color: #64748b; font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px;'>" + t(locale, "mail.booking.seatColumn") + "</td>"
                + "</tr>"
                + rows
                + "</table>";
    }

    /**
     * Khối người liên hệ của đơn.
     *
     * Có mặt trong mail để khách tự đối chiếu: vé và mọi thông báo về chuyến đi (đổi giờ,
     * huỷ chuyến, nhắc khởi hành) đều đi tới đúng địa chỉ in ở đây. Nhìn thấy sai thì còn
     * kịp sửa trước ngày đi, thay vì phát hiện lúc không nhận được mail nào.
     */
    private String contactBlock(BookingConfirmationMail data, Locale locale) {
        boolean hasEmail = data.contactEmail() != null && !data.contactEmail().isBlank();
        boolean hasPhone = data.contactPhone() != null && !data.contactPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            return "";
        }

        StringBuilder lines = new StringBuilder();
        if (data.contactName() != null && !data.contactName().isBlank()) {
            lines.append("<div class='vt-ink' style='font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;'>")
                    .append(esc(data.contactName())).append("</div>");
        }
        if (hasEmail) {
            lines.append("<div class='vt-body' style='font-size: 13.5px; color: #475569;'>").append(esc(data.contactEmail())).append("</div>");
        }
        if (hasPhone) {
            lines.append("<div class='vt-body' style='font-size: 13.5px; color: #475569;'>").append(esc(data.contactPhone())).append("</div>");
        }

        return "<div class='vt-surface' style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;'>"
                + "<p class='vt-muted' style='margin: 0 0 8px 0; font-size: 12.5px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;'>" + t(locale, "mail.booking.contactTitle") + "</p>"
                + lines
                + "<p class='vt-muted' style='margin: 8px 0 0 0; font-size: 12.5px; color: #94a3b8;'>" + t(locale, "mail.booking.contactNote") + "</p>"
                + "</div>";
    }

    public void sendSurveyEmail(String toEmail, Long bookingId, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.survey.subject", String.valueOf(bookingId)));

            String surveyUrl = frontendUrl + "/my-bookings?reviewBookingId=" + bookingId;

            String content = heading(t(locale, "mail.survey.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.survey.intro", accent("#" + bookingId)))
                    + button(surveyUrl, t(locale, "mail.survey.button"), ACCENT_INDIGO)
                    + paragraph(t(locale, "mail.survey.outro"));

            helper.setText(emailShell(locale, ACCENT_INDIGO, t(locale, "mail.survey.eyebrow"), content), true);
            mailSender.send(message);

            log.info("Survey email sent successfully to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send survey email to {}", toEmail, e);
        }
    }

    public void sendTripDelayEmail(String toEmail, String route, String oldDeparture, String newDeparture,
                                   String reason, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.delay.subject"));

            // Lý do hoãn là chữ do quản trị viên tự gõ. Không rào thì một dấu ngoặc nhọn
            // trong đó đủ bẻ gãy layout mail, và tệ hơn là nhét được thẻ tuỳ ý vào thư
            // gửi đi từ tên miền của chính mình.
            String content = heading(t(locale, "mail.delay.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.delay.intro", accent(esc(route))))
                    + panel(
                            panelRow(t(locale, "mail.delay.oldTime"),
                                    "<s class='vt-muted' style='color:#94a3b8;'>" + esc(oldDeparture) + "</s>", "vt-muted", "17px")
                            + panelRow(t(locale, "mail.delay.newTime"), esc(newDeparture), "vt-ok", "22px")
                            + panelRow(t(locale, "mail.delay.reason"), esc(reason), "vt-ink", "15px"))
                    + paragraph(t(locale, "mail.delay.apology"))
                    + paragraph(t(locale, "mail.delay.refundHint",
                            link(frontendUrl + "/my-bookings", t(locale, "mail.delay.manageTickets"))));

            helper.setText(emailShell(locale, ACCENT_AMBER, t(locale, "mail.delay.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Trip delay email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip delay email to {}", toEmail, e);
        }
    }

    public void sendTripCancelledEmail(String toEmail, Long bookingId, String route, Double refundAmount, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.cancel.subject"));

            String content = heading(t(locale, "mail.cancel.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.cancel.intro", accent(esc(route)), accent("#" + bookingId)))
                    + amountBox(t(locale, "mail.cancel.refundLabel"), money(locale, refundAmount),
                            t(locale, "mail.cancel.refundCaption"))
                    + paragraph(t(locale, "mail.cancel.timeline", strong(t(locale, "mail.businessDays"))))
                    + paragraph(t(locale, "mail.cancel.rebook", link(frontendUrl, "VigoTrip")));

            helper.setText(emailShell(locale, ACCENT_RED, t(locale, "mail.cancel.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Trip cancelled email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip cancelled email to {}", toEmail, e);
        }
    }

    /**
     * Mail nhắc lịch khởi hành.
     *
     * Bản trước dựng bằng một chuỗi &lt;div&gt; style inline và dùng display:flex cho khối
     * thông tin chuyến. Hai điều đó hỏng đúng ở chỗ khách hay đọc mail nhất — Gmail trên
     * điện thoại:
     *
     * <ul>
     *   <li>Không có &lt;head&gt; nên không khai báo được color-scheme. Gmail ở chế độ tối
     *       coi mail là "chỉ có bản sáng" và tự đảo màu toàn bộ, nên chữ trắng trên nền
     *       xanh của header bị lật thành chữ đen trên nền xanh, gần như không đọc nổi.</li>
     *   <li>flex-direction:column bị client mail bỏ qua, nên ba dòng mã đơn / tuyến đường /
     *       giờ khởi hành bị ép thành ba cột chen nhau trên màn hình hẹp.</li>
     * </ul>
     */
    public void sendTripReminderEmail(String toEmail, Long bookingId, String route, String departureTime, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.reminder.subject"));

            String content = heading(t(locale, "mail.reminder.heading"))
                    + paragraph(t(locale, "mail.reminder.intro", strong(t(locale, "mail.reminder.within12h"))))
                    + panel(
                            panelRow(t(locale, "mail.booking.bookingId"), "#" + bookingId, "vt-ink", "17px")
                            + panelRow(t(locale, "mail.booking.route"), esc(route), "vt-ink", "17px")
                            + panelRow(t(locale, "mail.reminder.departTime"), esc(departureTime), "vt-danger", "22px"))
                    + noteBox(t(locale, "mail.reminder.note"))
                    + button(frontendUrl + "/my-bookings", t(locale, "mail.reminder.button"), ACCENT_BLUE)
                    + paragraph(t(locale, "mail.reminder.wish"));

            helper.setText(emailShell(locale, ACCENT_BLUE, t(locale, "mail.reminder.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Trip reminder email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip reminder email to {}", toEmail, e);
        }
    }

    public void sendRefundApprovedEmail(String toEmail, Long refundId, Long bookingId,
                                        java.math.BigDecimal amount, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.refundOk.subject"));

            String content = heading(t(locale, "mail.refundOk.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.refundOk.intro",
                            accent("#" + bookingId), strong(t(locale, "mail.refundOk.accepted"))))
                    + amountBox(t(locale, "mail.refundOk.amountLabel"), money(locale, amount),
                            t(locale, "mail.refundOk.refundId", String.valueOf(refundId)))
                    + paragraph(t(locale, "mail.refundOk.timeline", strong(t(locale, "mail.businessDays"))))
                    + paragraph(t(locale, "mail.refundOk.thanks"));

            helper.setText(emailShell(locale, "#16a34a", t(locale, "mail.refundOk.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Refund approved email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send refund approved email to {}", toEmail, e);
        }
    }

    public void sendRefundRejectedEmail(String toEmail, Long refundId, Long bookingId, String note, Locale locale) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(t(locale, "mail.refundNo.subject"));

            String reason = note != null && !note.trim().isEmpty()
                    ? esc(note)
                    : t(locale, "mail.refundNo.defaultReason");

            String content = heading(t(locale, "mail.refundNo.heading"))
                    + paragraph(t(locale, "mail.hello"))
                    + paragraph(t(locale, "mail.refundNo.intro", accent("#" + refundId), accent("#" + bookingId)))
                    + alertBox("<b>" + t(locale, "mail.refundNo.reasonLabel") + "</b><br/>" + reason)
                    + paragraph(t(locale, "mail.refundNo.stillValid"));

            helper.setText(emailShell(locale, ACCENT_SLATE, t(locale, "mail.refundOk.eyebrow"), content), true);
            mailSender.send(message);
            log.info("Refund rejected email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send refund rejected email to {}", toEmail, e);
        }
    }

    // ------------------------------------------------------------------------------------
    // Khung mail dùng chung
    // ------------------------------------------------------------------------------------

    /**
     * Bọc nội dung một mail vào khung HTML chuẩn của VigoTrip.
     *
     * Trước bản này mỗi hàm gửi mail tự nối một chuỗi &lt;div&gt; style inline riêng, không
     * hàm nào có &lt;head&gt;. Hệ quả nhìn thấy được trên Gmail điện thoại ở chế độ tối:
     * không khai báo color-scheme thì Gmail coi mail là "chỉ có bản sáng" và đảo màu cả
     * trang, nên chữ trắng trên nền xanh của header lật thành chữ đen trên nền xanh —
     * gần như không đọc nổi. Vài mail còn dùng display:flex, thứ mà client mail bỏ qua,
     * làm các dòng nhãn/giá trị bị ép thành cột chen nhau trên màn hình hẹp.
     *
     * Ba nguyên tắc của khung này, đừng bỏ nếu chưa mở lại thử trên Gmail điện thoại:
     * <ul>
     *   <li>Hai thẻ meta color-scheme + supported-color-schemes báo cho Gmail biết mail tự
     *       lo giao diện tối, nhờ đó nó đảo màu dè dặt thay vì đảo sạch.</li>
     *   <li>Style vẫn để inline song song với các class vt-*: client nào cắt &lt;style&gt;
     *       (Gmail với tài khoản không phải Google) thì bản inline là thứ duy nhất còn lại,
     *       và bản inline luôn là bản sáng đọc được.</li>
     *   <li>Không đặt chữ lên nền màu đậm. Dải màu nhận diện là một vạch trơn không có chữ;
     *       nền trung tính + chữ có màu thì client đảo màu kiểu nào chữ vẫn còn tương phản.</li>
     * </ul>
     *
     * @param accentColor màu dải nhấn trên đầu mail, phân biệt loại thông báo
     * @param eyebrow     dòng chữ nhỏ dưới tên thương hiệu
     * @param content     các khối nội dung, dựng bằng heading()/paragraph()/panel()...
     */
    private String emailShell(Locale locale, String accentColor, String eyebrow, String content) {
        // lang trên thẻ <html> không chỉ để cho đẹp: nó là thứ trình đọc màn hình dựa vào
        // để chọn giọng đọc, và là gợi ý để Gmail biết có nên mời dịch lá thư hay không.
        // Để cứng lang='vi' trong một lá thư tiếng Anh là sai ở cả hai chỗ đó.
        return SHELL_OPEN
                .replace("{{LANG}}", locale == null ? "vi" : locale.getLanguage())
                .replace("{{ACCENT}}", accentColor)
                .replace("{{EYEBROW}}", eyebrow)
                + content
                + SHELL_CLOSE
                .replace("{{REGARDS}}", t(locale, "mail.regards"))
                .replace("{{TEAM}}", t(locale, "mail.team"))
                .replace("{{AUTO_NOTICE}}", t(locale, "mail.autoNotice"));
    }

    private static final String SHELL_OPEN = """
            <!DOCTYPE html>
            <html lang='{{LANG}}'>
            <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1'>
            <meta name='color-scheme' content='light dark'>
            <meta name='supported-color-schemes' content='light dark'>
            <title>VigoTrip</title>
            <style>
              :root { color-scheme: light dark; supported-color-schemes: light dark; }
              body { margin:0; padding:0; width:100%; }
              table { border-collapse:collapse; }
              img { border:0; outline:none; text-decoration:none; max-width:100%; }
              @media only screen and (max-width:600px) {
                .vt-pad { padding-left:20px !important; padding-right:20px !important; }
                .vt-title { font-size:20px !important; }
                .vt-big { font-size:20px !important; }
              }
              @media (prefers-color-scheme: dark) {
                .vt-page { background-color:#0f172a !important; }
                .vt-card { background-color:#182338 !important; border-color:#2c3a52 !important; }
                .vt-brand { color:#93c5fd !important; }
                .vt-title { color:#f8fafc !important; }
                .vt-ink { color:#f8fafc !important; }
                .vt-body { color:#cbd5e1 !important; }
                .vt-muted { color:#94a3b8 !important; }
                .vt-surface { background-color:#22304a !important; border-color:#3b4d70 !important; }
                .vt-label { color:#a8c0e8 !important; }
                .vt-accent { color:#93c5fd !important; }
                .vt-link { color:#93c5fd !important; }
                .vt-ok { color:#86efac !important; }
                .vt-danger { color:#fca5a5 !important; }
                .vt-warn { color:#fdba74 !important; }
                .vt-note { background-color:#3b2f12 !important; color:#fcd34d !important; }
                .vt-alert { background-color:#3d1d1d !important; color:#fca5a5 !important; }
                .vt-btn { background-color:#3b82f6 !important; color:#ffffff !important; }
                .vt-hairline { border-color:#2c3a52 !important; }
                .vt-code { color:#f8fafc !important; }
                /* Mã QR phải ở trên nền sáng kèm vùng lặng trắng thì camera mới bắt được. */
                .vt-qr { background-color:#ffffff !important; border-color:#dbe3ee !important; }
              }
              [data-ogsc] .vt-page { background-color:#0f172a !important; }
              [data-ogsc] .vt-card { background-color:#182338 !important; border-color:#2c3a52 !important; }
              [data-ogsc] .vt-brand { color:#93c5fd !important; }
              [data-ogsc] .vt-title, [data-ogsc] .vt-ink { color:#f8fafc !important; }
              [data-ogsc] .vt-body { color:#cbd5e1 !important; }
              [data-ogsc] .vt-muted { color:#94a3b8 !important; }
              [data-ogsc] .vt-surface { background-color:#22304a !important; border-color:#3b4d70 !important; }
              [data-ogsc] .vt-label { color:#a8c0e8 !important; }
              [data-ogsc] .vt-accent, [data-ogsc] .vt-link { color:#93c5fd !important; }
              [data-ogsc] .vt-ok { color:#86efac !important; }
              [data-ogsc] .vt-danger { color:#fca5a5 !important; }
              [data-ogsc] .vt-warn { color:#fdba74 !important; }
              [data-ogsc] .vt-note { background-color:#3b2f12 !important; color:#fcd34d !important; }
              [data-ogsc] .vt-alert { background-color:#3d1d1d !important; color:#fca5a5 !important; }
              [data-ogsc] .vt-hairline { border-color:#2c3a52 !important; }
              [data-ogsc] .vt-qr { background-color:#ffffff !important; }
            </style>
            </head>
            <body class='vt-page' style='margin:0; padding:0; background-color:#eef2f7;'>
            <table role='presentation' class='vt-page' width='100%' cellpadding='0' cellspacing='0' style='background-color:#eef2f7;'>
              <tr>
                <td align='center' style='padding:24px 12px;'>
                  <table role='presentation' class='vt-card' width='600' cellpadding='0' cellspacing='0' style='width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dbe3ee; border-radius:14px; overflow:hidden; font-family:-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;'>
                    <tr><td style='height:6px; line-height:6px; font-size:0; background-color:{{ACCENT}};'>&nbsp;</td></tr>
                    <tr>
                      <td class='vt-pad' style='padding:26px 32px 0 32px;'>
                        <div class='vt-brand' style='font-size:22px; font-weight:800; color:#1d4ed8; letter-spacing:-0.4px;'>VigoTrip</div>
                        <div class='vt-muted' style='font-size:11.5px; font-weight:700; color:#64748b; letter-spacing:1.2px; text-transform:uppercase; padding-top:5px;'>{{EYEBROW}}</div>
                      </td>
                    </tr>
                    <tr>
                      <td class='vt-pad' style='padding:22px 32px 4px 32px;'>
            """;

    private static final String SHELL_CLOSE = """
                        <div class='vt-hairline' style='border-top:1px solid #e6ecf5; margin-top:20px; padding-top:16px;'>
                          <div class='vt-muted' style='font-size:13px; line-height:1.6; color:#7c8aa0;'>{{REGARDS}}</div>
                          <div class='vt-ink' style='font-size:14px; font-weight:700; color:#334155; padding-top:2px;'>{{TEAM}}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  <div class='vt-muted' style='max-width:600px; padding:16px 12px 0 12px; font-family:-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.6; color:#8a97a8; text-align:center;'>
                    {{AUTO_NOTICE}}
                  </div>
                </td>
              </tr>
            </table>
            </body>
            </html>
            """;

    private String heading(String text) {
        return "<h1 class='vt-title' style='margin:0 0 14px 0; font-size:22px; line-height:1.35; font-weight:700; color:#0f172a;'>"
                + text + "</h1>";
    }

    private String paragraph(String html) {
        return "<p class='vt-body' style='margin:0 0 16px 0; font-size:15px; line-height:1.65; color:#475569;'>"
                + html + "</p>";
    }

    /** Nhấn mạnh bằng chữ đậm gần đen — dùng trong câu, không phải cả đoạn. */
    private String strong(String text) {
        return "<strong class='vt-ink' style='color:#0f172a;'>" + text + "</strong>";
    }

    /** Nhấn mạnh bằng màu thương hiệu — mã đơn, mã yêu cầu, tên tuyến. */
    private String accent(String text) {
        return "<strong class='vt-accent' style='color:#1d4ed8;'>" + text + "</strong>";
    }

    private String link(String url, String label) {
        return "<a class='vt-link' href='" + url + "' style='color:#1d4ed8; font-weight:700;'>" + label + "</a>";
    }

    /**
     * Khối thông tin nhãn/giá trị. Mỗi cặp một dòng riêng chồng lên nhau — chứ không phải
     * hai cột — vì trên màn hình 375px hai cột là vừa đủ để giá trị bị xuống dòng giữa chừng.
     */
    private String panel(String rows) {
        return "<table role='presentation' class='vt-surface' width='100%' cellpadding='0' cellspacing='0' "
                + "style='background-color:#f4f7fc; border:1px solid #dbe3ee; border-radius:12px; margin-bottom:18px;'>"
                + rows
                + "<tr><td style='height:16px; line-height:16px; font-size:0;'>&nbsp;</td></tr>"
                + "</table>";
    }

    private String panelRow(String label, String valueHtml, String valueClass, String valueSize) {
        return "<tr><td style='padding:16px 20px 0 20px;'>"
                + "<div class='vt-label' style='font-size:11.5px; font-weight:700; color:#5b7099; letter-spacing:0.8px; text-transform:uppercase;'>"
                + label + "</div>"
                + "<div class='" + valueClass + " vt-big' style='font-size:" + valueSize
                + "; font-weight:800; color:" + colorOf(valueClass) + "; line-height:1.35; padding-top:3px;'>"
                + valueHtml + "</div>"
                + "</td></tr>";
    }

    /** Màu bản sáng đi kèm mỗi class — để giá trị vẫn đúng màu ở client đã cắt mất &lt;style&gt;. */
    private String colorOf(String valueClass) {
        return switch (valueClass) {
            case "vt-danger" -> "#b91c1c";
            case "vt-ok" -> "#15803d";
            case "vt-accent" -> "#1d4ed8";
            case "vt-muted" -> "#94a3b8";
            default -> "#0f172a";
        };
    }

    /** Hộp lưu ý màu hổ phách — thông tin cần đọc nhưng không phải cảnh báo. */
    private String noteBox(String html) {
        return "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin-bottom:18px;'>"
                + "<tr><td class='vt-note' style='background-color:#fff7e6; border-left:4px solid #d97706; "
                + "border-radius:0 8px 8px 0; padding:14px 16px; font-size:14px; line-height:1.6; color:#8a4b08;'>"
                + html + "</td></tr></table>";
    }

    /** Hộp cảnh báo màu đỏ — lý do từ chối, cảnh báo bảo mật. */
    private String alertBox(String html) {
        return "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin-bottom:18px;'>"
                + "<tr><td class='vt-alert' style='background-color:#fef2f2; border-left:4px solid #dc2626; "
                + "border-radius:0 8px 8px 0; padding:14px 16px; font-size:14px; line-height:1.6; color:#b91c1c;'>"
                + html + "</td></tr></table>";
    }

    /** Số tiền cỡ lớn kèm nhãn và một dòng chú thích nhỏ. */
    private String amountBox(String label, String amount, String caption) {
        return "<table role='presentation' class='vt-surface' width='100%' cellpadding='0' cellspacing='0' "
                + "style='background-color:#f4f7fc; border:1px solid #dbe3ee; border-radius:12px; margin-bottom:18px;'>"
                + "<tr><td style='padding:18px 20px;'>"
                + "<div class='vt-label' style='font-size:11.5px; font-weight:700; color:#5b7099; letter-spacing:0.8px; text-transform:uppercase;'>"
                + label + "</div>"
                + "<div class='vt-ok vt-big' style='font-size:28px; font-weight:800; color:#15803d; padding-top:4px;'>"
                + amount + "</div>"
                + "<div class='vt-muted' style='font-size:12.5px; color:#7c8aa0; padding-top:4px;'>" + caption + "</div>"
                + "</td></tr></table>";
    }

    /**
     * Dãy số OTP.
     *
     * letter-spacing rộng và cỡ chữ lớn là để đọc được trên điện thoại mà không phải phóng
     * to; font monospace để phân biệt 0 với O, 1 với l.
     */
    private String otpBox(String otpCode) {
        return "<table role='presentation' class='vt-surface' width='100%' cellpadding='0' cellspacing='0' "
                + "style='background-color:#f4f7fc; border:1px solid #dbe3ee; border-radius:12px; margin-bottom:18px;'>"
                + "<tr><td align='center' style='padding:22px 16px; text-align:center;'>"
                + "<span class='vt-code' style='font-family:Consolas, \"Courier New\", monospace; font-size:32px; "
                + "font-weight:800; letter-spacing:8px; color:#0f172a;'>" + esc(otpCode) + "</span>"
                + "</td></tr></table>";
    }

    /** Nút bấm. Dựng bằng thẻ a nền đặc — nút dạng ảnh hoặc VML thì Gmail chặn. */
    private String button(String url, String label, String color) {
        return "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:6px 0 20px 0;'>"
                + "<tr><td align='center' style='text-align:center;'>"
                + "<a class='vt-btn' href='" + url + "' style='display:inline-block; background-color:" + color
                + "; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; "
                + "padding:13px 30px; border-radius:9px;'>" + label + "</a>"
                + "</td></tr></table>";
    }

    /**
     * Dữ liệu người dùng và quản trị viên tự nhập (tên hành khách, lý do hoãn chuyến, ghi
     * chú từ chối hoàn vé) đi thẳng vào chuỗi HTML của mail. Không escape thì một cái tên
     * chứa dấu ngoặc nhọn đủ để bẻ gãy layout mail, và tệ hơn là nhét được thẻ tuỳ ý vào
     * thư gửi từ tên miền của chính mình.
     */
    private String esc(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
