package com.booking.api.service;

import com.booking.api.entity.PaymentLog;
import com.booking.api.repository.PaymentLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Nhật ký giao dịch chỉ đáng tin nếu nó giữ được hai lời hứa trái chiều nhau: ghi lại ĐỦ để
 * phân xử một tranh chấp tiền nong, mà KHÔNG bao giờ làm hỏng chính giao dịch nó đang ghi.
 * Mỗi test dưới đây khoá lại một trong hai.
 */
@ExtendWith(MockitoExtension.class)
class PaymentLogServiceTest {

    @Mock
    private PaymentLogWriter writer;

    @Mock
    private PaymentLogRepository repository;

    @InjectMocks
    private PaymentLogService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "retentionDays", 180);
    }

    @Test
    @DisplayName("Chữ ký bị loại khỏi payload lưu lại, các tham số còn lại được sắp xếp")
    void flatten_DropsSignatureAndSortsTheRest() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_TxnRef", "TXN1");
        params.put("vnp_SecureHash", "0123456789abcdef");
        params.put("vnp_Amount", "10000000");
        params.put("vnp_SecureHashType", "SHA512");

        String flattened = PaymentLogService.flatten(params);

        assertAll(
                // Kết luận về chữ ký đã nằm ở cột signature_valid; giữ thêm chính chữ ký chỉ
                // là rải mẫu HMAC của hash-secret vào một bảng nhiều người đọc được.
                () -> assertFalse(flattened.contains("0123456789abcdef"), "không được lưu chữ ký"),
                () -> assertFalse(flattened.contains("SecureHashType"), "kể cả loại chữ ký"),
                // Sắp xếp để hai dòng của cùng một giao dịch so được bằng mắt.
                () -> assertEquals("vnp_Amount=10000000&vnp_TxnRef=TXN1", flattened));
    }

    @Test
    @DisplayName("Chữ ký trong phản hồi JSON của cổng cũng bị lọc, không chỉ ở chiều gửi đi")
    void redactSignatures_StripsGatewayResponseSignature() {
        String gatewayResponse = "{\"vnp_ResponseCode\":\"00\",\"vnp_TxnRef\":\"TXN1\","
                + "\"vnp_SecureHash\":\"9f8e7d6c5b4a39281706\"}";

        String cleaned = PaymentLogService.redactSignatures(gatewayResponse);

        assertAll(
                () -> assertFalse(cleaned.contains("9f8e7d6c5b4a39281706"), "không được lưu chữ ký"),
                // Giữ lại TÊN trường để người đọc biết cổng có gửi chữ ký, chỉ là ta không lưu.
                () -> assertTrue(cleaned.contains("vnp_SecureHash"), "vẫn phải thấy trường đó tồn tại"),
                () -> assertTrue(cleaned.contains("[DA_LOC]")),
                () -> assertTrue(cleaned.contains("\"vnp_TxnRef\":\"TXN1\""), "phần còn lại giữ nguyên"));
    }

    @Test
    @DisplayName("Chữ ký ở dạng chuỗi k=v cũng bị lọc")
    void redactSignatures_StripsQueryStringSignature() {
        String cleaned = PaymentLogService.redactSignatures(
                "vnp_Amount=10000000&vnp_SecureHash=deadbeefcafe&vnp_TxnRef=TXN1");

        assertAll(
                () -> assertFalse(cleaned.contains("deadbeefcafe")),
                () -> assertTrue(cleaned.contains("vnp_Amount=10000000")),
                () -> assertTrue(cleaned.contains("vnp_TxnRef=TXN1"), "không được ăn lẹm sang tham số sau"));
    }

    @Test
    @DisplayName("Phản hồi querydr lưu xuống DB đã sạch chữ ký")
    void recordQuery_StoresRedactedResponse() {
        service.recordQuery("TXN1", "CONFIRMED", Map.of("vnp_TxnRef", "TXN1"),
                "{\"vnp_TransactionStatus\":\"00\",\"vnp_SecureHash\":\"9f8e7d6c5b4a\"}");

        ArgumentCaptor<PaymentLog> entry = ArgumentCaptor.forClass(PaymentLog.class);
        verify(writer).write(entry.capture());
        assertFalse(entry.getValue().getResponsePayload().contains("9f8e7d6c5b4a"));
    }

    @Test
    @DisplayName("Tra cứu bằng mã rỗng trả về danh sách trống, không đụng tới DB")
    void findByTransactionRef_BlankInputHitsNothing() {
        // Mã rỗng mà vẫn đi xuống DB thì thành một truy vấn quét bảng do người dùng điều
        // khiển — đúng thứ mà thiết kế "phải biết trước mã" sinh ra để tránh.
        assertTrue(service.findByTransactionRef("  ").isEmpty());
        assertTrue(service.findByTransactionRef(null).isEmpty());
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("Payload dài quá cột thì bị cắt kèm dấu hiệu, không làm hỏng lượt ghi")
    void truncate_MarksCutPayloads() {
        String oversized = "x".repeat(PaymentLog.MAX_PAYLOAD_CHARS + 500);

        String truncated = PaymentLogService.truncate(oversized);

        assertAll(
                () -> assertEquals(PaymentLog.MAX_PAYLOAD_CHARS, truncated.length()),
                // Không có dấu hiệu này thì người đọc sau sẽ tưởng cổng gửi thiếu dữ liệu.
                () -> assertTrue(truncated.endsWith("[CAT_BOT]"), "phải nói rõ là đã bị cắt"));
    }

    @Test
    @DisplayName("Ghi được nhật ký callback kèm đủ mã đơn, mã giao dịch và kết luận chữ ký")
    void recordCallback_StoresTheEvidence() {
        service.recordCallback(PaymentLog.Channel.IPN, 123L, "TXN1", Boolean.TRUE,
                "00", "203.0.113.7", Map.of("vnp_Amount", "10000000"), "RspCode=00");

        ArgumentCaptor<PaymentLog> entry = ArgumentCaptor.forClass(PaymentLog.class);
        verify(writer).write(entry.capture());

        PaymentLog saved = entry.getValue();
        assertAll(
                () -> assertEquals(PaymentLog.Channel.IPN, saved.getChannel()),
                () -> assertEquals(123L, saved.getBookingId()),
                () -> assertEquals("TXN1", saved.getTransactionRef()),
                () -> assertEquals(Boolean.TRUE, saved.getSignatureValid()),
                () -> assertEquals("00", saved.getOutcome()),
                () -> assertEquals("203.0.113.7", saved.getSourceIp()),
                () -> assertEquals("vnp_Amount=10000000", saved.getRequestPayload()),
                () -> assertTrue(saved.getCreatedAt() != null, "thiếu mốc thời gian thì vô dụng"));
    }

    @Test
    @DisplayName("Lỗi khi ghi nhật ký KHÔNG được ném ra ngoài làm hỏng giao dịch")
    void record_NeverThrows() {
        // Đây là lời hứa quan trọng nhất của lớp này. Mất một dòng bằng chứng là chuyện nhỏ;
        // đánh sập một lượt thanh toán vì không ghi nổi nhật ký thì đúng là tự bắn vào chân.
        doThrow(new RuntimeException("DB đang chết")).when(writer).write(any());

        assertDoesNotThrow(() -> service.recordCallback(PaymentLog.Channel.RETURN, 1L, "TXN1",
                Boolean.TRUE, "SUCCESS", "203.0.113.7", Map.of(), "SUCCESS"));
    }

    @Test
    @DisplayName("Tắt cấu hình thì không ghi gì cả")
    void disabled_WritesNothing() {
        ReflectionTestUtils.setField(service, "enabled", false);

        service.recordQuery("TXN1", "CONFIRMED", Map.of(), "{}");

        verify(writer, never()).write(any());
    }

    @Test
    @DisplayName("Job dọn xóa đúng phần cũ hơn hạn lưu trữ")
    void purge_DeletesOlderThanRetention() {
        when(repository.deleteOlderThan(any())).thenReturn(7);

        LocalDateTime before = LocalDateTime.now().minusDays(180);
        service.purgeExpiredLogs();
        LocalDateTime after = LocalDateTime.now().minusDays(180);

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteOlderThan(cutoff.capture());
        assertTrue(!cutoff.getValue().isBefore(before) && !cutoff.getValue().isAfter(after),
                "mốc cắt phải là đúng retention-days tính từ bây giờ");
    }
}
