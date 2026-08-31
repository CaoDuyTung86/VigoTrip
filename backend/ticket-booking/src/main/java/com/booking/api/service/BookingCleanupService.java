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
import java.util.ArrayList;
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

    /**
     * Số đơn được đối chiếu với cổng trong một lượt dọn.
     *
     * Mỗi lần đối chiếu là một lời gọi HTTP ra ngoài (3s kết nối + 6s đọc) nằm trong chính
     * transaction của lượt dọn, tức là mỗi giây chờ là một giây giữ connection DB. Không chặn
     * lại thì một đợt dồn đơn có thể khoá pool suốt nhiều phút. Phần bị bỏ qua vẫn đang
     * PENDING nên lượt sau (một phút sau) sẽ nhặt tiếp — không mất đơn nào.
     */
    private static final int MAX_BOOKINGS_PER_RUN = 20;

    /**
     * Quá ngần này phút mà vẫn không hỏi được cổng thì hủy đơn, chấp nhận rủi ro.
     *
     * Đây là một đánh đổi có ý thức chứ không phải con số tuỳ tiện: giữ đơn vô thời hạn nghĩa
     * là ghế bị khoá vĩnh viễn mỗi khi cổng chết, còn hủy sớm thì có nguy cơ hủy một đơn đã
     * bị trừ tiền. Một giờ đủ dài để cổng hồi phục qua vài chục lượt thử, và mỗi lần buộc
     * phải hủy kiểu này đều ghi ERROR để còn đối chiếu tay với sao kê.
     */
    private static final int SWEEP_GIVE_UP_MINUTES = 60;

    private final BookingRepository bookingRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VoucherService voucherService;
    private final PaymentService paymentService;

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

        // Chỉ những đơn THẬT SỰ bị hủy mới được lưu lại: đơn vừa được cổng xác nhận đã trở
        // thành CONFIRMED, ghi đè nó bằng CANCELLED là làm đúng cái việc mà cả thay đổi này
        // sinh ra để ngăn.
        List<Booking> cancelled = new ArrayList<>();

        int examined = 0;
        for (Booking booking : expiredBookings) {
            // Đếm số đơn ĐÃ ĐEM ĐI HỎI CỔNG, không phải số đơn bị hủy: đơn được cứu hoặc đơn
            // đang giữ lại cũng đã tốn một lời gọi ra ngoài rồi, và chính lời gọi đó là thứ
            // hạn mức này sinh ra để chặn.
            if (examined >= MAX_BOOKINGS_PER_RUN) {
                log.warn("Còn {} đơn quá hạn chưa đối chiếu trong lượt này, để lượt sau.",
                        expiredBookings.size() - examined);
                break;
            }
            examined++;

            // Hỏi cổng trước khi hủy. Đơn PENDING quá hạn KHÔNG đồng nghĩa với chưa trả tiền:
            // khách có thể đã bị trừ tiền mà cổng chưa từng gọi được callback nào về.
            PaymentService.SweepResult sweep = paymentService.sweepExpiredBooking(booking);
            if (sweep == PaymentService.SweepResult.RECOVERED) {
                continue;
            }
            if (sweep == PaymentService.SweepResult.HOLD) {
                if (!heldTooLong(booking, now)) {
                    continue;
                }
                log.error("Đơn {} đã quá hạn hơn {} phút mà vẫn chưa hỏi được cổng VNPay. Hủy đơn để "
                                + "trả ghế, nhưng NẾU khách đã bị trừ tiền thì khoản đó chưa được ghi "
                                + "nhận — cần đối chiếu tay với sao kê.",
                        booking.getId(), SWEEP_GIVE_UP_MINUTES);
            }

            booking.setStatus("CANCELLED");
            releaseSeats(booking);

            // Hoàn lại lượt sử dụng voucher vì đơn hàng chưa thanh toán thành công
            if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
                voucherService.refundVoucherUsage(booking.getVoucherCode());
                log.info("Refunded voucher usage for code {} (booking {} expired unpaid).",
                        booking.getVoucherCode(), booking.getId());
            }
            cancelled.add(booking);
        }
        bookingRepository.saveAll(cancelled);
    }

    /**
     * Đã giữ đơn đủ lâu để thôi chờ cổng trả lời.
     *
     * Đếm từ lúc đơn HẾT HẠN chứ không phải từ lúc tạo đơn: "chờ cổng bao lâu" và "khách ngồi
     * nghĩ bao lâu" là hai quãng khác nhau. Cộng gộp thì một khách chần chừ 15 phút ở cổng tự
     * nhiên bị cắt mất 15 phút trong hạn mức chờ, mà chính đơn đó lại là đơn dễ đã bị trừ tiền
     * nhất.
     */
    private boolean heldTooLong(Booking booking, LocalDateTime now) {
        LocalDateTime expiredAt = expiryOf(booking);
        return expiredAt == null || expiredAt.isBefore(now.minusMinutes(SWEEP_GIVE_UP_MINUTES));
    }

    /** Mốc đơn hết hiệu lực: hạn phiên thanh toán nếu khách đã sang cổng, không thì hạn giữ chỗ. */
    private LocalDateTime expiryOf(Booking booking) {
        if (booking.getPaymentExpiresAt() != null) {
            return booking.getPaymentExpiresAt();
        }
        return booking.getBookingDate() == null
                ? null
                : booking.getBookingDate().plusMinutes(PENDING_HOLD_MINUTES);
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
