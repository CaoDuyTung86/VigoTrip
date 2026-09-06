package com.booking.api.service;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.*;
import com.booking.api.config.VoucherUsageConstraintInitializer;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.mapper.BookingMapper;
import com.booking.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import com.booking.api.realtime.SeatIdentity;
import com.booking.api.realtime.SeatStatusBroadcaster;

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
    private final SeatStatusBroadcaster seatStatusBroadcaster;
    private final ReviewRepository reviewRepository;
    private final PendingBookingSignal pendingBookingSignal;

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

        // Mỗi hành khách khai báo phải có đúng một chỗ. Thiếu ghế thì đơn chỉ tính tiền số ghế
        // đã chọn trong khi vé lại ghi nhiều tên hành khách -> thu thiếu tiền.
        int passengerCount = request.getPassengerNames() == null ? 0 : request.getPassengerNames().size();
        if (passengerCount > request.getSeatIds().size()) {
            throw new BookingException(String.format(
                    "Đã chọn %d chỗ nhưng có %d hành khách. Vui lòng chọn đủ %d chỗ.",
                    request.getSeatIds().size(), passengerCount, passengerCount));
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

            // Danh tính giữ ghế do máy chủ suy ra lúc bắt tay WebSocket, không phải chuỗi
            // trình duyệt tự khai. SeatIdentity.ofUser hạ email về chữ thường vì tài khoản
            // Google có thể lệch hoa/thường so với bản lưu trong CSDL, và so sánh phân biệt
            // hoa thường sẽ chặn nhầm chính người đang giữ ghế.
            if (seatLockService.isHeldByOther(seatId, SeatIdentity.ofUser(user.getEmail()))) {
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
                ticket.setPassengerName(normalizePassengerName(request.getPassengerNames().get(i)));
            } else {
                ticket.setPassengerName(normalizePassengerName(user.getFullName()));
            }

            tickets.add(ticket);

            totalPrice = totalPrice.add(seatPrice);
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setBookingDate(LocalDateTime.now());
        booking.setTotalPrice(totalPrice);
        booking.setStatus("PENDING");
        applyContactInfo(booking, request, user);

        if (request.getAdditionalServiceIds() != null && !request.getAdditionalServiceIds().isEmpty()) {
            List<Long> requestedServiceIds = request.getAdditionalServiceIds().stream().distinct().toList();
            List<AdditionalService> services = additionalServiceRepository.findAllById(requestedServiceIds);
            // findAllById lặng lẽ bỏ qua id không tồn tại. Không chặn ở đây thì dịch vụ "ma"
            // vẫn hiện giá trên giao diện nhưng không vào tổng tiền của đơn.
            if (services.size() != requestedServiceIds.size()) {
                throw new BookingException(
                        "Một số dịch vụ bổ sung đã chọn không còn khả dụng. Vui lòng chọn lại.");
            }
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
        Long appliedVoucherId = null;
        String voucherCode = VoucherService.normalizeCode(request.getVoucherCode());
        if (voucherCode != null && !voucherCode.isBlank()) {
            // Chặn sớm nếu tài khoản đang giữ mã này ở một đơn còn hiệu lực
            boolean alreadyUsed = bookingRepository.existsByUserIdAndVoucherCodeAndStatusNotIn(user.getId(),
                    voucherCode, BookingRepository.VOUCHER_RELEASING_STATUSES);
            if (alreadyUsed) {
                throw new BookingException("Bạn đã sử dụng mã giảm giá này cho một đơn hàng khác.");
            }

            Long providerId = trip.getVehicle() != null && trip.getVehicle().getProvider() != null
                    ? trip.getVehicle().getProvider().getId() : null;
            java.util.Map<String, Object> validation = voucherService.validateVoucher(voucherCode,
                    booking.getTotalPrice(), providerId);
            if (Boolean.TRUE.equals(validation.get("valid"))) {
                java.math.BigDecimal discount = (java.math.BigDecimal) validation.get("discountAmount");
                java.math.BigDecimal newTotal = booking.getTotalPrice().subtract(discount);
                booking.setTotalPrice(newTotal.compareTo(java.math.BigDecimal.ZERO) < 0
                        ? java.math.BigDecimal.ZERO : newTotal);

                appliedVoucherId = (Long) validation.get("voucherId");
                booking.setVoucherCode(voucherCode); // Store it to prevent reuse
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

        // Chỉ tới đây mã mới thực sự bị "tiêu". Thứ tự ghi booking trước rồi mới trừ lượt là
        // cố ý: nếu hai request song song cùng qua được vòng kiểm tra ở trên thì unique index
        // uq_booking_user_voucher_active sẽ đánh trượt request thua ngay tại INSERT này,
        // và nó không kịp trừ lượt của mã.
        try {
            bookingRepository.save(booking);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            if (isVoucherReuseViolation(e)) {
                throw new BookingException(
                        "Bạn đã sử dụng mã giảm giá \"" + voucherCode + "\" cho một đơn hàng khác.");
            }
            throw e;
        }

        // Đơn PENDING chỉ sinh ra ở đây. Báo cho lượt dọn biết là có việc, nếu không nó đang
        // ngủ thì sẽ ngủ tiếp và ghế của đơn này không bao giờ được trả lại.
        // Tín hiệu chỉ được tính sau khi transaction commit — xem PendingBookingSignal.
        pendingBookingSignal.bookingCreated();

        if (appliedVoucherId != null && !voucherService.useVoucher(appliedVoucherId)) {
            // Lượt cuối cùng vừa bị người khác dùng mất giữa lúc validate và lúc ghi đơn
            throw new BookingException("Mã giảm giá đã hết lượt sử dụng.");
        }

        // Remove locks and broadcast BOOKED status
        for (Long seatId : request.getSeatIds()) {
            seatLockService.removeLockBySeatId(seatId);
            seatStatusBroadcaster.booked(trip.getId(), seatId, SeatIdentity.ofUser(user.getEmail()));
        }

        return bookingMapper.toBookingResponse(booking, trip);
    }

    /**
     * Ghi thông tin người liên hệ của đơn, điền vào chỗ trống bằng hồ sơ tài khoản.
     *
     * Vé điện tử và mọi thông báo về chuyến đi đều đi tới địa chỉ này, nên nó không được
     * phép rỗng: client không gửi lên thì lấy của tài khoản đang đặt. Chuẩn hoá luôn tại
     * đây — email hạ về chữ thường (hòm thư không phân biệt hoa thường, nhưng chuỗi thì
     * có, và so sánh/đối soát sau này sẽ lệch), SĐT bỏ hết ký tự không phải số.
     */
    private void applyContactInfo(Booking booking, BookingRequest request, User user) {
        String name = blankToNull(request.getContactName());
        String email = blankToNull(request.getContactEmail());
        String phone = digitsOnly(request.getContactPhone());

        booking.setContactName(name != null ? name : user.getFullName());
        booking.setContactEmail(email != null ? email.toLowerCase(java.util.Locale.ROOT) : user.getEmail());
        booking.setContactPhone(phone != null ? phone : digitsOnly(user.getPhone()));
    }

    private String blankToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String digitsOnly(String raw) {
        return blankToNull(raw == null ? null : raw.replaceAll("\\D", ""));
    }

    /**
     * Chuẩn hoá tên hành khách về CHỮ HOA ngay khi lưu.
     *
     * Ô nhập bên web mới chỉ có textTransform: uppercase — đó là CSS, chỉ đổi cách hiển
     * thị, giá trị gửi lên server vẫn đúng như người dùng gõ. Kết quả là cùng một đơn mà
     * danh sách vé, mail xác nhận và màn hình soát vé mỗi nơi hiện một kiểu hoa/thường.
     * Hoa hoá tại đây thì mọi nơi đọc từ DB đều thấy cùng một dạng, đúng quy ước tên trên
     * vé phải khớp giấy tờ.
     *
     * Locale.ROOT chứ không phải locale mặc định của máy chủ: chỉ cần server chạy dưới
     * locale Thổ Nhĩ Kỳ là "i" hoá hoa thành "İ" và tên khách sai chính tả.
     */
    private String normalizePassengerName(String name) {
        return name == null ? null : name.trim().toUpperCase(java.util.Locale.ROOT);
    }

    /**
     * Phân biệt lỗi đụng unique index voucher với các lỗi ràng buộc khác, để chỉ dịch sang
     * thông báo "đã dùng mã này rồi" khi đúng là như vậy.
     */
    private boolean isVoucherReuseViolation(org.springframework.dao.DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String message = t.getMessage();
            if (message != null && message.toLowerCase()
                    .contains(VoucherUsageConstraintInitializer.INDEX_NAME.toLowerCase())) {
                return true;
            }
        }
        return false;
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

        // Vé đã soát (lên xe/tàu/máy bay) coi như đã sử dụng dịch vụ — không được hoàn
        // tiền nữa dù còn cách giờ khởi hành bao lâu.
        if (Boolean.TRUE.equals(booking.getIsCheckedIn())) {
            throw new BookingException("Vé đã được check-in, không thể hủy/hoàn tiền.");
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

        // Đơn đã hủy thì mã giảm giá được dùng lại (xem BookingRepository.VOUCHER_RELEASING_STATUSES),
        // nên phải trả lại lượt dùng để currentUsage không bị đếm thừa.
        if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
            voucherService.refundVoucherUsage(booking.getVoucherCode());
        }

        bookingRepository.save(booking);

        if (booking.getTickets() != null) {
            for (Ticket t : booking.getTickets()) {
                if (t.getSeat() != null) {
                    seatStatusBroadcaster.available(
                        trip != null ? trip.getId() : t.getTrip().getId(),
                        t.getSeat().getId());
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
            emailService.sendSurveyEmail(booking.resolveNotificationEmail(), booking.getId());
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
            seatStatusBroadcaster.available(
                ticketToCancel.getTrip().getId(),
                ticketToCancel.getSeat().getId());
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

        // Chặn quét quá sớm: trước đây hàm này không kiểm tra giờ khởi hành nên nhân
        // viên lỡ quét thử một vé còn nguyên ngày (ví dụ để xem chi tiết) là vé bị khóa
        // "đã check-in" ngay lập tức — đúng ngày khách quay lại quét thật thì bị từ chối
        // vì hệ thống tưởng đã soát rồi. Mốc 12 tiếng dùng chung với
        // TripReminderScheduler (email nhắc lịch cũng gửi trước giờ khởi hành 12 tiếng),
        // để "sắp khởi hành" chỉ có một định nghĩa duy nhất trong toàn hệ thống.
        Trip tripForCheckIn = extractTripFromBooking(booking);
        if (tripForCheckIn != null) {
            LocalDateTime now = LocalDateTime.now();
            long hoursUntilDeparture = java.time.temporal.ChronoUnit.HOURS.between(now, tripForCheckIn.getDepartureTime());
            if (hoursUntilDeparture > 12) {
                throw new BookingException(
                        "Chưa đến giờ khởi hành, chỉ có thể check-in trong vòng 12 tiếng trước giờ khởi hành ("
                                + tripForCheckIn.getDepartureTime() + ").");
            }

            // Chặn quét quá muộn: chuyến được coi là đã kết thúc (Trip.getLateCheckInCutoff())
            // thì không cho check-in nữa — tránh vé vẫn "hợp lệ" vô thời hạn sau khi khách
            // đã bỏ lỡ chuyến. NoShowScheduler dùng đúng mốc này để tự đánh dấu no-show.
            if (now.isAfter(tripForCheckIn.getLateCheckInCutoff())) {
                throw new BookingException(
                        "Đã quá giờ, chuyến đi được xem là đã kết thúc, không thể check-in nữa.");
            }
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
