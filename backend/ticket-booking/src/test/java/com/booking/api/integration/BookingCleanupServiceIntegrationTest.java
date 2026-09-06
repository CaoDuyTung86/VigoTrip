package com.booking.api.integration;

import com.booking.api.entity.Booking;
import com.booking.api.entity.User;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.service.BookingCleanupService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Bộ lọc "đơn nào đáng bị dọn" nằm trong câu query nên phải chạy thật với DB mới
 * kiểm chứng được — đây là chốt chặn cuối cho tình huống cổng trừ tiền xong mới
 * phát hiện đơn đã bị hủy vì hết hạn giữ chỗ.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BookingCleanupServiceIntegrationTest {

    @Autowired
    private BookingCleanupService bookingCleanupService;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.setEmail("cleanup_integration@example.com");
        u.setFullName("Cleanup Integration User");
        u.setPassword("password123");
        u.setRole("ROLE_USER");
        u.setPoints(0);
        user = userRepository.save(u);
    }

    private Booking savePending(LocalDateTime bookingDate, LocalDateTime paymentExpiresAt) {
        Booking booking = new Booking();
        booking.setUser(user);
        booking.setBookingDate(bookingDate);
        booking.setTotalPrice(BigDecimal.valueOf(150000));
        booking.setStatus("PENDING");
        booking.setPaymentExpiresAt(paymentExpiresAt);
        return bookingRepository.save(booking);
    }

    private String statusOf(Booking booking) {
        return bookingRepository.findById(booking.getId()).orElseThrow().getStatus();
    }

    @Test
    @DisplayName("Đơn quá hạn giữ chỗ mà chưa vào cổng thanh toán thì bị hủy")
    void cancelsExpiredBookingWithoutPaymentSession() {
        Booking expired = savePending(LocalDateTime.now().minusMinutes(10), null);

        bookingCleanupService.cancelUnpaidBookings();

        assertEquals("CANCELLED", statusOf(expired));
    }

    @Test
    @DisplayName("Đơn quá hạn giữ chỗ nhưng đang có phiên thanh toán mở thì KHÔNG bị hủy")
    void keepsBookingWhilePaymentSessionIsOpen() {
        Booking payingNow = savePending(LocalDateTime.now().minusMinutes(10),
                LocalDateTime.now().plusMinutes(10));

        bookingCleanupService.cancelUnpaidBookings();

        assertEquals("PENDING", statusOf(payingNow),
                "hủy lúc này thì khách trả tiền xong mới biết đơn đã mất");
    }

    @Test
    @DisplayName("Phiên thanh toán hết hạn rồi thì đơn lại bị dọn như bình thường")
    void cancelsBookingAfterPaymentSessionExpired() {
        Booking abandoned = savePending(LocalDateTime.now().minusMinutes(30),
                LocalDateTime.now().minusMinutes(5));

        bookingCleanupService.cancelUnpaidBookings();

        assertEquals("CANCELLED", statusOf(abandoned));
    }

    @Test
    @DisplayName("Đơn còn trong thời gian giữ chỗ thì không bị đụng tới")
    void keepsFreshBooking() {
        Booking fresh = savePending(LocalDateTime.now(), null);

        bookingCleanupService.cancelUnpaidBookings();

        assertEquals("PENDING", statusOf(fresh));
    }

    @Test
    @DisplayName("Điểm vào theo lịch vẫn dọn được đơn — cổng chặn không cắt mất đường đi")
    void scheduledEntryPointStillCancels() {
        // Điểm vào thật của production là sweepExpiredBookingsIfNeeded, không phải
        // cancelUnpaidBookings. Nó gọi ngược lại chính bean này qua proxy của Spring để giữ
        // @Transactional; gọi tắt trong lớp thì transaction biến mất và releaseSeats sẽ nổ.
        Booking expired = savePending(LocalDateTime.now().minusMinutes(10), null);

        bookingCleanupService.sweepExpiredBookingsIfNeeded();

        assertEquals("CANCELLED", statusOf(expired));
    }
}
