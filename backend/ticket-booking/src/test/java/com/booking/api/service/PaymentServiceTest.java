package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.dto.BookingConfirmationMail;
import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.event.BookingConfirmedEvent;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.entity.Payment;
import com.booking.api.entity.Refund;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PaymentRepository;
import com.booking.api.repository.PromotionRepository;
import com.booking.api.repository.RefundRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.util.VNPayUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.SortedMap;
import java.util.TimeZone;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private RefundRepository refundRepository;

    @Mock
    private VoucherService voucherService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PromotionRepository promotionRepository;

    @Mock
    private VNPayConfig vnPayConfig;

    @Mock
    private ApplicationEventPublisher eventPublisher;

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
        booking.setTotalPrice(java.math.BigDecimal.valueOf(100000));
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
            verify(eventPublisher, times(1)).publishEvent(argThat((Object event) ->
                    event instanceof BookingConfirmedEvent e
                            && e.toEmail().equals(user.getEmail())
                            && e.mail().bookingId().equals(123L)));
        }
    }

    @Test
    @DisplayName("Mail xác nhận nhận dữ liệu đã phẳng hóa, không phải entity còn LAZY")
    void handleVNPayIPN_Success_FlattensBookingBeforeSendingMail() {
        Route route = new Route();
        route.setOrigin("Hà Nội");
        route.setDestination("Sài Gòn");

        Trip trip = new Trip();
        trip.setId(10L);
        trip.setRoute(route);
        trip.setDepartureTime(LocalDateTime.of(2026, 1, 2, 8, 30));

        Seat seat = new Seat();
        seat.setSeatNumber("A01");

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        ticket.setSeat(seat);
        booking.setTickets(Collections.singletonList(ticket));

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

            paymentService.handleVNPayIPN(ipnParams);

            ArgumentCaptor<BookingConfirmedEvent> captor =
                    ArgumentCaptor.forClass(BookingConfirmedEvent.class);
            verify(eventPublisher).publishEvent(captor.capture());

            // Đọc xong hết ở luồng gọi thì thread gửi mail không còn phải chạm vào Hibernate
            assertEquals(user.getEmail(), captor.getValue().toEmail());
            BookingConfirmationMail mail = captor.getValue().mail();
            assertEquals(123L, mail.bookingId());
            assertEquals("Hà Nội ➔ Sài Gòn", mail.route());
            assertEquals("08:30 - 02/01/2026", mail.departureTime());
            assertEquals("A01", mail.seats());
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

    // ==================== Cửa sổ thanh toán & tiền về muộn ====================

    /** Dựng bộ tham số callback có chữ ký thật, ký bằng {@code secret}. */
    private Map<String, String> signedCallback(String responseCode, String txnRef) {
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_OrderInfo", "Thanh_toan_booking_123");
        params.put("vnp_ResponseCode", responseCode);
        params.put("vnp_Amount", "10000000");
        params.put("vnp_TxnRef", txnRef);

        Map<String, String> callback = new HashMap<>(params);
        callback.put("vnp_SecureHash", VNPayUtil.hmacSHA512("secret", VNPayUtil.buildHashData(params)));
        return callback;
    }

    @Test
    @DisplayName("Tạo link thanh toán thì mở cửa sổ thanh toán trên đơn và báo hạn cho cổng")
    void createVNPayPayment_OpensPaymentWindow() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(123L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));
        when(vnPayConfig.getTmnCode()).thenReturn("TMNCODE123");
        when(vnPayConfig.getReturnUrl()).thenReturn("http://localhost/return");
        when(vnPayConfig.getPayUrl()).thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        when(vnPayConfig.getHashSecret()).thenReturn("secret");

        LocalDateTime before = LocalDateTime.now();
        PaymentResponse response = paymentService.createVNPayPayment("test@example.com", request, "127.0.0.1");

        assertNotNull(booking.getPaymentExpiresAt(), "phải mở cửa sổ thanh toán để cleanup không hủy đơn");
        assertTrue(booking.getPaymentExpiresAt()
                .isAfter(before.plusMinutes(PaymentService.PAYMENT_WINDOW_MINUTES - 1)));
        assertTrue(response.getPaymentUrl().contains("vnp_ExpireDate="), "cổng phải biết hạn để tự đóng phiên");
        verify(bookingRepository).save(booking);
    }

    @Test
    @DisplayName("Ngày giờ gửi cổng phải theo giờ Việt Nam dù server chạy múi giờ khác")
    void createVNPayPayment_SendsGatewayDatesInVietnamTime() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(123L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));
        when(vnPayConfig.getTmnCode()).thenReturn("TMNCODE123");
        when(vnPayConfig.getReturnUrl()).thenReturn("http://localhost/return");
        when(vnPayConfig.getPayUrl()).thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        when(vnPayConfig.getHashSecret()).thenReturn("secret");

        // Giả lập server chạy UTC (container deploy) — trước khi sửa, vnp_CreateDate lấy
        // theo múi giờ này nên lùi 7 tiếng và cổng coi phiên đã hết hạn ngay khi vừa mở.
        TimeZone originalZone = TimeZone.getDefault();
        PaymentResponse response;
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
            response = paymentService.createVNPayPayment("test@example.com", request, "127.0.0.1");
        } finally {
            TimeZone.setDefault(originalZone);
        }

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        LocalDateTime createDate = LocalDateTime.parse(extractParam(response.getPaymentUrl(), "vnp_CreateDate"), fmt);
        LocalDateTime expireDate = LocalDateTime.parse(extractParam(response.getPaymentUrl(), "vnp_ExpireDate"), fmt);
        LocalDateTime vietnamNow = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        assertTrue(Math.abs(Duration.between(vietnamNow, createDate).toMinutes()) < 1,
                "vnp_CreateDate lệch giờ Việt Nam thì cổng coi phiên đã hết hạn ngay khi mở");
        assertEquals(PaymentService.PAYMENT_WINDOW_MINUTES,
                Duration.between(createDate, expireDate).toMinutes(),
                "hạn của cổng phải đúng bằng cửa sổ thanh toán");
    }

    /** Đọc giá trị một tham số trong query string của URL thanh toán. */
    private String extractParam(String url, String name) {
        for (String pair : url.substring(url.indexOf('?') + 1).split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && name.equals(pair.substring(0, eq))) {
                return pair.substring(eq + 1);
            }
        }
        throw new AssertionError("Không tìm thấy tham số " + name + " trong " + url);
    }

    @Test
    @DisplayName("Thanh toán thành công thì lưu giao dịch kèm mã và đóng cửa sổ thanh toán")
    void handleVNPayIPN_Success_RecordsTransaction() {
        booking.setPaymentExpiresAt(LocalDateTime.now().plusMinutes(10));
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_OK"));

        assertEquals("00", result.get("RspCode"));
        assertEquals("CONFIRMED", booking.getStatus());
        assertNull(booking.getPaymentExpiresAt(), "thanh toán xong thì đóng cửa sổ thanh toán");

        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(payment.capture());
        assertEquals("SUCCESS", payment.getValue().getPaymentStatus());
        assertEquals("TXN_OK", payment.getValue().getTransactionRef());
        verify(refundRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tiền về sau khi đơn đã bị hủy thì phải mở yêu cầu hoàn tiền, không được bỏ qua")
    void handleVNPayIPN_SuccessAfterBookingCancelled_OpensRefund() {
        booking.setStatus("CANCELLED"); // cleanup đã dọn đơn trong lúc khách còn ở cổng
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_LATE"));

        assertEquals("00", result.get("RspCode"), "phải nhận kết quả để cổng ngừng gọi lại");

        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(payment.capture());
        assertEquals("SUCCESS_NEEDS_REFUND", payment.getValue().getPaymentStatus());

        ArgumentCaptor<Refund> refund = ArgumentCaptor.forClass(Refund.class);
        verify(refundRepository).save(refund.capture());
        assertEquals("PENDING", refund.getValue().getStatus());
        assertEquals(0, BigDecimal.valueOf(100000).compareTo(refund.getValue().getRefundAmount()));
        assertEquals("CANCELLED", booking.getStatus(), "đơn đã hủy thì giữ nguyên, tiền xử lý qua hoàn tiền");
    }

    @Test
    @DisplayName("Cùng một giao dịch về hai lần (Return rồi IPN) chỉ được xử lý một lần")
    void handleVNPayIPN_DuplicateTransaction_IsIgnored() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));
        when(paymentRepository.existsByTransactionRef("TXN_DUP")).thenReturn(true);

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_DUP"));

        assertEquals("02", result.get("RspCode"));
        verify(paymentRepository, never()).save(any());
        verify(refundRepository, never()).save(any());
        assertEquals("PENDING", booking.getStatus(), "đơn phải giữ nguyên, không bị xử lý lần hai");
    }

    @Test
    @DisplayName("Thanh toán hỏng thì hoàn lại lượt voucher của đơn")
    void handleVNPayIPN_Failure_RefundsVoucherUsage() {
        booking.setVoucherCode("SALE50");
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("24", "TXN_FAIL"));

        assertEquals("00", result.get("RspCode"));
        assertEquals("FAILED", booking.getStatus());
        verify(voucherService).refundVoucherUsage("SALE50");
        verify(eventPublisher, never()).publishEvent(any(BookingConfirmedEvent.class));
    }
}
