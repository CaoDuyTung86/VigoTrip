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

    private final BookingRepository bookingRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VoucherService voucherService;

    // Chạy mỗi 1 phút một lần
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cancelUnpaidBookings() {
        // Tìm các booking trạng thái PENDING tạo cách đây hơn 5 phút
        LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(5);
        List<Booking> expiredBookings = bookingRepository.findByStatusAndBookingDateBefore("PENDING", cutoffTime);

        if (!expiredBookings.isEmpty()) {
            log.info("Found {} expired PENDING bookings. Canceling...", expiredBookings.size());
            for (Booking booking : expiredBookings) {
                booking.setStatus("CANCELLED");
                // Giải phóng ghế qua WebSocket
                if (booking.getTickets() != null) {
                    for (Ticket t : booking.getTickets()) {
                        if (t.getSeat() != null) {
                            SeatStatusUpdate update = new SeatStatusUpdate(
                                t.getTrip().getId(),
                                t.getSeat().getId(),
                                "AVAILABLE",
                                null
                            );
                            messagingTemplate.convertAndSend("/topic/seat-status", update);
                        }
                    }
                }

                // Hoàn lại lượt sử dụng voucher vì đơn hàng chưa thanh toán thành công
                if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
                    voucherService.refundVoucherUsage(booking.getVoucherCode());
                    log.info("Refunded voucher usage for code {} (booking {} expired unpaid).",
                            booking.getVoucherCode(), booking.getId());
                }
            }
            bookingRepository.saveAll(expiredBookings);
        }
    }
}
