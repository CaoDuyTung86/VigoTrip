package com.booking.api.service;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.*;
import com.booking.api.exception.BookingException;
import com.booking.api.mapper.BookingMapper;
import com.booking.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private AdditionalServiceRepository additionalServiceRepository;
    @Mock
    private BookingMapper bookingMapper;
    @Mock
    private EmailService emailService;
    @Mock
    private VoucherService voucherService;
    @Mock
    private SeatLockService seatLockService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private BookingService bookingService;

    private User user;
    private Trip busTrip;
    private Trip flightTrip;
    private Seat normalSeat;
    private Seat businessSeat;
    private BookingRequest request;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setFullName("Test User");
        user.setPoints(0);

        Vehicle bus = new Vehicle();
        bus.setVehicleType("BUS");
        bus.setTotalSeats(40);

        Vehicle plane = new Vehicle();
        plane.setVehicleType("FLIGHT");
        plane.setTotalSeats(150);

        busTrip = new Trip();
        busTrip.setId(1L);
        busTrip.setPrice(java.math.BigDecimal.valueOf(100000));
        busTrip.setDepartureTime(LocalDateTime.now().plusDays(2));
        busTrip.setVehicle(bus);

        flightTrip = new Trip();
        flightTrip.setId(2L);
        flightTrip.setPrice(java.math.BigDecimal.valueOf(1000000));
        flightTrip.setDepartureTime(LocalDateTime.now().plusDays(3));
        flightTrip.setVehicle(plane);

        normalSeat = new Seat();
        normalSeat.setId(1L);
        normalSeat.setSeatNumber("A1");
        normalSeat.setSeatType("NORMAL");

        businessSeat = new Seat();
        businessSeat.setId(2L);
        businessSeat.setSeatNumber("B1");
        businessSeat.setSeatType("BUSINESS");

        request = new BookingRequest();
        request.setTripId(1L);
        request.setSeatIds(Collections.singletonList(1L));
    }

    @Test
    @DisplayName("Tạo đơn đặt vé thành công (Loại vé xe Bus thường)")
    void createBooking_Success_BusNormalSeat() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(normalSeat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(false);
        when(seatLockService.getLockedBy(1L)).thenReturn(null);
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.createBooking("test@example.com", request);

        assertNotNull(response);
        verify(bookingRepository, times(1)).save(any(Booking.class));
        verify(seatLockService, times(1)).removeLockBySeatId(1L);
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/seat-status"), any(Object.class));
    }

    @Test
    @DisplayName("Tạo đơn đặt vé máy bay hạng Business (Nhân 2.5 lần giá gốc)")
    void createBooking_Success_FlightBusinessSeatMultiplier() {
        request.setTripId(2L);
        request.setSeatIds(Collections.singletonList(2L));

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(2L)).thenReturn(Optional.of(flightTrip));
        when(seatRepository.findByIdWithLock(2L)).thenReturn(Optional.of(businessSeat));
        when(ticketRepository.existsByTripIdAndSeatId(2L, 2L)).thenReturn(false);
        when(seatLockService.getLockedBy(2L)).thenReturn(null);
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.createBooking("test@example.com", request);

        assertNotNull(response);
        verify(bookingRepository).save(argThat(booking -> {
            assertEquals(java.math.BigDecimal.valueOf(2500000.0), booking.getTotalPrice()); // 1,000,000 * 2.5
            return true;
        }));
    }

    @Test
    @DisplayName("Tạo đơn đặt vé kèm Dịch vụ bổ sung và Mã giảm giá hợp lệ")
    void createBooking_Success_WithAdditionalServicesAndVoucher() {
        request.setAdditionalServiceIds(Collections.singletonList(10L));
        request.setVoucherCode("SALE20");

        AdditionalService addService = new AdditionalService();
        addService.setId(10L);
        addService.setPrice(java.math.BigDecimal.valueOf(50000));

        Map<String, Object> voucherResult = new HashMap<>();
        voucherResult.put("valid", true);
        voucherResult.put("discountAmount", java.math.BigDecimal.valueOf(30000).setScale(2, java.math.RoundingMode.HALF_UP));
        voucherResult.put("voucherId", 99L);

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(normalSeat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(false);
        when(seatLockService.getLockedBy(1L)).thenReturn(null);
        when(additionalServiceRepository.findAllById(Collections.singletonList(10L)))
                .thenReturn(Collections.singletonList(addService));
        when(bookingRepository.existsByUserIdAndVoucherCodeAndStatusNot(1L, "SALE20", "CANCELLED"))
                .thenReturn(false);
        when(voucherService.validateVoucher(eq("SALE20"), any(java.math.BigDecimal.class))).thenReturn(voucherResult);
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.createBooking("test@example.com", request);

        assertNotNull(response);
        verify(voucherService).useVoucher(99L);
        verify(bookingRepository).save(argThat(b -> {
            // (100,000 vé + 50,000 dịch vụ) - 30,000 giảm giá = 120,000
            // So sánh bằng compareTo để tránh lỗi scale của BigDecimal
            assertEquals(0, java.math.BigDecimal.valueOf(120000).compareTo(b.getTotalPrice()));
            assertEquals("SALE20", b.getVoucherCode());
            return true;
        }));
    }

    @Test
    @DisplayName("Tạo đơn thất bại do Chuyến đi đã khởi hành")
    void createBooking_Fail_TripDeparted() {
        busTrip.setDepartureTime(LocalDateTime.now().minusHours(1));
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));

        assertThrows(BookingException.class, () -> bookingService.createBooking("test@example.com", request));
    }

    @Test
    @DisplayName("Tạo đơn thất bại do Ghế đang bị giữ bởi người khác")
    void createBooking_Fail_SeatLockedByOtherUser() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(normalSeat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(false);
        when(seatLockService.getLockedBy(1L)).thenReturn("otheruser@example.com");

        BookingException ex = assertThrows(BookingException.class,
                () -> bookingService.createBooking("test@example.com", request));
        assertTrue(ex.getMessage().contains("đang được giữ bởi người khác"));
    }

    @Test
    @DisplayName("Tạo đơn thất bại do Danh sách ghế có trùng lặp")
    void createBooking_Fail_DuplicateSeatsInRequest() {
        request.setSeatIds(Arrays.asList(1L, 1L));

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));

        BookingException ex = assertThrows(BookingException.class,
                () -> bookingService.createBooking("test@example.com", request));
        assertTrue(ex.getMessage().contains("dữ liệu trùng lặp"));
    }

    @Test
    @DisplayName("Tạo đơn thất bại do Mã giảm giá đã được người dùng sử dụng trước đó")
    void createBooking_Fail_VoucherAlreadyUsedByUser() {
        request.setVoucherCode("USED_CODE");

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(busTrip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(normalSeat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(false);
        when(seatLockService.getLockedBy(1L)).thenReturn(null);
        when(bookingRepository.existsByUserIdAndVoucherCodeAndStatusNot(1L, "USED_CODE", "CANCELLED"))
                .thenReturn(true);

        BookingException ex = assertThrows(BookingException.class,
                () -> bookingService.createBooking("test@example.com", request));
        assertTrue(ex.getMessage().contains("đã sử dụng mã giảm giá này"));
    }

    @Test
    @DisplayName("Lấy danh sách đơn đặt vé của cá nhân thành công")
    void getMyBookings_Success() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findByUserIdWithDetails(1L)).thenReturn(Collections.singletonList(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        List<BookingResponse> responses = bookingService.getMyBookings("test@example.com");

        assertNotNull(responses);
        assertEquals(1, responses.size());
    }

    @Test
    @DisplayName("Xem chi tiết đơn đặt vé thành công")
    void getBookingDetail_Success() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.getBookingDetail("test@example.com", 100L);

        assertNotNull(response);
    }

    @Test
    @DisplayName("Xem chi tiết đơn thất bại do Không có quyền truy cập đơn của người khác")
    void getBookingDetail_Fail_Unauthorized() {
        User otherUser = new User();
        otherUser.setId(99L);

        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(otherUser);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(BookingException.class, () -> bookingService.getBookingDetail("test@example.com", 100L));
    }

    @Test
    @DisplayName("Hủy vé trước >24h khởi hành (Hoàn tiền 100%)")
    void cancelBooking_FullRefund_Above24Hours() {
        busTrip.setDepartureTime(LocalDateTime.now().plusHours(48));

        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("CONFIRMED");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(200000));

        Ticket ticket = new Ticket();
        ticket.setTrip(busTrip);
        booking.setTickets(Collections.singletonList(ticket));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.cancelBooking("test@example.com", 100L);

        assertEquals("CANCELLED", booking.getStatus());
        assertEquals(1, booking.getRefunds().size());
        assertEquals(0, java.math.BigDecimal.valueOf(200000).compareTo(booking.getRefunds().get(0).getRefundAmount()));
    }

    @Test
    @DisplayName("Hủy vé sát giờ khởi hành từ 4h - 24h (Hoàn tiền 90%, phạt 10%)")
    void cancelBooking_PartialRefund_Between4And24Hours() {
        busTrip.setDepartureTime(LocalDateTime.now().plusHours(10));

        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("PAID");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(200000));

        Ticket ticket = new Ticket();
        ticket.setTrip(busTrip);
        booking.setTickets(Collections.singletonList(ticket));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.cancelBooking("test@example.com", 100L);

        assertEquals("CANCELLED", booking.getStatus());
        assertEquals(java.math.BigDecimal.valueOf(180000.0).setScale(2, java.math.RoundingMode.HALF_UP),
                booking.getRefunds().get(0).getRefundAmount()); // 200,000 * 0.9
    }

    @Test
    @DisplayName("Hủy vé thất bại do Còn dưới 4h trước giờ khởi hành")
    void cancelBooking_Fail_Under4HoursCutoff() {
        busTrip.setDepartureTime(LocalDateTime.now().plusHours(2));

        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("CONFIRMED");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(200000));

        Ticket ticket = new Ticket();
        ticket.setTrip(busTrip);
        booking.setTickets(Collections.singletonList(ticket));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        BookingException ex = assertThrows(BookingException.class,
                () -> bookingService.cancelBooking("test@example.com", 100L));
        assertTrue(ex.getMessage().contains("chỉ còn dưới 4 tiếng"));
    }

    @Test
    @DisplayName("Đã hoàn thành chuyến đi thành công (Status COMPLETED & Gửi email khảo sát)")
    void completeBooking_Success_EarnsPointsAndSendsSurvey() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("CONFIRMED");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(500000));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.completeBooking("test@example.com", 100L);

        // Điểm chỉ tích tại PaymentService khi VNPay xác nhận, KHÔNG tích tại completeBooking
        assertEquals("COMPLETED", booking.getStatus());
        verify(emailService).sendSurveyEmail("test@example.com", 100L);
    }

    @Test
    @DisplayName("Hoàn thành chuyến đi thất bại khi vé chưa ở trạng thái CONFIRMED")
    void completeBooking_Fail_NotConfirmedStatus() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("PENDING");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(BookingException.class, () -> bookingService.completeBooking("test@example.com", 100L));
    }

    @Test
    @DisplayName("Hủy vé lẻ thành công và trừ tiền khỏi đơn đặt vé")
    void cancelTicket_SingleTicket_Success() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setTotalPrice(java.math.BigDecimal.valueOf(300000));

        Ticket ticket1 = new Ticket();
        ticket1.setId(10L);
        ticket1.setStatus("ACTIVE");
        ticket1.setPrice(java.math.BigDecimal.valueOf(100000));
        ticket1.setTrip(busTrip);
        ticket1.setSeat(normalSeat);

        Ticket ticket2 = new Ticket();
        ticket2.setId(11L);
        ticket2.setStatus("ACTIVE");
        ticket2.setPrice(java.math.BigDecimal.valueOf(200000));
        ticket2.setTrip(busTrip);

        booking.setTickets(Arrays.asList(ticket1, ticket2));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.cancelTicket("test@example.com", 100L, 10L);

        assertEquals("CANCELLED", ticket1.getStatus());
        assertEquals(java.math.BigDecimal.valueOf(200000), booking.getTotalPrice());
        verify(ticketRepository).save(ticket1);
    }

    @Test
    @DisplayName("Hủy vé lẻ cuối cùng tự động chuyển cả Đơn hàng sang CANCELLED")
    void cancelTicket_AllTicketsCancelled_UpdatesBookingStatusToCancelled() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("PENDING");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(100000));

        Ticket ticket1 = new Ticket();
        ticket1.setId(10L);
        ticket1.setStatus("ACTIVE");
        ticket1.setPrice(java.math.BigDecimal.valueOf(100000));
        ticket1.setTrip(busTrip);

        booking.setTickets(Collections.singletonList(ticket1));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.cancelTicket("test@example.com", 100L, 10L);

        assertEquals("CANCELLED", ticket1.getStatus());
        assertEquals("CANCELLED", booking.getStatus());
        assertEquals(0, java.math.BigDecimal.ZERO.compareTo(booking.getTotalPrice()));
    }

    @Test
    @DisplayName("Check-in vé thành công tại bến")
    void checkIn_Success() {
        Booking booking = new Booking();
        booking.setId(100L);
        booking.setStatus("CONFIRMED");
        booking.setIsCheckedIn(false);

        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.checkIn(100L, "admin@gmail.com");

        assertNotNull(response);
        assertTrue(booking.getIsCheckedIn());
        assertNotNull(booking.getCheckInDate());
        verify(bookingRepository).save(booking);
    }

    @Test
    @DisplayName("Check-in thất bại do vé chưa thanh toán hoặc đã check-in trước đó")
    void checkIn_Fail_UnpaidOrAlreadyCheckedIn() {
        Booking unpaidBooking = new Booking();
        unpaidBooking.setId(100L);
        unpaidBooking.setStatus("PENDING");

        Booking checkedInBooking = new Booking();
        checkedInBooking.setId(101L);
        checkedInBooking.setStatus("CONFIRMED");
        checkedInBooking.setIsCheckedIn(true);
        checkedInBooking.setCheckInDate(LocalDateTime.now().minusHours(1));

        when(bookingRepository.findById(100L)).thenReturn(Optional.of(unpaidBooking));
        when(bookingRepository.findById(101L)).thenReturn(Optional.of(checkedInBooking));

        assertThrows(BookingException.class, () -> bookingService.checkIn(100L, "admin@gmail.com"));
        assertThrows(BookingException.class, () -> bookingService.checkIn(101L, "admin@gmail.com"));
    }
}
