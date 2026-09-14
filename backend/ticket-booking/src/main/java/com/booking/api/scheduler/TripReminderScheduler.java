package com.booking.api.scheduler;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.repository.BookingRepository;
import com.booking.api.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TripReminderScheduler {

    private final BookingRepository bookingRepository;
    private final EmailService emailService;

    /**
     * Chạy mỗi giờ — Quét tất cả booking CONFIRMED chưa được gửi nhắc nhở và có giờ đi trong 12h tới.
     */
    @Scheduled(fixedRate = 3600000) // Mỗi 1 giờ
    public void sendTripReminders() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDateTime cutoffTime = now.plusHours(12);

        log.info("[Scheduler] Checking unreminded trip bookings departing before: {}", cutoffTime);

        // Lọc trực tiếp các booking CONFIRMED chưa gửi nhắc nhở có giờ đi <= now + 12h
        List<Booking> upcomingBookings = bookingRepository.findConfirmedBookingsForReminder(now, cutoffTime);

        int sent = 0;
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");

        for (Booking booking : upcomingBookings) {
            if (booking.getTickets() == null || booking.getTickets().isEmpty())
                continue;

            Ticket firstTicket = booking.getTickets().get(0);
            if (firstTicket.getTrip() == null || firstTicket.getTrip().getDepartureTime() == null)
                continue;

            // Câu truy vấn đã lọc tài khoản tắt thư nhắc. Kiểm lại ở đây vì lọt qua đó là gửi đúng
            // lá thư khách đã từ chối — và đứng TRƯỚC claimReminder, để bật lại kịp giờ thì vẫn nhận.
            if (booking.getUser() != null && Boolean.FALSE.equals(booking.getUser().getTripReminderOptIn()))
                continue;

            String route = firstTicket.getTrip().getRoute().getOrigin() + " → "
                    + firstTicket.getTrip().getRoute().getDestination();
            String departureStr = firstTicket.getTrip().getDepartureTime().format(fmt);
            // Nhắc chuyến là thông báo về chuyến đi -> gửi cho người liên hệ của đơn.
            String email = booking.resolveNotificationEmail();

            // Đánh dấu TRƯỚC khi gửi, bằng một câu UPDATE có điều kiện.
            // sendTripReminderEmail chạy @Async nên nó trả về ngay lập tức, mail còn nằm
            // trong hàng đợi; gửi xong mới ghi cờ thì giữa hai bước luôn có một khe mà lượt
            // quét khác (instance thứ hai, hoặc lượt chạy ngay sau khi deploy lại) chen vào
            // được và gửi thêm một mail nhắc nữa cho cùng một đơn.
            if (bookingRepository.claimReminder(booking.getId()) == 0) {
                continue; // đơn này đã có nơi khác nhận gửi
            }

            try {
                emailService.sendTripReminderEmail(email, booking.getId(), route, departureStr,
                        booking.resolveNotificationLocale());
                sent++;
            } catch (Exception e) {
                log.error("[Scheduler] Error sending reminder email for booking ID: {}", booking.getId(), e);
                // Chưa xếp được vào hàng đợi mail thì trả cờ lại, để lượt quét sau còn thử tiếp.
                booking.setReminderSent(false);
                bookingRepository.save(booking);
            }
        }

        log.info("[Scheduler] Successfully processed and sent {} trip reminder emails.", sent);
    }
}
