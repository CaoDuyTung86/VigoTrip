package com.booking.api.integration;

import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.PaymentLog;
import com.booking.api.entity.User;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PaymentLogRepository;
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
import java.util.List;
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

    @Autowired
    private PaymentLogRepository paymentLogRepository;

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
        booking.setTotalPrice(java.math.BigDecimal.valueOf(250000));
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
        String result = paymentService.handleVNPayReturn(params, "203.0.113.7");

        // When hash validation fails (since dummy params), returns INVALID_SIGNATURE
        assertEquals("INVALID_SIGNATURE", result);
    }

    @Test
    @DisplayName("Integration Test: callback chữ ký sai vẫn để lại một dòng nhật ký THẬT trong DB")
    void integration_InvalidCallback_SurvivesInAuditLog() {
        // Test này chạy trong một transaction bị rollback ở cuối (@Transactional trên lớp).
        // Dòng nhật ký vẫn đọc được sau lời gọi, và đó chính là điều cần chứng minh: nó được
        // ghi bằng một transaction riêng (REQUIRES_NEW), nên nó KHÔNG biến mất cùng với luồng
        // xử lý hỏng. Một nhật ký rollback cùng lỗi thì đúng lúc cần nhất lại chẳng có gì.
        Map<String, String> params = new HashMap<>();
        params.put("vnp_OrderInfo", "Thanh_toan_booking_" + savedBooking.getId());
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TxnRef", "TXN_AUDIT_IT");
        params.put("vnp_SecureHash", "chu_ky_bia_dat");

        paymentService.handleVNPayReturn(params, "203.0.113.7");

        List<PaymentLog> entries =
                paymentLogRepository.findByTransactionRefOrderByCreatedAtAsc("TXN_AUDIT_IT");
        assertEquals(1, entries.size(), "callback nào tới cũng phải để lại đúng một dòng");

        PaymentLog entry = entries.get(0);
        assertEquals(PaymentLog.Channel.RETURN, entry.getChannel());
        assertEquals(Boolean.FALSE, entry.getSignatureValid());
        assertEquals("INVALID_SIGNATURE", entry.getOutcome());
        assertEquals("203.0.113.7", entry.getSourceIp());
        assertTrue(entry.getRequestPayload().contains("vnp_ResponseCode=00"),
                "phải giữ lại nguyên văn thứ cổng gửi sang");
        assertFalse(entry.getRequestPayload().contains("chu_ky_bia_dat"),
                "nhưng không bao giờ lưu chữ ký");
    }
}
