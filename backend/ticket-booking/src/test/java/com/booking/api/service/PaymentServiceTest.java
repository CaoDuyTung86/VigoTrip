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
import com.booking.api.entity.PaymentLog;
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
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
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

    @Mock
    private VNPayQueryService vnPayQueryService;

    @Mock
    private PaymentLogService paymentLogService;

    /** Proxy của chính bean này — nửa ngoài của callback đi qua đây để vào nửa trong. */
    @Mock
    private ObjectProvider<PaymentService> self;

    @InjectMocks
    private PaymentService paymentService;

    /** IP giả của bên gọi vào endpoint callback — chỉ đi vào nhật ký, không ảnh hưởng xử lý. */
    private static final String CLIENT_IP = "203.0.113.7";

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

        // Mặc định: không hỏi được cổng. Đây đúng là hành vi cũ (trước khi có querydr), nên
        // mọi test sẵn có vẫn kiểm tra đúng thứ chúng vốn kiểm tra. Test nào cần cổng lên
        // tiếng thì tự stub lại.
        lenient().when(vnPayQueryService.verifySuccessfulCallback(any(), anyLong()))
                .thenReturn(VNPayQueryService.Verdict.UNAVAILABLE);

        // Lớp kiểm chứng bật, đúng như cấu hình mặc định. Test nào cần tắt thì tự stub lại.
        lenient().when(vnPayQueryService.isEnabled()).thenReturn(true);

        // Nửa ngoài của cả hai điểm vào callback gọi sang nửa trong qua proxy của Spring.
        // Trong unit test thì "proxy" chính là bean đang thử.
        lenient().when(self.getObject()).thenReturn(paymentService);

        user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setPoints(0);

        booking = new Booking();
        booking.setId(123L);
        booking.setUser(user);
        booking.setTotalPrice(java.math.BigDecimal.valueOf(100000));
        booking.setStatus("PENDING");

        // Nửa ngoài đọc đơn KHÔNG kèm khóa dòng, chỉ để biết số tiền cần hỏi cổng.
        lenient().when(bookingRepository.findById(123L)).thenReturn(Optional.of(booking));
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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

            assertEquals("SUCCESS", result);
            assertEquals("CONFIRMED", booking.getStatus());
            verify(bookingRepository).save(booking);
        }
    }

    @Test
    @DisplayName("Return: chữ ký hợp lệ nhưng số tiền không khớp thì KHÔNG xác nhận đơn")
    void handleVNPayReturn_AmountMismatch_DoesNotConfirmBooking() {
        // Kịch bản có thật khi hash-secret bị lộ: kẻ tấn công tự ký một URL Return hợp lệ
        // và khai số tiền tuỳ ý. Trước đây nhánh Return không đối chiếu vnp_Amount nên
        // đơn 100.000đ được xác nhận với 1.000đ khai khống.
        ipnParams.put("vnp_Amount", "100000"); // 1.000đ thay vì 100.000đ

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

            assertEquals("INVALID_AMOUNT", result);
            assertEquals("PENDING", booking.getStatus());
            verify(bookingRepository, never()).save(booking);
        }
    }

    @Test
    @DisplayName("Return: thiếu hẳn vnp_Amount cũng bị từ chối, không văng lỗi 500")
    void handleVNPayReturn_MissingAmount_IsRejected() {
        ipnParams.remove("vnp_Amount");

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

            assertEquals("INVALID_AMOUNT", result);
            assertEquals("PENDING", booking.getStatus());
        }
    }

    @Test
    @DisplayName("IPN: số tiền không khớp vẫn trả mã 04 như trước")
    void handleVNPayIPN_AmountMismatch_StillReturns04() {
        ipnParams.put("vnp_Amount", "100000");

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

            assertEquals("04", result.get("RspCode"));
            assertEquals("PENDING", booking.getStatus());
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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

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

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

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

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.empty());

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

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
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            Map<String, String> result = paymentService.handleVNPayIPN(ipnParams, CLIENT_IP);

            assertEquals("02", result.get("RspCode"));
            assertEquals("Order already confirmed", result.get("Message"));
        }
    }

    // ==================== Đối chiếu lại với cổng (querydr) ====================

    @Test
    @DisplayName("Return: cổng phủ nhận giao dịch thì KHÔNG giao vé, dù chữ ký hợp lệ")
    void handleVNPayReturn_GatewayContradicts_DoesNotConfirmBooking() {
        // Đây là lớp phòng thủ cho đúng tình huống hash-secret bị lộ: kẻ tấn công ký được
        // URL Return, nhưng không làm cho máy chủ VNPay khai ra một giao dịch không có thật.
        when(vnPayQueryService.verifySuccessfulCallback(any(), anyLong()))
                .thenReturn(VNPayQueryService.Verdict.CONTRADICTED);

        try (MockedStatic<VNPayUtil> mockedVNPayUtil = mockStatic(VNPayUtil.class)) {
            mockedVNPayUtil.when(() -> VNPayUtil.validateHash(any(), anyString())).thenReturn(true);
            when(vnPayConfig.getHashSecret()).thenReturn("secret");
            when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

            String result = paymentService.handleVNPayReturn(ipnParams, CLIENT_IP);

            assertEquals("UNVERIFIED", result);
            assertEquals("PENDING", booking.getStatus(), "đơn phải giữ nguyên, không được xác nhận");
            verify(paymentRepository, never()).saveAndFlush(any());
            verify(refundRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any(BookingConfirmedEvent.class));
        }
    }

    @Test
    @DisplayName("IPN: cổng phủ nhận thì trả 99 để cổng gửi lại, không đóng sổ bằng mã 00")
    void handleVNPayIPN_GatewayContradicts_AsksForRetry() {
        when(vnPayQueryService.verifySuccessfulCallback(any(), anyLong()))
                .thenReturn(VNPayQueryService.Verdict.CONTRADICTED);
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_FAKE"), CLIENT_IP);

        assertEquals("99", result.get("RspCode"));
        assertEquals("PENDING", booking.getStatus());
        verify(paymentRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Cổng xác nhận thì luồng giao vé chạy bình thường")
    void handleVNPayIPN_GatewayConfirms_ProceedsAsUsual() {
        when(vnPayQueryService.verifySuccessfulCallback(any(), anyLong()))
                .thenReturn(VNPayQueryService.Verdict.CONFIRMED);
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_REAL"), CLIENT_IP);

        assertEquals("00", result.get("RspCode"));
        assertEquals("CONFIRMED", booking.getStatus());
    }

    @Test
    @DisplayName("Callback báo THẤT BẠI thì không tốn một lời gọi querydr nào")
    void failedCallbackSkipsGatewayQuery() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        paymentService.handleVNPayIPN(signedCallback("24", "TXN_CANCELLED"), CLIENT_IP);

        verify(vnPayQueryService, never()).verifySuccessfulCallback(any(), anyLong());
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
        assertEquals(PaymentService.GATEWAY_WINDOW_MINUTES,
                Duration.between(createDate, expireDate).toMinutes(),
                "hạn gửi cổng phải đúng bằng cửa sổ của cổng");
    }

    @Test
    @DisplayName("Cửa sổ phía ta phải DÀI HƠN hạn của cổng, để callback phút chót kịp về")
    void localPaymentWindowOutlivesGatewayWindow() {
        // Bất biến này từng bị vi phạm bằng cách vô hình: cả hai vai trò dùng chung một hằng
        // số nên luôn bằng nhau, và giao dịch trả ở phút chót về tới nơi thì đơn đã bị hủy.
        assertTrue(PaymentService.PAYMENT_WINDOW_MINUTES > PaymentService.GATEWAY_WINDOW_MINUTES,
                "hai mốc bằng nhau thì không còn chỗ nào cho quãng ngân hàng xử lý");
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
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_OK"), CLIENT_IP);

        assertEquals("00", result.get("RspCode"));
        assertEquals("CONFIRMED", booking.getStatus());
        assertNull(booking.getPaymentExpiresAt(), "thanh toán xong thì đóng cửa sổ thanh toán");

        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).saveAndFlush(payment.capture());
        assertEquals("SUCCESS", payment.getValue().getPaymentStatus());
        assertEquals("TXN_OK", payment.getValue().getTransactionRef());
        verify(refundRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tiền về sau khi đơn đã bị hủy thì phải mở yêu cầu hoàn tiền, không được bỏ qua")
    void handleVNPayIPN_SuccessAfterBookingCancelled_OpensRefund() {
        booking.setStatus("CANCELLED"); // cleanup đã dọn đơn trong lúc khách còn ở cổng
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_LATE"), CLIENT_IP);

        assertEquals("00", result.get("RspCode"), "phải nhận kết quả để cổng ngừng gọi lại");

        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).saveAndFlush(payment.capture());
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
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));
        when(paymentRepository.existsByTransactionRefAndPaymentStatusNot(
                "TXN_DUP", PaymentService.PAYMENT_INITIATED)).thenReturn(true);

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_DUP"), CLIENT_IP);

        assertEquals("02", result.get("RspCode"));
        verify(paymentRepository, never()).saveAndFlush(any());
        verify(refundRepository, never()).save(any());
        assertEquals("PENDING", booking.getStatus(), "đơn phải giữ nguyên, không bị xử lý lần hai");
    }

    @Test
    @DisplayName("Thanh toán hỏng thì hoàn lại lượt voucher của đơn")
    void handleVNPayIPN_Failure_RefundsVoucherUsage() {
        booking.setVoucherCode("SALE50");
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("24", "TXN_FAIL"), CLIENT_IP);

        assertEquals("00", result.get("RspCode"));
        assertEquals("FAILED", booking.getStatus());
        verify(voucherService).refundVoucherUsage("SALE50");
        verify(eventPublisher, never()).publishEvent(any(BookingConfirmedEvent.class));
    }

    @Test
    @DisplayName("Dòng INITIATED của chính lần mở cổng KHÔNG được coi là đã xử lý")
    void handleVNPayIPN_InitiatedRowIsNotADuplicate() {
        // Đây là cái bẫy của việc ghi trước một dòng payment lúc mở cổng: dòng đó mang đúng
        // vnp_TxnRef mà callback sắp gửi về. Nếu chốt chống trùng đếm cả nó thì MỌI callback
        // đều bị coi là "đã xử lý" và không đơn nào còn được xác nhận nữa.
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));
        when(paymentRepository.existsByTransactionRefAndPaymentStatusNot(
                "TXN_NEW", PaymentService.PAYMENT_INITIATED)).thenReturn(false);

        Map<String, String> result = paymentService.handleVNPayIPN(signedCallback("00", "TXN_NEW"), CLIENT_IP);

        assertEquals("00", result.get("RspCode"));
        assertEquals("CONFIRMED", booking.getStatus(), "callback đầu tiên phải xác nhận được đơn");
    }

    @Test
    @DisplayName("Callback ghi đè dòng INITIATED sẵn có, không đẻ thêm dòng thanh toán thứ hai")
    void handleVNPayIPN_ReusesInitiatedRow() {
        Payment initiated = new Payment();
        initiated.setTransactionRef("TXN_NEW");
        initiated.setPaymentStatus(PaymentService.PAYMENT_INITIATED);

        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));
        when(paymentRepository.findByTransactionRef("TXN_NEW")).thenReturn(Optional.of(initiated));

        paymentService.handleVNPayIPN(signedCallback("00", "TXN_NEW"), CLIENT_IP);

        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).saveAndFlush(saved.capture());
        assertSame(initiated, saved.getValue(), "phải cập nhật lại đúng dòng cũ");
        assertEquals("SUCCESS", saved.getValue().getPaymentStatus());
    }

    @Test
    @DisplayName("Tắt kiểm chứng thì không dựng probe nào, cleanup chạy y như cũ")
    void planSweep_VerificationDisabled_BuildsNoProbe() {
        when(vnPayQueryService.isEnabled()).thenReturn(false);

        assertTrue(paymentService.planSweep(123L).isEmpty());
        verify(paymentRepository, never()).findByBooking_IdAndPaymentStatus(anyLong(), anyString());
    }

    @Test
    @DisplayName("Mỗi lần bấm sang cổng còn treo thành một probe, dựng xong TRƯỚC khi gọi ra ngoài")
    void planSweep_BuildsOneProbePerAttempt() {
        when(paymentRepository.findByBooking_IdAndPaymentStatus(123L, PaymentService.PAYMENT_INITIATED))
                .thenReturn(List.of(initiatedAttempt()));

        List<PaymentService.SweepProbe> probes = paymentService.planSweep(123L);

        assertEquals(1, probes.size());
        assertEquals("TXN_LOST", probes.get(0).txnRef());
        assertEquals(10000000L, probes.get(0).expectedAmount(), "phải quy về đơn vị của vnp_Amount");
        // Bước lập kế hoạch chạy trong transaction chỉ-đọc nên tuyệt đối không được chạm cổng.
        verify(vnPayQueryService, never()).verifyTransaction(anyString(), anyString(), anyLong());
    }

    @Test
    @DisplayName("Đơn quá hạn mà cổng xác nhận đã thu tiền thì được cứu, không bị hủy")
    void applySweepAnswers_GatewayConfirms_Recovers() {
        Payment attempt = initiatedAttempt();
        when(paymentRepository.findByTransactionRef("TXN_LOST")).thenReturn(Optional.of(attempt));

        PaymentService.SweepResult result = paymentService.applySweepAnswers(
                booking, List.of(answerFor(attempt, VNPayQueryService.Verdict.CONFIRMED)));

        assertEquals(PaymentService.SweepResult.RECOVERED, result);
        assertEquals("CONFIRMED", booking.getStatus(), "khoản tiền đã thu phải thành vé, không bị hủy");
        assertEquals("SUCCESS", attempt.getPaymentStatus());
        verify(eventPublisher).publishEvent(any(BookingConfirmedEvent.class));
    }

    @Test
    @DisplayName("Cổng khẳng định không có giao dịch thì cho phép hủy đơn")
    void applySweepAnswers_GatewayDenies_SafeToCancel() {
        Payment attempt = initiatedAttempt();
        when(paymentRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));

        PaymentService.SweepResult result = paymentService.applySweepAnswers(
                booking, List.of(answerFor(attempt, VNPayQueryService.Verdict.CONTRADICTED)));

        assertEquals(PaymentService.SweepResult.SAFE_TO_CANCEL, result);
        assertEquals("ABANDONED", attempt.getPaymentStatus(), "đã có câu trả lời dứt khoát, thôi hỏi lại");
    }

    @Test
    @DisplayName("Không hỏi được cổng thì GIỮ đơn lại, không hủy")
    void applySweepAnswers_GatewayUnreachable_Holds() {
        // Điểm mấu chốt của cả lớp kiểm chứng: "không hỏi được" khác "khách chưa trả tiền".
        PaymentService.SweepResult result = paymentService.applySweepAnswers(
                booking, List.of(answerFor(initiatedAttempt(), VNPayQueryService.Verdict.UNAVAILABLE)));

        assertEquals(PaymentService.SweepResult.HOLD, result);
        assertEquals("PENDING", booking.getStatus());
    }

    @Test
    @DisplayName("Đơn chưa từng bấm sang cổng thì hủy thẳng, không phải chờ ai trả lời")
    void applySweepAnswers_NoProbe_SafeToCancel() {
        assertEquals(PaymentService.SweepResult.SAFE_TO_CANCEL,
                paymentService.applySweepAnswers(booking, List.of()));
    }

    @Test
    @DisplayName("Câu trả lời nói về số tiền khác thì không dùng, đơn được giữ lại")
    void applySweepAnswers_AnswerAboutAnotherAmount_Holds() {
        // Giữa lúc hỏi cổng và lúc ghi kết quả không còn transaction nào bảo đảm đơn đứng yên.
        Payment attempt = initiatedAttempt();
        PaymentService.SweepAnswer stale = new PaymentService.SweepAnswer(
                new PaymentService.SweepProbe(123L, attempt.getId(), "TXN_LOST", "20260101000000", 999L),
                VNPayQueryService.Verdict.CONTRADICTED);

        assertEquals(PaymentService.SweepResult.HOLD,
                paymentService.applySweepAnswers(booking, List.of(stale)));
        assertEquals(PaymentService.PAYMENT_INITIATED, attempt.getPaymentStatus(),
                "không được đánh dấu bỏ dựa trên câu trả lời nói về con số khác");
    }

    @Test
    @DisplayName("Return khóa dòng đơn ở nửa trong, nơi kết quả được ghi")
    void handleVNPayReturn_LocksBookingRow() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        paymentService.handleVNPayReturn(signedCallback("00", "TXN_LOCK_RETURN"), CLIENT_IP);

        // Không có khóa dòng thì Return và IPN của cùng giao dịch (chúng về gần như cùng
        // lúc) cùng thấy "chưa xử lý" và cùng xác nhận đơn: hai mail xác nhận giống hệt
        // nhau và điểm thành viên bị tích hai lần. Bản đọc không khóa ở nửa ngoài chỉ dùng
        // để dựng câu hỏi gửi sang cổng, không quyết định gì.
        verify(bookingRepository).findByIdForUpdate(123L);
    }

    @Test
    @DisplayName("IPN khóa dòng đơn ở nửa trong, nơi kết quả được ghi")
    void handleVNPayIPN_LocksBookingRow() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        paymentService.handleVNPayIPN(signedCallback("00", "TXN_LOCK_IPN"), CLIENT_IP);

        verify(bookingRepository).findByIdForUpdate(123L);
    }

    @Test
    @DisplayName("Cổng được hỏi TRƯỚC khi khóa dòng đơn, không giữ khóa suốt quãng chờ mạng")
    void handleVNPayIPN_AsksGatewayBeforeLockingRow() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        paymentService.handleVNPayIPN(signedCallback("00", "TXN_ORDER"), CLIENT_IP);

        // Đây chính là thay đổi: lời gọi querydr — tới 9 giây trong trường hợp xấu — phải
        // xong trước khi transaction ghi mở ra và giành khóa dòng đơn.
        InOrder order = inOrder(vnPayQueryService, bookingRepository);
        order.verify(vnPayQueryService).verifySuccessfulCallback(any(), eq(10000000L));
        order.verify(bookingRepository).findByIdForUpdate(123L);
    }

    @Test
    @DisplayName("Callback thứ hai của cùng giao dịch chỉ báo lại kết quả, không gửi mail thêm lần nữa")
    void secondCallbackForSameTransaction_PublishesNoSecondEvent() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        Map<String, String> callback = signedCallback("00", "TXN_TWICE");
        paymentService.handleVNPayIPN(callback, CLIENT_IP);

        // Lượt đầu đã ghi xong dòng thanh toán; nhờ khóa dòng, lượt sau mới nhìn thấy nó.
        when(paymentRepository.existsByTransactionRefAndPaymentStatusNot(
                "TXN_TWICE", PaymentService.PAYMENT_INITIATED)).thenReturn(true);

        String second = paymentService.handleVNPayReturn(callback, CLIENT_IP);

        assertEquals("SUCCESS", second, "khách vẫn phải được đưa về trang thành công");
        verify(eventPublisher, times(1)).publishEvent(any(BookingConfirmedEvent.class));
    }

    @Test
    @DisplayName("Mỗi callback IPN để lại một dòng nhật ký, kèm đúng mã kết quả đã trả cho cổng")
    void handleVNPayIPN_WritesAuditLog() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));

        paymentService.handleVNPayIPN(signedCallback("00", "TXN_AUDIT"), CLIENT_IP);

        verify(paymentLogService).recordCallback(eq(PaymentLog.Channel.IPN), eq(123L), eq("TXN_AUDIT"),
                eq(Boolean.TRUE), eq("00"), eq(CLIENT_IP), any(), any());
    }

    @Test
    @DisplayName("Callback chữ ký sai vẫn để lại dấu vết — đó mới là callback đáng ghi nhất")
    void handleVNPayIPN_InvalidSignature_IsStillAudited() {
        when(vnPayConfig.getHashSecret()).thenReturn("secret");

        Map<String, String> forged = signedCallback("00", "TXN_FORGED");
        forged.put("vnp_SecureHash", "chu_ky_bia_dat");

        paymentService.handleVNPayIPN(forged, CLIENT_IP);

        // bookingId để trống: lượt xử lý dừng lại trước cả bước đọc mã đơn, và nhật ký phải
        // phản ánh đúng chuyện đó thay vì đoán thêm.
        verify(paymentLogService).recordCallback(eq(PaymentLog.Channel.IPN), isNull(), eq("TXN_FORGED"),
                eq(Boolean.FALSE), eq("97"), eq(CLIENT_IP), any(), any());
    }

    @Test
    @DisplayName("Chốt chặn chống trùng dưới DB nổ ra thì lỗi phải nổi lên tới controller, không bị nuốt")
    void handleVNPayIPN_DuplicateInDatabase_PropagatesOutOfTransaction() {
        // Nuốt lỗi ở trong sẽ vô nghĩa: transaction đã bị đánh dấu rollback-only, nên giá trị
        // trả về không bao giờ tới được cổng. Chỉ controller — nằm ngoài transaction — mới
        // trả lời được. Test này khoá lại đúng đường đi đó.
        when(vnPayConfig.getHashSecret()).thenReturn("secret");
        when(bookingRepository.findByIdForUpdate(123L)).thenReturn(Optional.of(booking));
        when(paymentRepository.saveAndFlush(any())).thenThrow(duplicateTxnRefViolation());

        Map<String, String> callback = signedCallback("00", "TXN_RACE");

        assertThrows(DataIntegrityViolationException.class,
                () -> paymentService.handleVNPayIPN(callback, CLIENT_IP));

        verify(paymentLogService).recordCallback(eq(PaymentLog.Channel.IPN), eq(123L), eq("TXN_RACE"),
                eq(Boolean.TRUE), eq(PaymentService.RESULT_DUPLICATE_TXN_REF), eq(CLIENT_IP), any(), any());
    }

    @Test
    @DisplayName("Chỉ nhận đúng lỗi của chốt chặn chống trùng, không vơ cả lỗi toàn vẹn khác")
    void isDuplicateTransactionRef_OnlyMatchesTheAntiDuplicateIndex() {
        assertTrue(PaymentService.isDuplicateTransactionRef(duplicateTxnRefViolation()));
        // Nhận nhầm một ràng buộc khác thành "trùng giao dịch" là báo cho cổng rằng đơn đã
        // xử lý xong trong khi thực tế nó vừa hỏng.
        assertFalse(PaymentService.isDuplicateTransactionRef(new DataIntegrityViolationException(
                "Violation of UNIQUE KEY constraint 'ux_don_hang_ma_don'")));
    }

    /** Lỗi SQL Server ném ra khi index chống trùng chặn một lượt ghi, gói đúng như Spring gói. */
    private static DataIntegrityViolationException duplicateTxnRefViolation() {
        return new DataIntegrityViolationException("could not execute statement",
                new SQLException("Cannot insert duplicate key row in object 'dbo.thanh_toan' with "
                        + "unique index '" + PaymentService.UNIQUE_TXN_REF_INDEX + "'."));
    }

    /** Một lần mở cổng đã ghi lại nhưng chưa có kết quả — đúng hình dạng của khoản tiền mất dấu. */
    /** Câu trả lời của cổng cho đúng một lần bấm sang cổng của {@link #booking}. */
    private PaymentService.SweepAnswer answerFor(Payment attempt, VNPayQueryService.Verdict verdict) {
        return new PaymentService.SweepAnswer(
                new PaymentService.SweepProbe(booking.getId(), attempt.getId(),
                        attempt.getTransactionRef(), "20260101000000", 10000000L),
                verdict);
    }

    private Payment initiatedAttempt() {
        Payment attempt = new Payment();
        attempt.setId(77L);
        attempt.setBooking(booking);
        attempt.setTransactionRef("TXN_LOST");
        attempt.setPaymentStatus(PaymentService.PAYMENT_INITIATED);
        attempt.setPaymentDate(LocalDateTime.now().minusMinutes(20));
        attempt.setAmount(BigDecimal.valueOf(100000));
        return attempt;
    }
}
