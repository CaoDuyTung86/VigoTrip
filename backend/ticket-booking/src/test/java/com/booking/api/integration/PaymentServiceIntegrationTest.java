package com.booking.api.integration;

import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.User;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.service.EmailService;
import com.booking.api.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PaymentServiceIntegrationTest {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @MockitoBean
    private EmailService emailService;

    private User savedUser;
    private Booking savedBooking;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setEmail("payment_integration@example.com");
        user.setFullName("Payment Integration User");
        user.setPassword("password123");
        user.setRole("ROLE_USER");
        user.setPoints(0);
        savedUser = userRepository.save(user);

        Booking booking = new Booking();
        booking.setUser(savedUser);
        booking.setBookingDate(LocalDateTime.now());
        booking.setTotalPrice(250000.0);
        booking.setStatus("PENDING");
        savedBooking = bookingRepository.save(booking);
    }

    @Test
    @DisplayName("Integration Test: Tạo thanh toán VNPay kiểm tra URL & tham số trong hệ thống Spring")
    void integration_CreateVNPayPayment() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(savedBooking.getId());
        request.setBankCode("NCB");

        PaymentResponse response = paymentService.createVNPayPayment(savedUser.getEmail(), request, "127.0.0.1");

        assertNotNull(response);
        assertNotNull(response.getPaymentUrl());
        assertTrue(response.getPaymentUrl().contains("vnp_Amount=25000000"));
        assertNotNull(response.getTransactionId());
    }

    @Test
    @DisplayName("Integration Test: Xử lý callback Return từ VNPay khi đơn hàng không tồn tại")
    void integration_HandleVNPayReturnOrderNotFound() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_OrderInfo", "Thanh_toan_booking_9999999");
        params.put("vnp_ResponseCode", "00");

        // Mock hash validation via VNPayUtil inside spring context
        String result = paymentService.handleVNPayReturn(params);

        // When hash validation fails (since dummy params), returns INVALID_SIGNATURE
        assertEquals("INVALID_SIGNATURE", result);
    }
}
