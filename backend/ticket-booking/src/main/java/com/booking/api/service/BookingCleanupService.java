package com.booking.api.service;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.repository.BookingRepository;
import com.booking.api.controller.SeatStatusController.SeatStatusUpdate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCleanupService {

    /**
     * Thời gian giữ chỗ cho một đơn PENDING tính từ lúc tạo đơn. Hết ngần này mà chưa
     * bấm sang cổng thanh toán thì ghế được trả lại cho người khác.
     * Nếu người dùng đã sang cổng, {@link Booking#getPaymentExpiresAt()} sẽ gia hạn
     * (xem PaymentService.PAYMENT_WINDOW_MINUTES).
     */
    public static final int PENDING_HOLD_MINUTES = 5;

    private final BookingRepository bookingRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VoucherService voucherService;

    // Chạy mỗi 1 phút một lần
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cancelUnpaidBookings() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expiredBookings = bookingRepository.findExpiredPendingBookings(
                now.minusMinutes(PENDING_HOLD_MINUTES), now);

        if (expiredBookings.isEmpty()) {
            return;
        }

        log.info("Found {} expired PENDING bookings. Canceling...", expiredBookings.size());
        for (Booking booking : expiredBookings) {
            booking.setStatus("CANCELLED");
            releaseSeats(booking);

            // Hoàn lại lượt sử dụng voucher vì đơn hàng chưa thanh toán thành công
            if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
                voucherService.refundVoucherUsage(booking.getVoucherCode());
                log.info("Refunded voucher usage for code {} (booking {} expired unpaid).",
                        booking.getVoucherCode(), booking.getId());
            }
        }
        bookingRepository.saveAll(expiredBookings);
    }

    /** Báo cho mọi client đang xem sơ đồ ghế biết các ghế của đơn này đã được trả lại. */
    private void releaseSeats(Booking booking) {
        if (booking.getTickets() == null) {
            return;
        }
        for (Ticket t : booking.getTickets()) {
            if (t.getSeat() == null || t.getTrip() == null) {
                continue;
            }
            messagingTemplate.convertAndSend("/topic/seat-status",
                    new SeatStatusUpdate(t.getTrip().getId(), t.getSeat().getId(), "AVAILABLE", null));
        }
    }
}
