package com.booking.api.service;

import com.booking.api.dto.RefundRequest;
import com.booking.api.dto.RefundResponse;
import com.booking.api.entity.*;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RefundRepository;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefundService {

    // Cùng ngưỡng với BookingService.cancelBooking — hai đường hủy vé phải tuân theo
    // đúng một chính sách, không thì khách hủy qua đường này né được luật của đường kia.
    private static final int CANCEL_HOURS_CUTOFF = 4;
    private static final double REFUND_PERCENTAGE_24H = 0.9;

    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final VoucherService voucherService;
    private final PaymentLogService paymentLogService;

    /** User gửi yêu cầu hoàn tiền */
    @Transactional
    public RefundResponse requestRefund(String email, RefundRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền yêu cầu hoàn tiền cho booking này");
        }

        if ("CANCELLED".equals(booking.getStatus())) {
            throw new BookingException("Booking này đã bị hủy");
        }

        // Vé đã soát (lên xe/tàu/máy bay) coi như đã sử dụng dịch vụ — không được hoàn
        // tiền nữa dù còn cách giờ khởi hành bao lâu.
        if (Boolean.TRUE.equals(booking.getIsCheckedIn())) {
            throw new BookingException("Vé đã được check-in, không thể yêu cầu hoàn tiền.");
        }

        // Kiểm tra đã có yêu cầu PENDING chưa
        List<Refund> existingPending = refundRepository.findByBookingId(booking.getId())
                .stream().filter(r -> "PENDING".equals(r.getStatus())).toList();
        if (!existingPending.isEmpty()) {
            throw new BookingException("Đã có yêu cầu hoàn tiền đang chờ duyệt cho booking này");
        }

        java.math.BigDecimal refundAmount = booking.getTotalPrice();
        Trip trip = booking.getTickets() != null && !booking.getTickets().isEmpty()
                ? booking.getTickets().get(0).getTrip() : null;
        if (trip != null) {
            long hoursUntilDeparture = java.time.temporal.ChronoUnit.HOURS.between(
                    LocalDateTime.now(), trip.getDepartureTime());

            if (hoursUntilDeparture < CANCEL_HOURS_CUTOFF) {
                throw new BookingException(
                        "Không thể hủy/hoàn vé khi chỉ còn dưới 4 tiếng là khởi hành hoặc xe đã chạy");
            }

            if (hoursUntilDeparture <= 24) {
                refundAmount = refundAmount
                        .multiply(java.math.BigDecimal.valueOf(REFUND_PERCENTAGE_24H))
                        .setScale(2, java.math.RoundingMode.HALF_UP); // Phạt 10%, hoàn 90%
            }
        }

        Refund refund = new Refund();
        refund.setBooking(booking);
        refund.setRefundAmount(refundAmount);
        refund.setStatus("PENDING");
        refund.setReason(request.getReason());
        refund.setRequestedAt(LocalDateTime.now());

        Refund saved = refundRepository.save(refund);
        return toResponse(saved);
    }

    /** User xem danh sách yêu cầu của mình */
    @Transactional(readOnly = true)
    public List<RefundResponse> getMyRefunds(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));
        return refundRepository.findByUserId(user.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /** Provider/Admin xem tất cả yêu cầu hoàn tiền */
    @Transactional(readOnly = true)
    public List<RefundResponse> getAllRefunds() {
        return refundRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Provider duyệt hoàn tiền.
     *
     * @param actorEmail người bấm nút. Bắt buộc phải truyền vào và được ghi vào nhật ký giao
     *                   dịch: việc chuyển tiền hiện vẫn làm tay bên ngoài phần mềm, nên đây
     *                   là dấu vết DUY NHẤT trả lời được "ai đã đồng ý chi khoản này".
     */
    @Transactional
    public RefundResponse approveRefund(String actorEmail, Long refundId) {
        Refund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu hoàn tiền"));

        if (!"PENDING".equals(refund.getStatus())) {
            throw new BookingException("Yêu cầu này đã được xử lý");
        }

        refund.setStatus("APPROVED");
        refund.setRefundDate(LocalDateTime.now());

        // Cập nhật booking status
        Booking booking = refund.getBooking();
        // Đơn có thể đã ở trạng thái nhả voucher từ trước (hết hạn giữ chỗ, thanh toán hỏng);
        // khi đó lượt dùng đã được trả rồi, trả thêm lần nữa là đếm thiếu.
        boolean voucherAlreadyReleased =
                BookingRepository.VOUCHER_RELEASING_STATUSES.contains(booking.getStatus());
        booking.setStatus("CANCELLED");

        // Đơn đã hủy thì mã giảm giá được dùng lại — trả lại lượt dùng cho voucher.
        if (!voucherAlreadyReleased
                && booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
            voucherService.refundVoucherUsage(booking.getVoucherCode());
        }

        bookingRepository.save(booking);

        Refund saved = refundRepository.save(refund);
        log.info("Refund {} approved for booking {}", refundId, booking.getId());
        
        // Cố ý gửi về email TÀI KHOẢN, không phải người liên hệ của đơn: đây là chuyện
        // tiền nong với người đã trả tiền, còn người liên hệ chỉ là người cầm vé đi.
        emailService.sendRefundApprovedEmail(booking.getUser().getEmail(), saved.getId(), booking.getId(),
                saved.getRefundAmount(), booking.getUser().resolveLocale());

        paymentLogService.recordRefundDecision(PaymentLog.Channel.REFUND_APPROVE, booking.getId(),
                actorEmail, "APPROVED",
                "refundId=" + saved.getId() + "&amount=" + saved.getRefundAmount()
                        + "&reason=" + saved.getReason());

        return toResponse(saved);
    }

    /** Provider từ chối hoàn tiền. Xem {@link #approveRefund} về vai trò của {@code actorEmail}. */
    @Transactional
    public RefundResponse rejectRefund(String actorEmail, Long refundId, String note) {
        Refund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu hoàn tiền"));

        if (!"PENDING".equals(refund.getStatus())) {
            throw new BookingException("Yêu cầu này đã được xử lý");
        }

        refund.setStatus("REJECTED");
        refund.setProviderNote(note);
        refund.setRefundDate(LocalDateTime.now());

        Refund saved = refundRepository.save(refund);
        log.info("Refund {} rejected for booking {}", refundId, refund.getBooking().getId());
        
        // Cố ý gửi về email TÀI KHOẢN, không phải người liên hệ của đơn: đây là chuyện
        // tiền nong với người đã trả tiền, còn người liên hệ chỉ là người cầm vé đi.
        emailService.sendRefundRejectedEmail(refund.getBooking().getUser().getEmail(), saved.getId(),
                refund.getBooking().getId(), note, refund.getBooking().getUser().resolveLocale());

        paymentLogService.recordRefundDecision(PaymentLog.Channel.REFUND_REJECT,
                refund.getBooking().getId(), actorEmail, "REJECTED",
                "refundId=" + saved.getId() + "&amount=" + saved.getRefundAmount()
                        + "&note=" + note);

        return toResponse(saved);
    }

    private RefundResponse toResponse(Refund refund) {
        Booking booking = refund.getBooking();
        Trip trip = null;
        if (booking.getTickets() != null && !booking.getTickets().isEmpty()) {
            trip = booking.getTickets().get(0).getTrip();
        }

        return RefundResponse.builder()
                .id(refund.getId())
                .bookingId(booking.getId())
                .userName(booking.getUser().getFullName())
                .origin(trip != null && trip.getRoute() != null ? trip.getRoute().getOrigin() : "")
                .destination(trip != null && trip.getRoute() != null ? trip.getRoute().getDestination() : "")
                .vehicleType(trip != null && trip.getVehicle() != null ? trip.getVehicle().getVehicleType() : "")
                .providerName(trip != null && trip.getVehicle() != null && trip.getVehicle().getProvider() != null
                        ? trip.getVehicle().getProvider().getProviderName() : "")
                .totalPrice(booking.getTotalPrice())
                .refundAmount(refund.getRefundAmount())
                .reason(refund.getReason())
                .status(refund.getStatus())
                .providerNote(refund.getProviderNote())
                .requestedAt(refund.getRequestedAt())
                .refundDate(refund.getRefundDate())
                .build();
    }
}
