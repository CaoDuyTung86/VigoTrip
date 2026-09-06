package com.booking.api.controller;

import com.booking.api.dto.PaymentLogResponse;
import com.booking.api.entity.PaymentLog;
import com.booking.api.exception.BookingException;
import com.booking.api.service.PaymentLogService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Endpoint này mở một bảng 180 ngày lịch sử tiền nong ra web, nên thứ đáng khoá lại bằng
 * test không phải là "tra cứu có chạy không" mà là RANH GIỚI của nó: không có đường nào
 * lấy được dữ liệu nếu chưa biết trước mình đang tìm gì.
 */
@ExtendWith(MockitoExtension.class)
class AdminPaymentLogControllerTest {

    @Mock
    private PaymentLogService paymentLogService;

    @InjectMocks
    private AdminPaymentLogController controller;

    private final UserDetails admin = User.withUsername("admin@gmail.com")
            .password("x").authorities("ROLE_ADMIN").build();

    @Test
    @DisplayName("Không truyền tham số nào thì bị từ chối, không trả về gì hết")
    void lookup_WithoutAnyCriteria_IsRejected() {
        // Đây là dòng chặn quan trọng nhất của lớp này: nếu gọi trống mà vẫn ra dữ liệu thì
        // endpoint tra cứu lặng lẽ biến thành endpoint tải cả bảng.
        assertThrows(BookingException.class, () -> controller.lookup(admin, null, null));
        assertThrows(BookingException.class, () -> controller.lookup(admin, "   ", null));
        verifyNoInteractions(paymentLogService);
    }

    @Test
    @DisplayName("Truyền cả hai tham số cũng bị từ chối, để không có đường nào mơ hồ")
    void lookup_WithBothCriteria_IsRejected() {
        assertThrows(BookingException.class, () -> controller.lookup(admin, "TXN1", 49L));
        verifyNoInteractions(paymentLogService);
    }

    @Test
    @DisplayName("Tra theo mã giao dịch trả về đúng dấu vết của mã đó")
    void lookup_ByTransactionRef_ReturnsTrail() {
        when(paymentLogService.findByTransactionRef("TXN1")).thenReturn(List.of(entry()));

        List<PaymentLogResponse> result = controller.lookup(admin, "TXN1", null);

        assertAll(
                () -> assertEquals(1, result.size()),
                () -> assertEquals("IPN", result.get(0).channel()),
                () -> assertEquals("TXN1", result.get(0).transactionRef()),
                () -> assertEquals(49L, result.get(0).bookingId()));
    }

    @Test
    @DisplayName("Tra theo mã đơn đi đúng đường của nó, không nhầm sang đường mã giao dịch")
    void lookup_ByBookingId_UsesBookingLookup() {
        when(paymentLogService.findByBookingId(49L)).thenReturn(List.of(entry()));

        controller.lookup(admin, null, 49L);

        verify(paymentLogService).findByBookingId(49L);
    }

    private static PaymentLog entry() {
        return PaymentLog.builder()
                .id(1L)
                .createdAt(LocalDateTime.now())
                .channel(PaymentLog.Channel.IPN)
                .bookingId(49L)
                .transactionRef("TXN1")
                .signatureValid(Boolean.TRUE)
                .outcome("00")
                .sourceIp("203.0.113.7")
                .requestPayload("vnp_Amount=10000000&vnp_TxnRef=TXN1")
                .responsePayload("Message=Confirm Success&RspCode=00")
                .build();
    }
}
