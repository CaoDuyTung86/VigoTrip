package com.booking.api.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendResetPasswordEmail(String toEmail, String otpCode) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Yêu cầu khôi phục mật khẩu - Datxe.com");

            String htmlContent = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #4f7cff;'>Khôi phục mật khẩu</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Bạn đã yêu cầu khôi phục mật khẩu tại hệ thống Datxe.com. Vui lòng sử dụng mã OTP gồm 6 chữ số dưới đây để tiếp tục:</p>"
                    + "<div style='background-color: #f4f7f6; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;'>"
                    + "<h1 style='letter-spacing: 5px; color: #333; margin: 0; font-size: 32px;'>" + otpCode + "</h1>"
                    + "</div>"
                    + "<p style='color: #d9534f; font-weight: bold;'>Lưu ý: Mã OTP này sẽ hết hạn sau 15 phút.</p>"
                    + "<p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ bộ phận hỗ trợ.</p>"
                    + "<hr style='border: 1px solid #eee; margin-top: 30px;'/>"
                    + "<p style='font-size: 12px; color: #888;'>Trân trọng,<br/>Đội ngũ Datxe.com</p>"
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
            helper.setSubject("Xác thực tài khoản của bạn - Datxe.com");

            String htmlContent = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #20c997;'>Chào mừng bạn đến với Datxe.com!</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Cảm ơn bạn đã đăng ký tài khoản tại hệ thống của chúng tôi. Vui lòng sử dụng mã xác nhận dưới đây để hoàn tất việc đăng ký:</p>"
                    + "<div style='background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;'>"
                    + "<h1 style='letter-spacing: 5px; color: #2f855a; margin: 0; font-size: 32px;'>" + otpCode + "</h1>"
                    + "</div>"
                    + "<p>Mã này có hiệu lực trong vòng 24 giờ.</p>"
                    + "<p>Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.</p>"
                    + "<hr style='border: 1px solid #eee; margin-top: 30px;'/>"
                    + "<p style='font-size: 12px; color: #888;'>Trân trọng,<br/>Đội ngũ Datxe.com</p>"
                    + "</div>";

            helper.setText(htmlContent, true);
            mailSender.send(message);
            
            log.info("Verification email sent successfully to {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}", toEmail, e);
            throw new RuntimeException("Lỗi máy chủ khi gửi email xác thực.");
        }
    }

    public void sendBookingConfirmation(String toEmail, Long bookingId, Double totalPrice, String seats) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Xác nhận đặt vé thành công #" + bookingId + " - Datxe.com");

            String htmlContent = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #4f7cff;'>Cảm ơn bạn đã đặt vé!</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Chúng tôi đã nhận được thanh toán và xác nhận đặt vé của bạn. Dưới đây là thông tin chi tiết:</p>"
                    + "<div style='background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;'>"
                    + "<p><strong>Mã Booking:</strong> #" + bookingId + "</p>"
                    + "<p><strong>Ghế đã đặt:</strong> " + (seats != null ? seats : "Không có") + "</p>"
                    + "<p><strong>Tổng thanh toán:</strong> <span style='color: #ff6b00; font-weight: bold;'>" + String.format("%,.0f đ", totalPrice) + "</span></p>"
                    + "</div>"
                    + "<div style='background-color: #eff6ff; border-left: 4px solid #4f7cff; padding: 10px 15px; margin: 20px 0;'>"
                    + "<strong>✨ Quà tặng đặc biệt:</strong><br/>"
                    + "Sử dụng mã giảm giá <strong>WELCOME20</strong> cho chuyến đi tiếp theo để nhận ưu đãi 20%!"
                    + "</div>"
                    + "<p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ tổng đài hỗ trợ.</p>"
                    + "<hr style='border: 1px solid #eee; margin-top: 30px;'/>"
                    + "<p style='font-size: 12px; color: #888;'>Trân trọng,<br/>Đội ngũ Datxe.com</p>"
                    + "</div>";

            helper.setText(htmlContent, true);
            mailSender.send(message);
            
            log.info("Booking confirmation email sent successfully to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send booking confirmation email to {}", toEmail, e);
        }
    }

    public void sendSurveyEmail(String toEmail, Long bookingId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("Đánh giá chuyến đi #" + bookingId + " - Datxe.com");

            String htmlContent = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #f59e0b;'>Bạn có hài lòng với chuyến đi?</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Hy vọng bạn đã có một trải nghiệm tuyệt vời cùng Datxe.com cho chuyến đi vừa qua (Mã Booking: #" + bookingId + ").</p>"
                    + "<p>Chúng tôi luôn nỗ lực cải thiện dịch vụ mỗi ngày và rất mong nhận được những góp ý, đánh giá chân thành từ bạn.</p>"
                    + "<div style='text-align: center; margin: 30px 0;'>"
                    + "<a href='http://localhost:5174/quan-ly-ve' style='background-color: #ff6b00; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;'>Đánh giá ngay</a>"
                    + "</div>"
                    + "<p>Xin chân thành cảm ơn thời gian của quý khách.</p>"
                    + "<hr style='border: 1px solid #eee; margin-top: 30px;'/>"
                    + "<p style='font-size: 12px; color: #888;'>Trân trọng,<br/>Đội ngũ Datxe.com</p>"
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
            helper.setSubject("⚠️ Thông báo: Chuyến đi của bạn bị hoãn giờ - Datxe.com");

            String html = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #f59e0b;'>⚠️ Chuyến đi của bạn bị điều chỉnh giờ</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Chuyến đi <strong>" + route + "</strong> mà bạn đã đặt vé có sự thay đổi lịch trình:</p>"
                    + "<div style='background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:16px; margin:20px 0;'>"
                    + "<p><b>Giờ khởi hành cũ:</b> <s style='color:#ef4444'>" + oldDeparture + "</s></p>"
                    + "<p><b>Giờ khởi hành mới:</b> <span style='color:#16a34a; font-weight:bold'>" + newDeparture + "</span></p>"
                    + "<p><b>Lý do:</b> " + reason + "</p>"
                    + "</div>"
                    + "<p>Chúng tôi xin lỗi vì sự bất tiện này. Vé của bạn vẫn có hiệu lực với giờ khởi hành mới.</p>"
                    + "<p>Nếu bạn không thể tham gia, vui lòng vào <a href='http://localhost:5174/quan-ly-ve'>trang quản lý vé</a> để hủy và nhận hoàn tiền 100%.</p>"
                    + "<hr/><p style='font-size:12px;color:#888;'>Trân trọng,<br>Đội ngũ Datxe.com</p></div>";

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
            helper.setSubject("❌ Thông báo: Chuyến đi của bạn bị hủy - Datxe.com");

            String html = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #ef4444;'>❌ Chuyến đi bị hủy</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Rất tiếc, chuyến đi <strong>" + route + "</strong> (Mã booking: #" + bookingId + ") đã bị hủy bởi nhà vận hành.</p>"
                    + "<div style='background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin:20px 0;'>"
                    + "<h3 style='color:#dc2626; margin-top:0;'>Thông tin hoàn tiền</h3>"
                    + "<p>Số tiền được hoàn: <strong style='color:#16a34a; font-size:18px;'>" + String.format("%,.0f đ", refundAmount) + "</strong></p>"
                    + "<p>Hoàn tiền 100% do chuyến đi bị hủy từ phía nhà vận hành.</p>"
                    + "</div>"
                    + "<p>Chúng tôi thành thật xin lỗi vì sự cố này và sẽ xử lý hoàn tiền trong vòng 3-5 ngày làm việc.</p>"
                    + "<p>Để đặt lại chuyến đi khác: <a href='http://localhost:5174'>Datxe.com</a></p>"
                    + "<hr/><p style='font-size:12px;color:#888;'>Trân trọng,<br>Đội ngũ Datxe.com</p></div>";

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
            helper.setSubject("🔔 Nhắc lịch: Chuyến đi của bạn sắp khởi hành! - Datxe.com");

            String html = "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;'>"
                    + "<h2 style='color: #4f7cff;'>🔔 Chuyến đi sắp khởi hành!</h2>"
                    + "<p>Xin chào,</p>"
                    + "<p>Chúng tôi muốn nhắc bạn rằng chuyến đi của bạn sẽ khởi hành trong vòng <strong>24 giờ tới</strong>:</p>"
                    + "<div style='background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0;'>"
                    + "<p style='margin: 5px 0;'><strong>📋 Mã Booking:</strong> #" + bookingId + "</p>"
                    + "<p style='margin: 5px 0;'><strong>🚌 Tuyến:</strong> " + route + "</p>"
                    + "<p style='margin: 5px 0;'><strong>🕐 Khởi hành:</strong> <span style='color: #dc2626; font-weight: bold;'>" + departureTime + "</span></p>"
                    + "</div>"
                    + "<div style='background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;'>"
                    + "<strong>💡 Lưu ý:</strong> Hãy đến bến/ga trước giờ khởi hành ít nhất 30 phút để làm thủ tục."
                    + "</div>"
                    + "<p>Chúc bạn có một chuyến đi an toàn và vui vẻ! 🎉</p>"
                    + "<hr style='border: 1px solid #eee; margin-top: 30px;'/>"
                    + "<p style='font-size: 12px; color: #888;'>Trân trọng,<br>Đội ngũ Datxe.com</p>"
                    + "</div>";

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Trip reminder email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send trip reminder email to {}", toEmail, e);
        }
    }
}
