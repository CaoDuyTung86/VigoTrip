package com.booking.api.service;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.*;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.mapper.BookingMapper;
import com.booking.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.booking.api.controller.SeatStatusController.SeatStatusUpdate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private static final int CANCEL_HOURS_CUTOFF = 4;
    private static final double REFUND_PERCENTAGE_24H = 0.9;

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final TripRepository tripRepository;
    private final SeatRepository seatRepository;
    private final TicketRepository ticketRepository;
    private final AdditionalServiceRepository additionalServiceRepository;
    private final BookingMapper bookingMapper;
    private final EmailService emailService;
    private final VoucherService voucherService;
    private final SeatLockService seatLockService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ReviewRepository reviewRepository;

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public BookingResponse createBooking(String email, BookingRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Trip trip = tripRepository.findById(request.getTripId())
                .orElseThrow(() -> new ResourceNotFoundException("Chuyến đi", request.getTripId()));

        if (trip.getDepartureTime().isBefore(LocalDateTime.now())) {
            throw new BookingException("Không thể đặt vé cho chuyến đi đã khởi hành.");
        }

        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new BookingException("Vui lòng chọn ít nhất 1 chỗ ngồi/giường.");
        }

        long distinctSeats = request.getSeatIds().stream().distinct().count();
        if (distinctSeats != request.getSeatIds().size()) {
            throw new BookingException("Danh sách chỗ ngồi có chứa dữ liệu trùng lặp.");
        }

        List<Ticket> tickets = new ArrayList<>();
        java.math.BigDecimal totalPrice = java.math.BigDecimal.ZERO;

        for (int i = 0; i < request.getSeatIds().size(); i++) {
            Long seatId = request.getSeatIds().get(i);
            Seat seat = seatRepository.findByIdWithLock(seatId)
                    .orElseThrow(() -> new ResourceNotFoundException("Ghế", seatId));

            if (ticketRepository.existsByTripIdAndSeatId(trip.getId(), seat.getId())) {
                throw new BookingException("Ghế " + seat.getSeatNumber() + " đã được đặt cho chuyến này");
            }

            String lockedBy = seatLockService.getLockedBy(seatId);
            if (lockedBy != null && !lockedBy.equals(user.getEmail())) {
                throw new BookingException(
                        "Ghế " + seat.getSeatNumber() + " đang được giữ bởi người khác. Vui lòng chọn ghế khác.");
            }

            java.math.BigDecimal seatPrice = trip.getPrice();
            if ("FLIGHT".equalsIgnoreCase(trip.getVehicle().getVehicleType())
                    || "AIRLINE".equalsIgnoreCase(trip.getVehicle().getVehicleType())
                    || "PLANE".equalsIgnoreCase(trip.getVehicle().getVehicleType())) {
                if ("BUSINESS".equalsIgnoreCase(seat.getSeatType())) {
                    seatPrice = seatPrice.multiply(java.math.BigDecimal.valueOf(2.5));
                }
            } else {
                if ("VIP".equalsIgnoreCase(seat.getSeatType())) {
                    seatPrice = seatPrice.multiply(java.math.BigDecimal.valueOf(2));
                } else if ("BUSINESS".equalsIgnoreCase(seat.getSeatType())) {
                    seatPrice = seatPrice.add(java.math.BigDecimal.valueOf(100000));
                } else if ("SLEEPER".equalsIgnoreCase(seat.getSeatType())) {
                    seatPrice = seatPrice.add(java.math.BigDecimal.valueOf(50000));
                }
            }

            Ticket ticket = new Ticket();
            ticket.setTrip(trip);
            ticket.setSeat(seat);
            ticket.setPrice(seatPrice);
            ticket.setStatus("ACTIVE");

            // Set tên hành khách
            if (request.getPassengerNames() != null && i < request.getPassengerNames().size()) {
                ticket.setPassengerName(request.getPassengerNames().get(i));
            } else {
                ticket.setPassengerName(user.getFullName());
            }

            tickets.add(ticket);

            totalPrice = totalPrice.add(seatPrice);
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setBookingDate(LocalDateTime.now());
        booking.setTotalPrice(totalPrice);
        booking.setStatus("PENDING");

        if (request.getAdditionalServiceIds() != null && !request.getAdditionalServiceIds().isEmpty()) {
            List<AdditionalService> services = additionalServiceRepository
                    .findAllById(request.getAdditionalServiceIds());
            booking.setAdditionalServices(services);
            java.math.BigDecimal servicesTotal = services.stream()
                    .map(s -> s.getPrice() != null ? s.getPrice() : java.math.BigDecimal.ZERO)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            booking.setTotalPrice(totalPrice.add(servicesTotal));
        } else {
            booking.setAdditionalServices(Collections.emptyList());
        }

        // Apply membership discount
        double discountPercent = UserService.getDiscount(user.getPoints() != null ? user.getPoints() : 0);
        if (discountPercent > 0) {
            java.math.BigDecimal discountAmount = booking.getTotalPrice()
                    .multiply(java.math.BigDecimal.valueOf(discountPercent / 100.0))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
            booking.setTotalPrice(booking.getTotalPrice().subtract(discountAmount));
        }

        // Apply voucher if provided
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            // Check if user has used this voucher code before (and not cancelled)
            boolean alreadyUsed = bookingRepository.existsByUserIdAndVoucherCodeAndStatusNot(user.getId(),
                    request.getVoucherCode(), "CANCELLED");
            if (alreadyUsed) {
                throw new BookingException("Bạn đã sử dụng mã giảm giá này cho một đơn hàng khác.");
            }

            java.util.Map<String, Object> validation = voucherService.validateVoucher(request.getVoucherCode(),
                    booking.getTotalPrice());
            if (Boolean.TRUE.equals(validation.get("valid"))) {
                java.math.BigDecimal discount = (java.math.BigDecimal) validation.get("discountAmount");
                java.math.BigDecimal newTotal = booking.getTotalPrice().subtract(discount);
                booking.setTotalPrice(newTotal.compareTo(java.math.BigDecimal.ZERO) < 0
                        ? java.math.BigDecimal.ZERO : newTotal);

                // Track usage (at this stage it's locked to this booking)
                Long voucherId = (Long) validation.get("voucherId");
                voucherService.useVoucher(voucherId);
                booking.setVoucherCode(request.getVoucherCode()); // Store it to prevent reuse
            } else {
                throw new BookingException((String) validation.get("message"));
            }
        }

        // Final price consistency check
        if (booking.getTotalPrice() == null || booking.getTotalPrice().compareTo(java.math.BigDecimal.ZERO) < 0) {
            booking.setTotalPrice(java.math.BigDecimal.ZERO);
        }

        for (Ticket ticket : tickets) {
            ticket.setBooking(booking);
        }
        booking.setTickets(tickets);

        bookingRepository.save(booking);

        // Remove locks and broadcast BOOKED status
        for (Long seatId : request.getSeatIds()) {
            seatLockService.removeLockBySeatId(seatId);
            SeatStatusUpdate update = new SeatStatusUpdate(trip.getId(), seatId, "BOOKED", user.getEmail());
            messagingTemplate.convertAndSend("/topic/seat-status", update);
        }

        return bookingMapper.toBookingResponse(booking, trip);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        List<Booking> bookings = bookingRepository.findByUserIdWithDetails(user.getId());

        return bookings.stream()
                .map(booking -> {
                    Trip trip = extractTripFromBooking(booking);
                    BookingResponse res = bookingMapper.toBookingResponse(booking, trip);
                    res.setHasReviewed(reviewRepository.existsByBookingId(booking.getId()));
                    return res;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(String email, Long bookingId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền xem booking này");
        }

        Trip trip = extractTripFromBooking(booking);

        return bookingMapper.toBookingResponse(booking, trip);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public BookingResponse cancelBooking(String email, Long bookingId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền hủy booking này");
        }

        if ("CANCELLED".equals(booking.getStatus())) {
            throw new BookingException("Booking này đã được hủy trước đó");
        }

        Trip trip = extractTripFromBooking(booking);

        if (trip != null) {
            LocalDateTime now = LocalDateTime.now();
            long hoursUntilDeparture = java.time.temporal.ChronoUnit.HOURS.between(now, trip.getDepartureTime());

            if ("PAID".equals(booking.getStatus()) || "CONFIRMED".equals(booking.getStatus())) {
                if (hoursUntilDeparture < CANCEL_HOURS_CUTOFF) {
                    throw new BookingException(
                            "Không thể hủy/hoàn vé khi chỉ còn dưới 4 tiếng là khởi hành hoặc xe đã chạy");
                }

                java.math.BigDecimal refundAmount;
                if (hoursUntilDeparture > 24) {
                    refundAmount = booking.getTotalPrice(); // Hoàn 100%
                } else {
                    refundAmount = booking.getTotalPrice()
                            .multiply(java.math.BigDecimal.valueOf(REFUND_PERCENTAGE_24H))
                            .setScale(2, java.math.RoundingMode.HALF_UP); // Phạt 10%, hoàn 90%
                }

                Refund refund = new Refund();
                refund.setBooking(booking);
                refund.setRefundAmount(refundAmount);
                refund.setRefundDate(now);
                refund.setStatus("COMPLETED");

                if (booking.getRefunds() == null) {
                    booking.setRefunds(new java.util.ArrayList<>());
                }
                booking.getRefunds().add(refund);
            }
        }

        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);

        if (booking.getTickets() != null) {
            for (Ticket t : booking.getTickets()) {
                if (t.getSeat() != null) {
                    SeatStatusUpdate update = new SeatStatusUpdate(
                        trip != null ? trip.getId() : t.getTrip().getId(),
                        t.getSeat().getId(),
                        "AVAILABLE",
                        null
                    );
                    messagingTemplate.convertAndSend("/topic/seat-status", update);
                }
            }
        }

        return bookingMapper.toBookingResponse(booking, trip);
    }

    @Transactional
    public BookingResponse completeBooking(String email, Long bookingId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền thao tác trên booking này");
        }

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new BookingException("Chỉ có thể hoàn thành chuyến đi với vé đã xác nhận (CONFIRMED)");
        }

        booking.setStatus("COMPLETED");
        bookingRepository.save(booking);

        // Điểm thành viên đã được tích khi thanh toán thành công (PaymentService.processSuccessfulPayment).
        // KHÔNG tích điểm ở đây để tránh tích 2 lần cho cùng 1 booking.

        try {
            emailService.sendSurveyEmail(user.getEmail(), booking.getId());
        } catch (Exception e) {
            log.error("Failed to send survey email for booking: {}", booking.getId(), e);
        }

        Trip trip = extractTripFromBooking(booking);

        return bookingMapper.toBookingResponse(booking, trip);
    }

    /** Hủy 1 vé riêng lẻ trong booking */
    @Transactional
    public BookingResponse cancelTicket(String email, Long bookingId, Long ticketId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền hủy vé trong booking này");
        }

        Ticket ticketToCancel = booking.getTickets().stream()
                .filter(t -> t.getId().equals(ticketId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vé trong booking này"));

        if ("CANCELLED".equals(ticketToCancel.getStatus())) {
            throw new BookingException("Vé này đã được hủy trước đó");
        }

        // Hủy vé
        ticketToCancel.setStatus("CANCELLED");
        ticketRepository.save(ticketToCancel);

        if (ticketToCancel.getSeat() != null) {
            SeatStatusUpdate update = new SeatStatusUpdate(
                ticketToCancel.getTrip().getId(),
                ticketToCancel.getSeat().getId(),
                "AVAILABLE",
                null
            );
            messagingTemplate.convertAndSend("/topic/seat-status", update);
        }

        // Trừ giá vé khỏi tổng
        if (ticketToCancel.getPrice() != null) {
            java.math.BigDecimal currentTotal = booking.getTotalPrice() != null
                    ? booking.getTotalPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal newTotal = currentTotal.subtract(ticketToCancel.getPrice());
            booking.setTotalPrice(newTotal.compareTo(java.math.BigDecimal.ZERO) < 0
                    ? java.math.BigDecimal.ZERO : newTotal);
        }

        // Nếu tất cả vé đều CANCELLED thì hủy cả booking
        boolean allCancelled = booking.getTickets().stream()
                .allMatch(t -> "CANCELLED".equals(t.getStatus()));
        if (allCancelled) {
            booking.setStatus("CANCELLED");
        }

        bookingRepository.save(booking);

        Trip trip = extractTripFromBooking(booking);

        return bookingMapper.toBookingResponse(booking, trip);
    }

    @Transactional
    public BookingResponse checkIn(Long bookingId, String performedBy) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        if (!"PAID".equals(booking.getStatus()) && !"CONFIRMED".equals(booking.getStatus())) {
            throw new BookingException("Vé chưa thanh toán hoặc đã bị hủy, không thể check-in.");
        }

        if (Boolean.TRUE.equals(booking.getIsCheckedIn())) {
            throw new BookingException("Vé này đã được check-in vào lúc " + booking.getCheckInDate());
        }

        booking.setIsCheckedIn(true);
        booking.setCheckInDate(LocalDateTime.now());
        bookingRepository.save(booking);

        log.info("[CheckIn] Booking #{} checked-in bởi {} lúc {}", bookingId, performedBy, booking.getCheckInDate());

        Trip trip = extractTripFromBooking(booking);

        return bookingMapper.toBookingResponse(booking, trip);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getRecentCheckIns(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        org.springframework.data.domain.Pageable top10 = org.springframework.data.domain.PageRequest.of(0, 10);
        List<Booking> bookings = bookingRepository.findRecentCheckInsAdmin(top10);

        return bookings.stream()
                .map(booking -> {
                    Trip trip = extractTripFromBooking(booking);
                    return bookingMapper.toBookingResponse(booking, trip);
                })
                .collect(Collectors.toList());
    }

    private Trip extractTripFromBooking(Booking booking) {
        if (booking.getTickets() != null && !booking.getTickets().isEmpty()) {
            return booking.getTickets().get(0).getTrip();
        }
        return null;
    }
}
