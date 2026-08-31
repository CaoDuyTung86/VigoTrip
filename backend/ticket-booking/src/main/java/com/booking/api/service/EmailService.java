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


@Service
@Async("emailTaskExecutor")
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

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

    public void sendResetPasswordEmail(String toEmail, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Yêu cầu khôi phục mật khẩu - VigoTrip");

            String htmlContent = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    + "<div style='background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #93c5fd; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Bảo mật Tài khoản</p>"
                    + "</div>"
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Khôi phục mật khẩu</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Quý khách đã yêu cầu đặt lại mật khẩu cho tài khoản tại <strong>VigoTrip</strong>. Vui lòng sử dụng mã xác thực (OTP) gồm 6 chữ số dưới đây để tiếp tục:</p>"
                    + "<div style='background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;'>"
                    + "<span style='letter-spacing: 8px; color: #1e293b; font-size: 32px; font-weight: 800; font-family: monospace;'>" + otpCode + "</span>"
                    + "</div>"
                    + "<p style='font-size: 13.5px; line-height: 1.6; color: #ef4444; font-weight: 600; margin-bottom: 20px;'>Lưu ý: Mã OTP này có hiệu lực trong vòng 15 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>"
                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Nếu quý khách không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ bộ phận CSKH VigoTrip để bảo vệ tài khoản.</p>"
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"
                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(htmlContent, true);
            mailSender.send(message);
            
            log.info("Reset password email sent successfully to {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send reset password email to {}", toEmail, e);
            throw new RuntimeException("Lỗi máy chủ khi gửi email khôi phục mật khẩu.");
        }
    }

    public void sendVerificationEmail(String toEmail, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Xác thực tài khoản của bạn - VigoTrip");

            String htmlContent = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    + "<div style='background: linear-gradient(135deg, #10b981, #059669); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #a7f3d0; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Chào mừng thành viên mới</p>"
                    + "</div>"
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Xác thực đăng ký tài khoản</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Cảm ơn quý khách đã đăng ký tài khoản tại <strong>VigoTrip</strong>. Vui lòng nhập mã xác minh dưới đây để kích hoạt tài khoản của bạn:</p>"
                    + "<div style='background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;'>"
                    + "<span style='letter-spacing: 8px; color: #047857; font-size: 32px; font-weight: 800; font-family: monospace;'>" + otpCode + "</span>"
                    + "</div>"
                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Mã xác nhận này có hiệu lực trong vòng 24 giờ. Nếu quý khách không thực hiện thao tác này, vui lòng bỏ qua email.</p>"
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"
                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(htmlContent, true);
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
     */
    public void sendBookingConfirmation(String toEmail, BookingConfirmationMail data) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            Long bookingId = data.bookingId();

            helper.setTo(toEmail);
            helper.setSubject("Xác nhận đặt vé thành công #" + bookingId + " - VigoTrip");

            String qrUrl = backendUrl + "/api/public/qr/booking/" + bookingId;

            String htmlContent = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"

                    // background-color đứng trước gradient làm màu dự phòng: Outlook bỏ qua
                    // linear-gradient, không có nó thì header ra nền trắng chữ trắng.
                    + "<div style='background-color: #2563eb; background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #93c5fd; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Xác nhận Đặt vé Thành công</p>"
                    + "</div>"

                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Cảm ơn quý khách đã chọn VigoTrip</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Yêu cầu đặt vé của quý khách đã được thanh toán thành công. Dưới đây là thông tin chi tiết chuyến đi:</p>"

                    + tripSummaryBlock(data)
                    + bookingDetailBlock(data)
                    + passengerBlock(data)
                    + contactBlock(data)

                    + "<div style='text-align: center; margin-bottom: 28px; padding: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;'>"
                    + "<p style='margin: 0 0 12px 0; font-size: 13.5px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;'>MÃ CHECK-IN ĐIỆN TỬ</p>"
                    // width/height đặt cả ở attribute lẫn style: Outlook đọc attribute, các
                    // client khác đọc style. Thiếu attribute thì Outlook giãn ảnh ra 660px thật.
                    + "<img src='" + qrUrl + "' alt='Mã QR check-in đơn vé #" + bookingId + "' width='220' height='220' style='width: 220px; height: 220px; display: block; margin: 0 auto; border: 0;' />"
                    + "<p style='margin: 12px 0 0 0; font-size: 12.5px; color: #94a3b8;'>Một mã QR dùng chung cho cả đơn. Nhân viên soát vé quét một lần là check-in toàn bộ hành khách phía trên.</p>"
                    + "</div>"

                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"
                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(htmlContent, true);
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
    private String tripSummaryBlock(BookingConfirmationMail data) {
        return "<div style='background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px;'>"
                + "<div style='font-size: 20px; font-weight: 800; color: #1d4ed8; margin-bottom: 6px;'>" + esc(data.route()) + "</div>"
                + "<div style='font-size: 13px; color: #1e40af;'>" + esc(data.carrier()) + "</div>"
                + "<div style='font-size: 13.5px; color: #1e3a8a; margin-top: 10px;'>"
                + "Khởi hành: <strong>" + esc(data.departureTime()) + "</strong>"
                + "<br/>Dự kiến đến: <strong>" + esc(data.arrivalTime()) + "</strong>"
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
    private String bookingDetailBlock(BookingConfirmationMail data) {
        return "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: separate; margin-bottom: 16px;'>"
                + "<tr><td style='padding: 20px 24px;'>"
                + "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='border-collapse: collapse;'>"
                + detailRow("Mã đơn vé", "#" + data.bookingId(), "#2563eb")
                + detailRow("Tuyến đường", esc(data.route()), "#0f172a")
                + detailRow("Khởi hành", esc(data.departureTime()), "#dc2626")
                + detailRow("Ghế đã chọn", esc(data.seats()), "#0f172a")
                + "<tr>"
                + "<td style='padding: 12px 0 0 0; border-top: 1px dashed #cbd5e1; color: #0f172a; font-size: 14.5px; font-weight: 700;'>Tổng thanh toán</td>"
                + "<td align='right' style='padding: 12px 0 0 0; border-top: 1px dashed #cbd5e1; text-align: right; color: #f97316; font-size: 18px; font-weight: 800; white-space: nowrap;'>"
                + String.format("%,.0f đ", data.totalPrice()) + "</td>"
                + "</tr>"
                + "</table>"
                + "</td></tr></table>";
    }

    private String detailRow(String label, String value, String valueColor) {
        return "<tr>"
                + "<td style='padding: 0 0 12px 0; color: #64748b; font-size: 13.5px; vertical-align: top;'>" + label + "</td>"
                + "<td align='right' style='padding: 0 0 12px 0; text-align: right; color: " + valueColor + "; font-size: 15px; font-weight: 700; vertical-align: top;'>" + value + "</td>"
                + "</tr>";
    }

    /**
     * Bảng hành khách: mỗi ghế một dòng tên + số ghế.
     *
     * Tên đã được in hoa sẵn ở BookingConfirmationMail. Đơn nhiều người vẫn chỉ có một
     * mã QR ở cuối mail — check-in là thuộc tính của cả đơn (Booking.isCheckedIn), không
     * phải của từng vé, nên gửi 5 mã cho 5 khách sẽ là 5 mã trỏ về đúng một trạng thái.
     */
    private String passengerBlock(BookingConfirmationMail data) {
        if (data.passengers() == null || data.passengers().isEmpty()) {
            return "";
        }

        StringBuilder rows = new StringBuilder();
        int index = 1;
        for (BookingConfirmationMail.Passenger p : data.passengers()) {
            String name = p.name() == null || p.name().isBlank() ? "(CHƯA CÓ TÊN)" : esc(p.name());
            rows.append("<tr>")
                    .append("<td style='padding: 10px 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; width: 32px;'>").append(index++).append("</td>")
                    .append("<td style='padding: 10px 12px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700; letter-spacing: 0.3px;'>").append(name).append("</td>")
                    .append("<td align='right' style='padding: 10px 12px; border-top: 1px solid #e2e8f0; text-align: right; color: #2563eb; font-size: 14px; font-weight: 700; white-space: nowrap;'>").append(esc(p.seat())).append("</td>")
                    .append("</tr>");
        }

        return "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='border: 1px solid #e2e8f0; border-radius: 12px; border-collapse: collapse; margin-bottom: 24px;'>"
                + "<tr>"
                + "<td colspan='2' style='padding: 12px 12px 10px 12px; background-color: #f8fafc; color: #64748b; font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px;'>DANH SÁCH HÀNH KHÁCH (" + data.passengers().size() + ")</td>"
                + "<td align='right' style='padding: 12px 12px 10px 12px; background-color: #f8fafc; text-align: right; color: #64748b; font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px;'>GHẾ</td>"
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
    private String contactBlock(BookingConfirmationMail data) {
        boolean hasEmail = data.contactEmail() != null && !data.contactEmail().isBlank();
        boolean hasPhone = data.contactPhone() != null && !data.contactPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            return "";
        }

        StringBuilder lines = new StringBuilder();
        if (data.contactName() != null && !data.contactName().isBlank()) {
            lines.append("<div style='font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;'>")
                    .append(esc(data.contactName())).append("</div>");
        }
        if (hasEmail) {
            lines.append("<div style='font-size: 13.5px; color: #475569;'>").append(esc(data.contactEmail())).append("</div>");
        }
        if (hasPhone) {
            lines.append("<div style='font-size: 13.5px; color: #475569;'>").append(esc(data.contactPhone())).append("</div>");
        }

        return "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;'>"
                + "<p style='margin: 0 0 8px 0; font-size: 12.5px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;'>NGƯỜI LIÊN HỆ</p>"
                + lines
                + "<p style='margin: 8px 0 0 0; font-size: 12.5px; color: #94a3b8;'>Mọi thông báo về chuyến đi sẽ được gửi tới địa chỉ này.</p>"
                + "</div>";
    }

    /**
     * Tên hành khách là dữ liệu người dùng tự nhập, đi thẳng vào chuỗi HTML của mail.
     * Không escape thì một cái tên chứa dấu ngoặc nhọn đủ để bẻ gãy layout mail, và tệ
     * hơn là nhét được thẻ tuỳ ý vào thư gửi từ tên miền của chính mình.
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

    public void sendSurveyEmail(String toEmail, Long bookingId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Đánh giá trải nghiệm chuyến đi #" + bookingId + " - VigoTrip");

            String surveyUrl = frontendUrl + "/my-bookings?reviewBookingId=" + bookingId;

            String htmlContent = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #4f46e5, #3730a3); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #c7d2fe; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Khảo sát Chất lượng Dịch vụ</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Cảm ơn bạn đã đồng hành cùng VigoTrip!</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 16px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Hy vọng quý khách đã có một chuyến đi an toàn và thoải mái (Đơn vé <strong style='color: #4f46e5;'>#" + bookingId + "</strong>). Đánh giá chân thực của quý khách là động lực rất lớn giúp VigoTrip cải thiện chất lượng dịch vụ mỗi ngày.</p>"
                    
                    // Call to Action Box
                    + "<div style='text-align: center; margin: 32px 0;'>"
                    + "<a href='" + surveyUrl + "' style='background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);'>⭐ Viết đánh giá chuyến đi</a>"
                    + "</div>"

                    + "<p style='font-size: 13.5px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Vui lòng bấm nút trên để quay về trang Lịch sử đặt vé và gửi nhận xét đánh giá số sao trực tiếp cho chuyến đi này.</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(htmlContent, true);
            mailSender.send(message);
            
            log.info("Survey email sent successfully to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send survey email to {}", toEmail, e);
        }
    }

    public void sendTripDelayEmail(String toEmail, String route, String oldDeparture, String newDeparture, String reason) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Thông báo thay đổi giờ khởi hành - VigoTrip");

            String html = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #f59e0b, #d97706); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #fef3c7; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Cập nhật Lịch trình Chuyến đi</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Thông báo Điều chỉnh giờ khởi hành</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Chuyến đi tuyến <strong style='color: #2563eb;'>" + route + "</strong> mà quý khách đã đặt vé có sự thay đổi về giờ khởi hành:</p>"
                    
                    // Detail Box
                    + "<div style='background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px;'>"
                    + "<p style='margin: 0; font-size: 14px; color: #78350f;'><b>Giờ khởi hành cũ:</b> <s style='color: #ef4444;'>" + oldDeparture + "</s></p>"
                    + "<p style='margin: 0; font-size: 15px; color: #78350f;'><b>Giờ khởi hành mới:</b> <strong style='color: #16a34a; font-size: 16px;'>" + newDeparture + "</strong></p>"
                    + "<p style='margin: 0; font-size: 14px; color: #78350f;'><b>Lý do điều chỉnh:</b> " + reason + "</p>"
                    + "</div>"

                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 16px;'>Chúng tôi chân thành cáo lỗi cùng quý khách vì sự thay đổi này. Vé của quý khách vẫn giữ nguyên giá trị sử dụng cho giờ khởi hành mới.</p>"
                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Nếu thời gian mới không phù hợp, quý khách có thể vào mục <a href='" + frontendUrl + "/my-bookings' style='color: #2563eb; font-weight: 700;'>Quản lý vé</a> để gửi yêu cầu hoàn hủy miễn phí 100%.</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Trip delay email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip delay email to {}", toEmail, e);
        }
    }

    public void sendTripCancelledEmail(String toEmail, Long bookingId, String route, Double refundAmount) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Thông báo hủy chuyến đi - VigoTrip");

            String html = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #dc2626, #991b1b); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #fecaca; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Thông báo Sự cố Lịch trình</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Thông báo Chuyến đi bị hủy</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Rất tiếc, chuyến đi tuyến <strong style='color: #dc2626;'>" + route + "</strong> (Đơn vé <strong style='color: #2563eb;'>#" + bookingId + "</strong>) đã bị nhà vận hành thông báo hủy do sự cố bất khả kháng.</p>"
                    
                    // Refund Info Box
                    + "<div style='background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 6px;'>"
                    + "<span style='font-size: 13px; color: #991b1b; font-weight: 700; text-transform: uppercase;'>Thông tin hoàn tiền</span>"
                    + "<span style='font-size: 26px; font-weight: 800; color: #16a34a;'>" + String.format("%,.0f đ", refundAmount) + "</span>"
                    + "<span style='font-size: 13px; color: #b91c1c;'>Hoàn tiền 100% chi phí cho sự cố chuyến đi.</span>"
                    + "</div>"

                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 16px;'>Số tiền trên sẽ được hệ thống xử lý hoàn trả tự động trong vòng 3 - 5 ngày làm việc.</p>"
                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Quý khách có thể truy cập <a href='" + frontendUrl + "' style='color: #2563eb; font-weight: 700;'>VigoTrip</a> để tìm kiếm và đặt chuyến đi thay thế khác.</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Trip cancelled email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip cancelled email to {}", toEmail, e);
        }
    }

    public void sendTripReminderEmail(String toEmail, Long bookingId, String route, String departureTime) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Nhắc lịch: Chuyến đi của bạn sắp khởi hành - VigoTrip");

            String html = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #93c5fd; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Nhắc Lịch Khởi Hành</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Chuyến đi của bạn sắp khởi hành</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>VigoTrip xin thông báo chuyến đi của quý khách sẽ khởi hành trong vòng <strong>12 giờ tới</strong>. Chi tiết thông tin đơn vé:</p>"
                    
                    // Schedule Box
                    + "<div style='background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px;'>"
                    + "<p style='margin: 0; font-size: 14px; color: #1e3a8a;'><b>Mã đơn vé:</b> <strong style='color: #2563eb;'>#" + bookingId + "</strong></p>"
                    + "<p style='margin: 0; font-size: 14px; color: #1e3a8a;'><b>Tuyến đường:</b> " + route + "</p>"
                    + "<p style='margin: 0; font-size: 15px; color: #1e3a8a;'><b>Giờ khởi hành:</b> <strong style='color: #dc2626; font-size: 16px;'>" + departureTime + "</strong></p>"
                    + "</div>"

                    + "<div style='background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; margin-bottom: 28px; border-radius: 0 8px 8px 0; color: #b45309; font-size: 13.5px; line-height: 1.5;'>"
                    + "<b>Lưu ý quan trọng:</b> Quý khách vui lòng có mặt tại điểm đón/bến trước ít nhất 30 phút để hoàn tất các thủ tục check-in."
                    + "</div>"

                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Kính chúc quý khách có một chuyến đi an toàn và thượng lộ bình an!</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Trip reminder email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip reminder email to {}", toEmail, e);
        }
    }

    public void sendRefundApprovedEmail(String toEmail, Long refundId, Long bookingId, java.math.BigDecimal amount) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Yêu cầu hoàn vé đã được chấp nhận - VigoTrip");

            String html = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; tracking-style: tight;'>VigoTrip</h1>"
                    + "<p style='color: #93c5fd; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Hệ thống Đặt vé & Du lịch Thông minh</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Yêu cầu hoàn vé thành công</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Yêu cầu hoàn vé của quý khách cho đơn vé <strong style='color: #2563eb;'>#" + bookingId + "</strong> đã được nhà cung cấp kiểm tra và <strong>chấp nhận hoàn tiền</strong>.</p>"
                    
                    // Amount Highlight Box
                    + "<div style='background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 6px;'>"
                    + "<span style='font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;'>Số tiền hoàn lại</span>"
                    + "<span style='font-size: 28px; font-weight: 800; color: #16a34a;'>" + String.format("%,.0f đ", amount) + "</span>"
                    + "</div>"

                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 16px;'>Số tiền này sẽ được hoàn về phương thức thanh toán ban đầu của quý khách trong vòng <strong>3 - 5 ngày làm việc</strong> (tùy thuộc vào chính sách xử lý của ngân hàng).</p>"
                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 28px;'>Cảm ơn quý khách đã tin tưởng đồng hành cùng <strong>VigoTrip</strong>. Chúng tôi rất hân hạnh được tiếp tục phục vụ quý khách trong những chuyến đi tiếp theo.</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Refund approved email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send refund approved email to {}", toEmail, e);
        }
    }

    public void sendRefundRejectedEmail(String toEmail, Long refundId, Long bookingId, String note) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Thông báo về yêu cầu hoàn vé - VigoTrip");

            String html = "<div style='font-family: \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;'>"
                    + "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;'>"
                    
                    // Header Brand
                    + "<div style='background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px 32px; text-align: left;'>"
                    + "<h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;'>VigoTrip</h1>"
                    + "<p style='color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;'>Hệ thống Đặt vé & Du lịch Thông minh</p>"
                    + "</div>"

                    // Content Body
                    + "<div style='padding: 32px;'>"
                    + "<h2 style='color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;'>Thông báo Yêu cầu hoàn vé</h2>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;'>Xin chào quý khách,</p>"
                    + "<p style='font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;'>Rất tiếc, yêu cầu hoàn vé của quý khách cho đơn vé <strong style='color: #2563eb;'>#" + bookingId + "</strong> chưa thể phê duyệt do nhà cung cấp từ chối.</p>"
                    
                    // Reject Reason Box
                    + "<div style='background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;'>"
                    + "<span style='font-size: 13px; color: #991b1b; font-weight: 700; display: block; margin-bottom: 6px;'>Lý do từ chối</span>"
                    + "<span style='font-size: 14.5px; color: #dc2626; line-height: 1.5; font-weight: 500;'>" + (note != null && !note.trim().isEmpty() ? note : "Không đáp ứng điều kiện theo quy định chính sách hoàn hủy của nhà cung cấp.") + "</span>"
                    + "</div>"

                    + "<p style='font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 16px;'>Vé của quý khách hiện vẫn giữ nguyên giá trị sử dụng bình thường. Xin vui lòng liên hệ bộ phận CSKH VigoTrip nếu cần hỗ trợ thêm thông tin.</p>"

                    // Footer Signature
                    + "<div style='border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6;'>"
                    + "Trân trọng,<br/>"
                    + "<strong style='color: #475569; font-size: 14px;'>Đội ngũ VigoTrip</strong>"
                    + "</div>"

                    + "</div>"
                    + "</div>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Refund rejected email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send refund rejected email to {}", toEmail, e);
        }
    }
}
