package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.util.VNPayUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Lớp kiểm chứng querydr chỉ có giá trị nếu nó phân biệt được đúng ba trạng thái: cổng xác
 * nhận, cổng phủ nhận, và không hỏi được cổng. Nhầm nhóm thứ ba thành nhóm thứ hai là chặn
 * nhầm khách đã trả tiền; nhầm nhóm thứ hai thành nhóm thứ ba là mở lại đúng cái lỗ hổng mà
 * lớp này sinh ra để bịt.
 */
class VNPayQueryServiceTest {

    private static final String API_URL = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private static final String TMN_CODE = "TMN123";
    private static final String HASH_SECRET = "secret-cua-merchant";
    private static final String TXN_REF = "abc123def456";
    private static final String PAY_DATE = "20260830101500";
    private static final long AMOUNT = 25_000_000L; // 250.000 VND x100

    private VNPayConfig config;
    private VNPayQueryService service;
    private MockRestServiceServer gateway;

    @BeforeEach
    void setUp() {
        config = new VNPayConfig();
        config.setTmnCode(TMN_CODE);
        config.setHashSecret(HASH_SECRET);
        config.setApiUrl(API_URL);

        RestClient.Builder builder = RestClient.builder();
        gateway = MockRestServiceServer.bindTo(builder).build();
        // Nhật ký giao dịch không phải đối tượng của bộ test này; bơm mock để lớp
        // kiểm chứng querydr vẫn đứng một mình.
        service = new VNPayQueryService(config, builder.build(), mock(PaymentLogService.class));
        ReflectionTestUtils.setField(service, "verifyCallback", true);
    }

