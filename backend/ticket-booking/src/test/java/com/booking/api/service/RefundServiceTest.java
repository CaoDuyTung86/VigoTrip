package com.booking.api.service;

import com.booking.api.dto.RefundRequest;
import com.booking.api.dto.RefundResponse;
import com.booking.api.entity.*;
import com.booking.api.exception.BookingException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RefundRepository;
import com.booking.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * requestRefund() từng hoàn 100% và không kiểm tra giờ khởi hành/trạng thái check-in
 * dù cancelBooking() (đường hủy vé khác trong cùng hệ thống) đã áp đúng các luật này —
 * hai đường hủy khác chính sách nhau. Test ở đây khoá lại hành vi ĐÃ ĐỒNG BỘ.
 */
@ExtendWith(MockitoExtension.class)
class RefundServiceTest {

    @Mock
    private RefundRepository refundRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private EmailService emailService;
    @Mock
    private VoucherService voucherService;

    @InjectMocks
    private RefundService refundService;

    private User user;
    private Trip trip;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setFullName("Test User");

        trip = new Trip();
        trip.setId(1L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
    }

    private Booking bookingWithDeparture(LocalDateTime departureTime) {
        trip.setDepartureTime(departureTime);

        Booking booking = new Booking();
        booking.setId(100L);
        booking.setUser(user);
        booking.setStatus("CONFIRMED");
        booking.setTotalPrice(java.math.BigDecimal.valueOf(200000));

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        booking.setTickets(Collections.singletonList(ticket));
        return booking;
    }

    @Test
    @DisplayName("Yêu cầu hoàn tiền trước >24h khởi hành -> hoàn 100%")
    void requestRefund_FullRefund_Above24Hours() {
        Booking booking = bookingWithDeparture(LocalDateTime.now().plusHours(48));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(refundRepository.findByBookingId(100L)).thenReturn(Collections.emptyList());
        when(refundRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RefundResponse response = refundService.requestRefund("test@example.com",
                new RefundRequest(100L, "Đổi lịch trình"));

        assertEquals(0, java.math.BigDecimal.valueOf(200000).compareTo(response.getRefundAmount()));
        assertEquals("PENDING", response.getStatus());
    }

    @Test
    @DisplayName("Yêu cầu hoàn tiền từ 4h-24h khởi hành -> hoàn 90%, phạt 10%")
    void requestRefund_PartialRefund_Between4And24Hours() {
        Booking booking = bookingWithDeparture(LocalDateTime.now().plusHours(10));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(refundRepository.findByBookingId(100L)).thenReturn(Collections.emptyList());
        when(refundRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RefundResponse response = refundService.requestRefund("test@example.com",
                new RefundRequest(100L, "Bận việc đột xuất"));

        assertEquals(java.math.BigDecimal.valueOf(180000.0).setScale(2, java.math.RoundingMode.HALF_UP),
                response.getRefundAmount());
    }

    @Test
    @DisplayName("Yêu cầu hoàn tiền thất bại khi còn dưới 4h khởi hành")
    void requestRefund_Fail_Under4HoursCutoff() {
        Booking booking = bookingWithDeparture(LocalDateTime.now().plusHours(2));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(refundRepository.findByBookingId(100L)).thenReturn(Collections.emptyList());

        BookingException ex = assertThrows(BookingException.class, () ->
                refundService.requestRefund("test@example.com", new RefundRequest(100L, "Gấp quá")));
        assertTrue(ex.getMessage().contains("chỉ còn dưới 4 tiếng"));
    }

    @Test
    @DisplayName("Yêu cầu hoàn tiền thất bại khi vé đã check-in, dù còn xa giờ khởi hành")
    void requestRefund_Fail_AlreadyCheckedIn() {
        // Còn 48h mới khởi hành (đủ điều kiện hoàn 100% nếu chỉ xét mốc giờ) nhưng vé
        // đã được soát ở bến -> không được hoàn nữa vì dịch vụ coi như đã dùng.
        Booking booking = bookingWithDeparture(LocalDateTime.now().plusHours(48));
        booking.setIsCheckedIn(true);
        booking.setCheckInDate(LocalDateTime.now().minusMinutes(5));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        BookingException ex = assertThrows(BookingException.class, () ->
                refundService.requestRefund("test@example.com", new RefundRequest(100L, "Đổi ý")));
        assertTrue(ex.getMessage().contains("check-in"));
    }
}
