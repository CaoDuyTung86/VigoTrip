package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PromotionRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.util.VNPayUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PromotionRepository promotionRepository;

    @Mock
    private VNPayConfig vnPayConfig;

    @Mock
    private EmailService emailService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private PaymentService paymentService;

    private Map<String, String> ipnParams;
    private Booking booking;
    private User user;

    @BeforeEach
    void setUp() {
        ipnParams = new HashMap<>();
        ipnParams.put("vnp_OrderInfo", "Thanh_toan_booking_123");
        ipnParams.put("vnp_ResponseCode", "00");
        ipnParams.put("vnp_Amount", "10000000"); // 100,000 VND * 100
        ipnParams.put("vnp_SecureHash", "dummyHash");

        user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setPoints(0);

        booking = new Booking();
        booking.setId(123L);
        booking.setUser(user);
        booking.setTotalPrice(100000.0);
        booking.setStatus("PENDING");
    }

    @Test
    @DisplayName("Tạo URL thanh toán VNPay thành công")
    void createVNPayPayment_Success() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(123L);
        request.setBankCode("NCB");
        request.setLanguage("vn");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));
        when(vnPayConfig.getTmnCode()).thenReturn("TMNCODE123");
        when(vnPayConfig.getReturnUrl()).thenReturn("http://localhost/return");
        when(vnPayConfig.getPayUrl()).thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        when(vnPayConfig.getHashSecret()).thenReturn("SECRET123");

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.formatDateTime(any())).thenReturn("20260731120000");
            mockedVNPayUtil.when(() -> VNPayUtil.buildHashData(any())).thenReturn("hashdata");
            mockedVNPayUtil.when(() -> VNPayUtil.hmacSHA512(eq("SECRET123"), eq("hashdata"))).thenReturn("securehash");
            mockedVNPayUtil.when(() -> VNPayUtil.buildQueryString(any())).thenReturn("vnp_Amount=10000000");

            PaymentResponse response = paymentService.createVNPayPayment("test@example.com", request, "127.0.0.1");

            assertNotNull(response);
            assertNotNull(response.getPaymentUrl());
            assertNotNull(response.getTransactionId());
            assertTrue(response.getPaymentUrl().contains("vnp_SecureHash=securehash"));
        }
    }

    @Test
    @DisplayName("Tạo URL thanh toán thất bại do Booking không thuộc về User")
    void createVNPayPayment_Fail_UnauthorizedBooking() {
        User otherUser = new User();
        otherUser.setId(99L);
        booking.setUser(otherUser);

        PaymentRequest request = new PaymentRequest();
        request.setBookingId(123L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

        BookingException ex = assertThrows(BookingException.class,
                () -> paymentService.createVNPayPayment("test@example.com", request, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("không có quyền thanh toán"));
    }

    @Test
    @DisplayName("Tạo URL thanh toán thất bại khi Booking không ở trạng thái PENDING")
    void createVNPayPayment_Fail_BookingNotPending() {
        booking.setStatus("CONFIRMED");

        PaymentRequest request = new PaymentRequest();
        request.setBookingId(123L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

        BookingException ex = assertThrows(BookingException.class,
                () -> paymentService.createVNPayPayment("test@example.com", request, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("thanh toán hoặc hủy"));
    }

    @Test
    @DisplayName("Xử lý Callback VNPay Return thành công khi giao dịch thành công (00)")
    void handleVNPayReturn_Success() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams);

            assertEquals("SUCCESS", result);
            assertEquals("CONFIRMED", booking.getStatus());
            verify(bookingRepository).save(booking);
        }
    }

    @Test
    @DisplayName("Xử lý Callback VNPay Return khi thanh toán thất bại (Mã lỗi 24 - Người dùng hủy)")
    void handleVNPayReturn_FailedCode_CancelsBooking() {
        ipnParams.put("vnp_ResponseCode", "24");

        Trip trip = new Trip();
        trip.setId(10L);

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        booking.setTickets(Collections.singletonList(ticket));

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams);

            assertEquals("FAILED_24", result);
            assertEquals("FAILED", booking.getStatus());
            verify(bookingRepository).save(booking);
        }
    }

    @Test
    @DisplayName("Xử lý Callback VNPay Return trả về INVALID_SIGNATURE khi sai mã băm")
    void handleVNPayReturn_InvalidSignature() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(false);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");

            String result = paymentService.handleVNPayReturn(ipnParams);

            assertEquals("INVALID_SIGNATURE", result);
            verify(bookingRepository, never()).save(any());
        }
    }

    @Test
    @DisplayName("Xử lý VNPay IPN thành công (Cập nhật CONFIRMED & Tích điểm thưởng)")
    void handleVNPayIPN_Success() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams);

            assertEquals("00", result.get("RspCode"));
            assertEquals("Confirm Success", result.get("Message"));
            assertEquals("CONFIRMED", booking.getStatus());
            assertEquals(10, user.getPoints()); // 100,000 / 10,000 = 10 điểm
            verify(bookingRepository, times(1)).save(booking);
            verify(userRepository, times(1)).save(user);
            verify(emailService, times(1)).sendBookingConfirmation(eq(user.getEmail()), eq(booking));
        }
    }

    @Test
    @DisplayName("Xử lý VNPay IPN thất bại do Sai chữ ký (RspCode 97)")
    void handleVNPayIPN_InvalidSignature() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(false);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams);

            assertEquals("97", result.get("RspCode"));
            assertEquals("Invalid Signature", result.get("Message"));
            verify(bookingRepository, never()).save(any());
        }
    }

    @Test
    @DisplayName("Xử lý VNPay IPN thất bại do Đơn hàng không tồn tại (RspCode 01)")
    void handleVNPayIPN_OrderNotFound() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.empty());

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams);

            assertEquals("01", result.get("RspCode"));
            assertEquals("Order not found", result.get("Message"));
        }
    }

    @Test
    @DisplayName("Xử lý VNPay IPN thất bại do Sai số tiền thanh toán (RspCode 04)")
    void handleVNPayIPN_InvalidAmount() {
        ipnParams.put("vnp_Amount", "5000000"); // 50,000 VND trong khi đơn là 100,000 VND

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams);

            assertEquals("04", result.get("RspCode"));
            assertEquals("Invalid Amount", result.get("Message"));
        }
    }

    @Test
    @DisplayName("Xử lý VNPay IPN khi Đơn hàng đã được xác nhận từ trước (RspCode 02)")
    void handleVNPayIPN_OrderAlreadyConfirmed() {
        booking.setStatus("CONFIRMED");

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams);

            assertEquals("02", result.get("RspCode"));
            assertEquals("Order already confirmed", result.get("Message"));
        }
    }
}
