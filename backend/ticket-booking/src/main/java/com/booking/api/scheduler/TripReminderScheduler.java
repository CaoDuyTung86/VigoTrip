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
     * Chạy mỗi giờ — Quét tất cả booking CONFIRMED có chuyến khởi hành trong 24h tới
     * và gửi email nhắc nhở cho khách hàng.
     */
    @Scheduled(fixedRate = 3600000) // Mỗi 1 giờ
    public void sendTripReminders() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDateTime next24h = now.plusHours(24);

        log.info("[Scheduler] Checking trip reminders: {} → {}", now, next24h);

        // Lấy tất cả bookings CONFIRMED
        List<Booking> confirmedBookings = bookingRepository.findByStatusAndBookingDateBefore("CONFIRMED",
                LocalDateTime.now().plusYears(10)); // Lấy hết booking CONFIRMED

        int sent = 0;
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");

        for (Booking booking : confirmedBookings) {
            if (booking.getTickets() == null || booking.getTickets().isEmpty())
                continue;

            Ticket firstTicket = booking.getTickets().get(0);
            if (firstTicket.getTrip() == null || firstTicket.getTrip().getDepartureTime() == null)
                continue;

            LocalDateTime departure = firstTicket.getTrip().getDepartureTime();

            // Chỉ gửi nếu chuyến khởi hành trong khoảng 23h–25h tới (tránh gửi trùng)
            if (departure.isAfter(now.plusHours(23)) && departure.isBefore(now.plusHours(25))) {
                String route = firstTicket.getTrip().getRoute().getOrigin() + " → "
                        + firstTicket.getTrip().getRoute().getDestination();
                String departureStr = departure.format(fmt);
                String email = booking.getUser().getEmail();

                emailService.sendTripReminderEmail(email, booking.getId(), route, departureStr);
                sent++;
            }
        }

        log.info("[Scheduler] Sent {} trip reminder emails.", sent);
    }
}
