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

    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final VoucherService voucherService;

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

        // Kiểm tra đã có yêu cầu PENDING chưa
        List<Refund> existingPending = refundRepository.findByBookingId(booking.getId())
                .stream().filter(r -> "PENDING".equals(r.getStatus())).toList();
        if (!existingPending.isEmpty()) {
            throw new BookingException("Đã có yêu cầu hoàn tiền đang chờ duyệt cho booking này");
        }

        Refund refund = new Refund();
        refund.setBooking(booking);
        refund.setRefundAmount(booking.getTotalPrice());
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

    /** Provider duyệt hoàn tiền */
    @Transactional
    public RefundResponse approveRefund(Long refundId) {
        Refund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu hoàn tiền"));

        if (!"PENDING".equals(refund.getStatus())) {
            throw new BookingException("Yêu cầu này đã được xử lý");
        }

        refund.setStatus("APPROVED");
        refund.setRefundDate(LocalDateTime.now());

        // Cập nhật booking status
        Booking booking = refund.getBooking();
        booking.setStatus("CANCELLED");

        // Đơn đã hủy thì mã giảm giá được dùng lại — trả lại lượt dùng cho voucher.
        if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
            voucherService.refundVoucherUsage(booking.getVoucherCode());
        }

        bookingRepository.save(booking);

        Refund saved = refundRepository.save(refund);
        log.info("Refund {} approved for booking {}", refundId, booking.getId());
        
        emailService.sendRefundApprovedEmail(booking.getUser().getEmail(), saved.getId(), booking.getId(), saved.getRefundAmount());
        
        return toResponse(saved);
    }

    /** Provider từ chối hoàn tiền */
    @Transactional
    public RefundResponse rejectRefund(Long refundId, String note) {
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
        
        emailService.sendRefundRejectedEmail(refund.getBooking().getUser().getEmail(), saved.getId(), refund.getBooking().getId(), note);
        
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
