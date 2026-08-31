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

            String route = firstTicket.getTrip().getRoute().getOrigin() + " → "
                    + firstTicket.getTrip().getRoute().getDestination();
            String departureStr = firstTicket.getTrip().getDepartureTime().format(fmt);
            // Nhắc chuyến là thông báo về chuyến đi -> gửi cho người liên hệ của đơn.
            String email = booking.resolveNotificationEmail();

            try {
                emailService.sendTripReminderEmail(email, booking.getId(), route, departureStr);
                booking.setReminderSent(true);
                bookingRepository.save(booking);
                sent++;
            } catch (Exception e) {
                log.error("[Scheduler] Error sending reminder email for booking ID: {}", booking.getId(), e);
            }
        }

        log.info("[Scheduler] Successfully processed and sent {} trip reminder emails.", sent);
    }
}