    private Map<String, String> successCallback() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TxnRef", TXN_REF);
        params.put("vnp_PayDate", PAY_DATE);
        params.put("vnp_Amount", String.valueOf(AMOUNT));
        return params;
    }

    /** Phản hồi querydr tối thiểu, chỉ gồm các trường lớp này thực sự đọc. */
    private String gatewayReply(String responseCode, String transactionStatus, long amount) {
        return """
                {"vnp_ResponseCode":"%s","vnp_TransactionStatus":"%s","vnp_Amount":%d,\
                "vnp_TxnRef":"%s","vnp_Message":"Query success"}"""
                .formatted(responseCode, transactionStatus, amount, TXN_REF);
    }

    private void expectQuery(String body) {
        gateway.expect(requestTo(API_URL))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(jsonPath("$.vnp_Command").value("querydr"))
                .andExpect(jsonPath("$.vnp_TxnRef").value(TXN_REF))
                .andExpect(jsonPath("$.vnp_TransactionDate").value(PAY_DATE))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Cổng xác nhận đúng giao dịch và đúng số tiền -> CONFIRMED")
    void confirmsMatchingTransaction() {
        expectQuery(gatewayReply("00", "00", AMOUNT));

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.CONFIRMED);
        gateway.verify();
    }

    @Test
    @DisplayName("Cổng không tìm thấy giao dịch (91) -> CONTRADICTED, đây là chữ ký giả")
    void rejectsTransactionUnknownToGateway() {
        expectQuery(gatewayReply("91", "", 0));

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .as("callback khai thành công nhưng cổng chưa từng thấy giao dịch này")
                .isEqualTo(VNPayQueryService.Verdict.CONTRADICTED);
    }

    @Test
    @DisplayName("Cổng tìm thấy nhưng trạng thái không phải 00 -> CONTRADICTED")
    void rejectsUnsuccessfulTransaction() {
        expectQuery(gatewayReply("00", "02", AMOUNT));

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.CONTRADICTED);
    }

    @Test
    @DisplayName("Cổng báo số tiền khác với giá trị đơn -> CONTRADICTED")
    void rejectsAmountMismatch() {
        expectQuery(gatewayReply("00", "00", 1_000L));

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.CONTRADICTED);
    }

    @Test
    @DisplayName("Mã lỗi không kết luận được (94 - trùng yêu cầu) -> UNAVAILABLE, không chặn khách")
    void treatsUnknownResponseCodeAsInconclusive() {
        expectQuery(gatewayReply("94", "", 0));

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .as("ta hỏi chưa đúng cách thì không được quy kết cho giao dịch")
                .isEqualTo(VNPayQueryService.Verdict.UNAVAILABLE);
    }

    @Test
    @DisplayName("Cổng lỗi/không với tới được -> UNAVAILABLE, luồng thanh toán chạy như cũ")
    void treatsGatewayFailureAsInconclusive() {
        gateway.expect(requestTo(API_URL)).andRespond(withServerError());

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.UNAVAILABLE);
    }

    @Test
    @DisplayName("Callback báo thành công mà thiếu vnp_PayDate/vnp_TxnRef -> CONTRADICTED")
    void rejectsCallbackMissingQueryableFields() {
        // Nếu trả UNAVAILABLE thì kẻ giả mạo chỉ cần bỏ một tham số là vô hiệu hoá cả lớp
        // kiểm chứng — mà callback thành công thật của VNPay luôn có đủ hai trường này.
        Map<String, String> noPayDate = successCallback();
        noPayDate.remove("vnp_PayDate");
        assertThat(service.verifySuccessfulCallback(noPayDate, AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.CONTRADICTED);

        Map<String, String> noTxnRef = successCallback();
        noTxnRef.remove("vnp_TxnRef");
        assertThat(service.verifySuccessfulCallback(noTxnRef, AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.CONTRADICTED);

        // Không có request nào được gửi đi: dừng từ trước khi dựng lệnh truy vấn.
        gateway.verify();
    }

    @Test
    @DisplayName("Tắt bằng cấu hình -> UNAVAILABLE và không gọi mạng")
    void doesNothingWhenDisabled() {
        ReflectionTestUtils.setField(service, "verifyCallback", false);

        assertThat(service.verifySuccessfulCallback(successCallback(), AMOUNT))
                .isEqualTo(VNPayQueryService.Verdict.UNAVAILABLE);
        gateway.verify();
    }

    @Test
    @DisplayName("Chuỗi ký của querydr nối bằng '|' theo đúng thứ tự VNPay quy định")
    void buildsPipeJoinedSignature() {
        Map<String, String> payload = service.buildQueryPayload(TXN_REF, PAY_DATE);

        // Tự dựng lại chuỗi ký từ chính payload: sai thứ tự trường là cổng trả 97 mà không
        // nói rõ vì sao, nên phải khoá thứ tự này lại bằng test.
        String expectedHashData = String.join("|",
                payload.get("vnp_RequestId"),
                payload.get("vnp_Version"),
                payload.get("vnp_Command"),
                payload.get("vnp_TmnCode"),
                payload.get("vnp_TxnRef"),
                payload.get("vnp_TransactionDate"),
                payload.get("vnp_CreateDate"),
                payload.get("vnp_IpAddr"),
                payload.get("vnp_OrderInfo"));

        assertThat(payload.get("vnp_SecureHash"))
                .isEqualTo(VNPayUtil.hmacSHA512(HASH_SECRET, expectedHashData));
        assertThat(payload.get("vnp_Version")).isEqualTo("2.1.0");
        assertThat(payload.get("vnp_Command")).isEqualTo("querydr");
        assertThat(payload.get("vnp_TmnCode")).isEqualTo(TMN_CODE);
        assertThat(payload.get("vnp_TransactionDate")).isEqualTo(PAY_DATE);
        assertThat(payload.get("vnp_CreateDate")).hasSize(14);
    }

    @Test
    @DisplayName("Mỗi lần truy vấn dùng một vnp_RequestId khác nhau")
    void usesFreshRequestIdPerQuery() {
        assertThat(service.buildQueryPayload(TXN_REF, PAY_DATE).get("vnp_RequestId"))
                .isNotEqualTo(service.buildQueryPayload(TXN_REF, PAY_DATE).get("vnp_RequestId"));
    }
}
