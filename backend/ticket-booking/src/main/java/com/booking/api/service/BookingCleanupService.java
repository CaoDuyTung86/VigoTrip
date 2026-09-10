package com.booking.api.service;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.repository.BookingRepository;
import com.booking.api.realtime.SeatStatusBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
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

    /**
     * Số đơn được đối chiếu với cổng trong một lượt dọn.
     *
     * Không còn là để giữ chỗ trong pool connection: lời gọi ra cổng giờ nằm ngoài mọi
     * transaction. Thứ hạn mức này còn chặn là ĐỘ DÀI của một lượt. Mỗi đơn tốn tới 9 giây
     * chờ cổng, mà bộ lập lịch mặc định của Spring chỉ có một luồng, nên một lượt dọn kéo dài
     * là mọi job theo lịch khác phải xếp hàng chờ sau nó. Phần bị bỏ qua vẫn đang PENDING nên
     * lượt sau (một phút sau) sẽ nhặt tiếp — không mất đơn nào.
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
    private final SeatStatusBroadcaster seatStatusBroadcaster;
    private final VoucherService voucherService;
    private final PaymentService paymentService;
    private final PendingBookingSignal pendingBookingSignal;

    /**
     * Chính bean này, lấy qua proxy của Spring.
     *
     * {@code cancelUnpaidBookings()} cố ý KHÔNG có transaction, nhưng ba bước nó gọi thì có.
     * Gọi thẳng chúng từ trong lớp là đi tắt qua proxy và {@code @Transactional} mất tác dụng —
     * nghĩa là {@code releaseSeats} nổ LazyInitializationException, và khóa dòng trong
     * {@code settleExpiredBooking} biến mất. ObjectProvider tra cứu lười nên không tạo vòng phụ
     * thuộc lúc khởi tạo.
     */
    private final ObjectProvider<BookingCleanupService> self;

    /**
     * Điểm vào theo lịch. Chạy mỗi 1 phút, nhưng chỉ chạm DB khi có thể còn việc để làm —
     * xem {@link PendingBookingSignal} để biết vì sao một câu SELECT mỗi phút lại là tiền.
     */
    @Scheduled(fixedRate = 60000)
    public void sweepExpiredBookingsIfNeeded() {
        if (!pendingBookingSignal.shouldSweep()) {
            return;
        }
        long token = pendingBookingSignal.beginSweep();
        if (!cancelUnpaidBookings()) {
            pendingBookingSignal.markNoPendingLeft(token);
        }
    }

    /**
     * Một lượt dọn. Trả về {@code true} nếu DB VẪN còn ít nhất một đơn PENDING sau lượt này
     * (kể cả đơn chưa quá hạn), tức là lượt sau vẫn còn việc.
     *
     * KHÔNG có transaction ở tầng này, và đó là điểm mấu chốt. Mỗi đơn đi qua ba bước tách
     * rời — đọc manh mối, hỏi cổng, ghi kết quả — trong đó chỉ bước đầu và bước cuối chạm CSDL,
     * mỗi bước một transaction ngắn của riêng nó. Trước đây cả ba nằm chung một transaction
     * dài, nên chín giây chờ cổng của MỖI đơn là chín giây giữ một chỗ trong pool mười chỗ.
     */
    public boolean cancelUnpaidBookings() {
        BookingCleanupService tx = self.getObject();
        List<Long> expired = tx.findExpiredPendingIds();
        if (!expired.isEmpty()) {
            log.info("Found {} expired PENDING bookings. Canceling...", expired.size());
        }

        int examined = 0;
        for (Long bookingId : expired) {
            // Đếm số đơn ĐÃ ĐEM ĐI HỎI CỔNG, không phải số đơn bị hủy: đơn được cứu hoặc đơn
            // đang giữ lại cũng đã tốn một lời gọi ra ngoài rồi, và chính lời gọi đó là thứ
            // hạn mức này sinh ra để chặn.
            if (examined >= MAX_BOOKINGS_PER_RUN) {
                log.warn("Còn {} đơn quá hạn chưa đối chiếu trong lượt này, để lượt sau.",
                        expired.size() - examined);
                break;
            }
            examined++;

            // Ba bước, và lời gọi ra cổng nằm ở giữa — ngoài mọi transaction.
            List<PaymentService.SweepProbe> probes = paymentService.planSweep(bookingId);
            List<PaymentService.SweepAnswer> answers = paymentService.askGateway(probes);
            tx.settleExpiredBooking(bookingId, answers);
        }
        return tx.anyPendingLeft();
    }

    /**
     * Mã của những đơn đáng đem đi đối chiếu, đọc trong một transaction chỉ-đọc thật ngắn.
     *
     * Trả về mã chứ không trả về entity: giữa lúc đọc và lúc ghi có cả một quãng gọi mạng, mà
     * một entity mang qua quãng đó là entity đã rời khỏi session và mang dữ liệu có thể đã cũ.
     */
    @Transactional(readOnly = true)
    public List<Long> findExpiredPendingIds() {
        LocalDateTime now = LocalDateTime.now();
        return bookingRepository
                .findExpiredPendingBookings(now.minusMinutes(PENDING_HOLD_MINUTES), now)
                .stream()
                .map(Booking::getId)
                .toList();
    }

    /**
     * Chốt số phận một đơn quá hạn, dựa trên những gì cổng vừa trả lời.
     *
     * Đọc lại đơn kèm khóa dòng chứ không dùng lại bản đọc ở bước đầu: trong lúc ta hỏi cổng,
     * một callback thật có thể đã về và xác nhận chính đơn này, hoặc khách có thể vừa mở một
     * phiên thanh toán mới. Khóa dòng bắt lượt này xếp hàng sau họ, và hai phép kiểm tra ngay
     * sau đó thấy được kết quả đã commit.
     */
    @Transactional
    public void settleExpiredBooking(Long bookingId, List<PaymentService.SweepAnswer> answers) {
        LocalDateTime now = LocalDateTime.now();
        Booking booking = bookingRepository.findByIdForUpdate(bookingId).orElse(null);
        if (booking == null || !"PENDING".equals(booking.getStatus()) || !stillExpired(booking, now)) {
            return;
        }

        PaymentService.SweepResult sweep = paymentService.applySweepAnswers(booking, answers);
        if (sweep == PaymentService.SweepResult.RECOVERED) {
            return;
        }
        if (sweep == PaymentService.SweepResult.HOLD) {
            if (!heldTooLong(booking, now)) {
                return;
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
        bookingRepository.save(booking);
    }

    /**
     * Đơn CÒN đáng bị dọn không, hỏi lại ngay trước khi hủy.
     *
     * Đây là bản dựng lại bằng Java của đúng điều kiện trong {@code findExpiredPendingBookings}
     * — hai chỗ này phải sửa cùng nhau. Cần hỏi lại vì giữa lúc câu query kia chạy và lúc ta
     * cầm khóa dòng có cả quãng chờ cổng, đủ để khách bấm sang cổng lần nữa và mở một phiên
     * thanh toán mới. Hủy đơn lúc đó là hủy đúng đơn khách đang trả tiền.
     */
    private boolean stillExpired(Booking booking, LocalDateTime now) {
        LocalDateTime bookingDate = booking.getBookingDate();
        if (bookingDate == null || !bookingDate.isBefore(now.minusMinutes(PENDING_HOLD_MINUTES))) {
            return false;
        }
        LocalDateTime paymentExpiresAt = booking.getPaymentExpiresAt();
        return paymentExpiresAt == null || paymentExpiresAt.isBefore(now);
    }

    /**
     * Còn đơn PENDING nào trong DB không.
     *
     * Transaction riêng, chạy sau khi mọi đơn của lượt này đã commit, nên số đếm không tính
     * lại chính những đơn ta vừa chuyển sang CANCELLED.
     */
    @Transactional(readOnly = true)
    public boolean anyPendingLeft() {
        return bookingRepository.countByStatus("PENDING") > 0;
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
            seatStatusBroadcaster.available(t.getTrip().getId(), t.getSeat().getId());
        }
    }
}
