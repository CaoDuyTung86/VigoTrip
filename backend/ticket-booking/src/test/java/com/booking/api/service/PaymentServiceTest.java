package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.entity.Booking;
import com.booking.api.entity.User;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PromotionRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.util.VNPayUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PaymentServiceTest {

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

    @InjectMocks
    private PaymentService paymentService;

    private Map<String, String> params;
    private Booking booking;
    private User user;

    @BeforeEach
    void setUp() {
        params = new HashMap<>();
        params.put("vnp_OrderInfo", "Thanh_toan_booking_123");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_Amount", "10000000"); // 100,000 VND * 100
        params.put("vnp_SecureHash", "dummyHash");

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
    void handleVNPayIPN_Success() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            // Mock static validation
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            // Execute
            Map<String, String> result = paymentService.handleVNPayIPN(params);

            // Verify
            assertEquals("00", result.get("RspCode"));
            assertEquals("Confirm Success", result.get("Message"));
            assertEquals("CONFIRMED", booking.getStatus());
            verify(bookingRepository, times(1)).save(booking);
            verify(emailService, times(1)).sendBookingConfirmation(eq(user.getEmail()), eq(booking));
        }
    }

    @Test
    void handleVNPayIPN_InvalidSignature() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(false);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");

            Map<String, String> result = paymentService.handleVNPayIPN(params);

            assertEquals("97", result.get("RspCode"));
            assertEquals("Invalid Signature", result.get("Message"));
            verify(bookingRepository, never()).save(any());
        }
    }

    @Test
    void handleVNPayIPN_OrderNotFound() {
        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.empty());

            Map<String, String> result = paymentService.handleVNPayIPN(params);

            assertEquals("01", result.get("RspCode"));
            assertEquals("Order not found", result.get("Message"));
        }
    }
}
