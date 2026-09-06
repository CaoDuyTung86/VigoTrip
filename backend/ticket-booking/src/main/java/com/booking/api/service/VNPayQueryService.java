package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.util.VNPayUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.InetAddress;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Hỏi thẳng cổng VNPay xem một giao dịch có thật hay không, bằng lệnh {@code querydr}
 * (truy vấn kết quả giao dịch) trên merchant Web API.
 *
 * VÌ SAO CẦN: hai endpoint callback (Return và IPN) đều là public, và thứ duy nhất chứng
 * minh chúng đến từ cổng là chữ ký HMAC bằng hash-secret. Ai cầm được hash-secret là tự ký
 * được một URL Return "thanh toán thành công" và nhận vé mà không trả đồng nào — mà
 * hash-secret của dự án này thì đã từng bị đẩy lên Git công khai (xem
 * {@code StartupSecretsValidator}). Đổi khoá là bắt buộc, nhưng đổi khoá chỉ vá được một
 * lần lộ đã biết; querydr vá cả lớp lỗ hổng: kẻ tấn công dù có khoá cũng không khiến máy
 * chủ VNPay khai ra một giao dịch chưa từng tồn tại.
 *
 * NGUYÊN TẮC KẾT LUẬN: chỉ hạ {@link Verdict#CONTRADICTED} khi cổng trả lời rõ ràng rằng
 * giao dịch không tồn tại / không thành công / lệch tiền. Mọi trục trặc khác (mất mạng,
 * timeout, mã lỗi lạ, tắt cấu hình) đều là {@link Verdict#UNAVAILABLE} và luồng thanh toán
 * chạy y như trước. Fail-open ở đây là cố ý: nhầm theo hướng "không kết luận" thì cùng lắm
 * mất một lớp phòng thủ phụ, còn nhầm theo hướng từ chối là khách mất tiền mà không có vé.
 */
@Slf4j
@Service
public class VNPayQueryService {

    public enum Verdict {
        /** Cổng xác nhận: giao dịch có thật, trạng thái thành công, đúng số tiền. */
        CONFIRMED,
        /** Cổng phủ nhận: không tìm thấy giao dịch, hoặc nó không thành công, hoặc lệch tiền. */
        CONTRADICTED,
        /** Không hỏi được cổng, hoặc cổng trả lời không đủ để kết luận. */
        UNAVAILABLE
    }

    private static final String VERSION = "2.1.0";
    private static final String COMMAND = "querydr";

    /** Cổng đối chiếu mọi mốc thời gian theo giờ Việt Nam, không theo múi giờ của server. */
    private static final ZoneId VNPAY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** Mã cổng trả về khi KHÔNG tìm thấy giao dịch — đây chính là dấu hiệu của callback giả. */
    private static final String RSP_NOT_FOUND = "91";
    /** Mã "yêu cầu hợp lệ, có dữ liệu trả về". Bản thân nó chưa phải kết luận về giao dịch. */
    private static final String RSP_OK = "00";
    /** {@code vnp_TransactionStatus} = 00 mới là "giao dịch thành công". */
    private static final String TXN_SUCCESS = "00";

    /**
     * IP của chính máy chủ merchant, chỉ để điền vào {@code vnp_IpAddr} của yêu cầu truy vấn.
     * Cổng không dùng giá trị này để phân quyền, nhưng nó nằm trong chuỗi ký nên phải cố định
     * trong suốt vòng đời tiến trình. Giải tên một lần lúc nạp class, hỏng thì lùi về loopback.
     */
    private static final String MERCHANT_IP = resolveMerchantIp();

    private final VNPayConfig vnPayConfig;
    private final RestClient restClient;
    private final PaymentLogService paymentLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Tắt được vì bộ test và môi trường dev không có (và không nên có) đường ra Internet.
     * Mặc định BẬT: một cấu hình quên khai báo phải rơi về trạng thái an toàn hơn.
     */
    @Value("${vnpay.verify-callback:true}")
    private boolean verifyCallback;

    @Autowired
    public VNPayQueryService(VNPayConfig vnPayConfig, PaymentLogService paymentLogService) {
        this(vnPayConfig, defaultRestClient(), paymentLogService);
    }

    /** Dùng cho test: bơm RestClient đã gắn MockRestServiceServer. */
    VNPayQueryService(VNPayConfig vnPayConfig, RestClient restClient, PaymentLogService paymentLogService) {
        this.vnPayConfig = vnPayConfig;
        this.restClient = restClient;
        this.paymentLogService = paymentLogService;
    }

    /**
     * Timeout ngắn là bắt buộc: lời gọi này nằm trong transaction xử lý callback, nên mỗi
     * giây chờ là một giây giữ connection DB. 3s + 6s đủ rộng cho một round-trip sang cổng
     * và vẫn nhả kết nối trước khi pool kịp cạn.
     */
    private static RestClient defaultRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(6));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * Vì sao hỏi cổng — quyết định cách DIỄN GIẢI câu trả lời, không đổi câu hỏi.
     *
     * Cùng một mã 91 ("không tìm thấy giao dịch") mang hai ý nghĩa trái ngược: sau một
     * callback tự khai thành công, nó tố cáo callback giả; còn khi ta chủ động rà một đơn
     * quá hạn, nó chỉ nói khách chưa từng trả tiền — chuyện thường ngày. Không phân biệt thì
     * log sẽ hét "callback giả mạo" vào mặt mọi đơn khách bỏ dở.
     */
    public enum Purpose {
        /** Có callback tự khai đã thu tiền. Cổng phủ nhận = dấu hiệu giả mạo. */
        CALLBACK,
        /** Không có callback nào; ta tự đi hỏi. Cổng phủ nhận = khách không trả tiền. */
        SWEEP
    }

    /** Lớp kiểm chứng có đang bật không. Tắt thì mọi luồng phải chạy y như trước khi có nó. */
    public boolean isEnabled() {
        return verifyCallback;
    }

    /**
     * Hỏi cổng về một giao dịch mà ta chỉ biết mã và thời điểm tạo — KHÔNG cần callback nào.
     *
     * Đây là đường dùng cho việc rà đơn quá hạn: một giao dịch bị trừ tiền nhưng cổng không
     * gọi được callback nào về thì không để lại dấu vết gì trong hệ thống, và cách duy nhất
     * biết nó tồn tại là hỏi thẳng.
     *
     * @param transactionDate {@code vnp_CreateDate} đã gửi cho cổng lúc mở phiên, yyyyMMddHHmmss giờ VN
     */
    public Verdict verifyTransaction(String txnRef, String transactionDate, long expectedAmount) {
        if (!verifyCallback) {
            return Verdict.UNAVAILABLE;
        }
        if (trimToNull(txnRef) == null || trimToNull(transactionDate) == null) {
            return Verdict.UNAVAILABLE;
        }
        return query(txnRef.trim(), transactionDate.trim(), expectedAmount, Purpose.SWEEP);
    }

    /**
     * Đối chiếu một callback TỰ KHAI LÀ THÀNH CÔNG với dữ liệu bên cổng.
     *
     * @param callbackParams tham số nhận từ Return/IPN (đã qua kiểm tra chữ ký)
     * @param expectedAmount số tiền đúng của đơn, theo đơn vị của {@code vnp_Amount} (VND x100)
     */
    public Verdict verifySuccessfulCallback(Map<String, String> callbackParams, long expectedAmount) {
        if (!verifyCallback) {
            return Verdict.UNAVAILABLE;
        }

        String txnRef = trimToNull(callbackParams.get("vnp_TxnRef"));
        String payDate = trimToNull(callbackParams.get("vnp_PayDate"));

        // Cả hai trường này đều BẮT BUỘC có trong một callback thành công thật của VNPay, và
        // cả hai đều cần để dựng lệnh truy vấn. Thiếu thì đây là fail-closed CÓ CHỦ Ý: coi
        // "thiếu dữ liệu" là UNAVAILABLE đồng nghĩa với việc kẻ giả mạo chỉ cần bỏ bớt một
        // tham số là tắt được toàn bộ lớp kiểm chứng này.
        if (txnRef == null || payDate == null) {
            log.error("Callback báo thành công nhưng thiếu vnp_TxnRef/vnp_PayDate (txnRef={}, payDate={}) — "
                    + "không đối chiếu được với cổng, từ chối", txnRef, payDate);
            return Verdict.CONTRADICTED;
        }

        return query(txnRef, payDate, expectedAmount, Purpose.CALLBACK);
    }

    /**
     * Một vòng gọi querydr: dựng payload, gửi, đọc kết luận. Dùng chung cho cả hai Purpose.
     *
     * Mọi lối ra đều đi qua khối finally để lại một dòng trong nhật ký giao dịch — kể cả lối
     * "không hỏi được cổng". Đó là chủ đích: về sau, "ĐÃ hỏi mà cổng không trả lời" và "chưa
     * từng hỏi" đòi hai cách xử lý khác hẳn nhau, mà nếu chỉ ghi những lượt hỏi thành công
     * thì hai trường hợp đó nhìn giống hệt nhau.
     *
     * Việc đọc và diễn giải phản hồi nằm TRONG khối try cùng với lời gọi mạng: một phản hồi
     * dị dạng làm hỏng bước diễn giải cũng phải rơi về UNAVAILABLE như mọi trục trặc khác,
     * theo đúng nguyên tắc fail-open ghi ở đầu lớp — chứ không được ném ngược lên và làm
     * hỏng luồng thanh toán mà lớp này chỉ đóng vai kiểm chứng phụ.
     */
    private Verdict query(String txnRef, String transactionDate, long expectedAmount, Purpose purpose) {
        Map<String, String> payload = buildQueryPayload(txnRef, transactionDate);
        String raw = null;
        Verdict verdict = Verdict.UNAVAILABLE;
        try {
            raw = restClient.post()
                    .uri(vnPayConfig.getApiUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(String.class);
            JsonNode body = raw == null ? null : objectMapper.readTree(raw);
            if (body == null) {
                log.warn("Cổng VNPay trả về phản hồi rỗng cho giao dịch {}", txnRef);
            } else {
                verdict = interpret(body, txnRef, expectedAmount, purpose);
            }
        } catch (Exception e) {
            // Cổng lỗi / chậm / không với tới được: đó không phải bằng chứng chống lại giao dịch.
            log.warn("Không truy vấn được giao dịch {} tại cổng VNPay: {}", txnRef, e.toString());
            if (raw == null) {
                // Lưu lại chính câu báo lỗi làm "phản hồi": đây là toàn bộ những gì ta biết
                // về lượt hỏi này, và nó phân biệt được timeout với lỗi phía cổng.
                raw = "LOI_KHI_GOI_CONG: " + e;
            }
        } finally {
            paymentLogService.recordQuery(txnRef, verdict.name(), payload, raw);
        }
        return verdict;
    }

    /**
     * Dựng phần thân JSON của lệnh querydr.
     *
     * Chuỗi ký của lệnh này KHÔNG giống lúc tạo URL thanh toán: nó là các giá trị nối bằng
     * dấu gạch đứng theo đúng thứ tự dưới đây — không sort, không URL-encode. Sai một vị trí
     * là cổng trả 97 (sai checksum) chứ không báo gì cụ thể hơn.
     */
    Map<String, String> buildQueryPayload(String txnRef, String transactionDate) {
        String requestId = String.valueOf(ThreadLocalRandom.current().nextLong(10_000_000L, 100_000_000L));
        String createDate = LocalDateTime.now(VNPAY_ZONE).format(TIMESTAMP);
        String orderInfo = "Kiem tra ket qua GD OrderId:" + txnRef;
        String tmnCode = vnPayConfig.getTmnCode();

        String hashData = String.join("|",
                requestId, VERSION, COMMAND, tmnCode, txnRef, transactionDate, createDate, MERCHANT_IP, orderInfo);

        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("vnp_RequestId", requestId);
        payload.put("vnp_Version", VERSION);
        payload.put("vnp_Command", COMMAND);
        payload.put("vnp_TmnCode", tmnCode);
        payload.put("vnp_TxnRef", txnRef);
        payload.put("vnp_OrderInfo", orderInfo);
        payload.put("vnp_TransactionDate", transactionDate);
        payload.put("vnp_CreateDate", createDate);
        payload.put("vnp_IpAddr", MERCHANT_IP);
        payload.put("vnp_SecureHash", VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData));
        return payload;
    }

    /** Đọc phản hồi querydr thành một kết luận. Tách riêng để test được mà không cần mạng. */
    Verdict interpret(JsonNode body, String txnRef, long expectedAmount) {
        return interpret(body, txnRef, expectedAmount, Purpose.CALLBACK);
    }

    Verdict interpret(JsonNode body, String txnRef, long expectedAmount, Purpose purpose) {
        logChecksumMismatch(body, txnRef);

        String responseCode = text(body, "vnp_ResponseCode");
        if (RSP_NOT_FOUND.equals(responseCode)) {
            if (purpose == Purpose.CALLBACK) {
                log.error("Cổng VNPay KHÔNG tìm thấy giao dịch {} nhưng callback lại báo thành công — "
                        + "gần như chắc chắn là callback giả mạo", txnRef);
            } else {
                log.info("Cổng VNPay không có giao dịch {} — đơn này thật sự chưa được thanh toán", txnRef);
            }
            return Verdict.CONTRADICTED;
        }
        if (!RSP_OK.equals(responseCode)) {
            // 02 sai TmnCode, 03 sai định dạng, 94 trùng yêu cầu, 97 sai checksum, 99 lỗi khác.
            // Tất cả đều là "ta hỏi chưa đúng cách", không phải "giao dịch không có thật".
            log.warn("Truy vấn giao dịch {} trả về vnp_ResponseCode={} ({}) — chưa kết luận được",
                    txnRef, responseCode, text(body, "vnp_Message"));
            return Verdict.UNAVAILABLE;
        }

        String transactionStatus = text(body, "vnp_TransactionStatus");
        if (!TXN_SUCCESS.equals(transactionStatus)) {
            if (purpose == Purpose.CALLBACK) {
                log.error("Cổng VNPay báo giao dịch {} ở trạng thái {} (không phải thành công) "
                        + "trong khi callback khai là đã thanh toán", txnRef, transactionStatus);
            } else {
                log.info("Giao dịch {} ở trạng thái {} tại cổng — không phải một khoản đã thu",
                        txnRef, transactionStatus);
            }
            return Verdict.CONTRADICTED;
        }

        String amountText = text(body, "vnp_Amount");
        Long declared = parseLongOrNull(amountText);
        if (declared == null) {
            log.warn("Cổng VNPay trả về vnp_Amount không đọc được ({}) cho giao dịch {}", amountText, txnRef);
            return Verdict.UNAVAILABLE;
        }
        if (declared != expectedAmount) {
            log.error("Cổng VNPay báo giao dịch {} thu {} nhưng đơn trị giá {} (cùng đơn vị vnp_Amount)",
                    txnRef, declared, expectedAmount);
            return Verdict.CONTRADICTED;
        }
        return Verdict.CONFIRMED;
    }

    /**
     * Đối chiếu chữ ký của phản hồi. CỐ Ý chỉ ghi log chứ không đổi kết luận.
     *
     * Thứ thật sự chứng thực phản hồi này là TLS tới đúng tên miền của cổng — kẻ giả mạo
     * callback không nằm trên đường ta gọi ra. Chữ ký chỉ là lớp đối chiếu thêm, mà công
     * thức nối chuỗi của nó lại không hồi quy được bằng unit test (phải có phản hồi thật từ
     * cổng mới biết đúng sai). Để nó phủ quyết thì một sai sót về thứ tự trường sẽ chặn đứng
     * mọi thanh toán — cái giá quá đắt cho một lớp phòng thủ dư.
     */
    private void logChecksumMismatch(JsonNode body, String txnRef) {
        String provided = text(body, "vnp_SecureHash");
        if (provided.isEmpty()) {
            return;
        }
        String hashData = String.join("|",
                text(body, "vnp_ResponseId"), text(body, "vnp_Command"), text(body, "vnp_ResponseCode"),
                text(body, "vnp_Message"), text(body, "vnp_TmnCode"), text(body, "vnp_TxnRef"),
                text(body, "vnp_Amount"), text(body, "vnp_BankCode"), text(body, "vnp_PayDate"),
                text(body, "vnp_TransactionNo"), text(body, "vnp_TransactionType"),
                text(body, "vnp_TransactionStatus"), text(body, "vnp_PromotionCode"),
                text(body, "vnp_PromotionAmount"));
        String expected = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);
        if (!expected.equalsIgnoreCase(provided)) {
            log.warn("Chữ ký phản hồi querydr của giao dịch {} không khớp. Kết luận vẫn dựa trên nội dung "
                    + "phản hồi (TLS đã bảo đảm nguồn gốc); nếu cảnh báo này xuất hiện ở MỌI giao dịch "
                    + "thì hãy kiểm tra lại thứ tự trường trong chuỗi nối.", txnRef);
            logChecksumEvidence(body, hashData, expected, provided);
        }
    }

    /**
     * Dữ liệu thô để dò ra công thức nối đúng, in kèm mỗi lần checksum lệch.
     *
     * Công thức nối chuỗi của phản hồi querydr là thứ duy nhất trong lớp này không hồi quy
     * được bằng unit test: phải có một phản hồi thật từ cổng mới biết đúng sai. Không in ba
     * thứ dưới đây thì mỗi lần dò lại tốn một vòng deploy cộng một giao dịch thật, mà vẫn
     * chỉ biết "sai" chứ không biết sai ở đâu.
     *
     * - {@code hashData}: chuỗi CHÍNH TA đã nối. So nó với thứ tự trường trong body là thấy
     *   ngay lệch ở vị trí nào, hoặc trường nào cổng trả về mà ta bỏ sót.
     * - body: nguồn sự thật để thử lại các thứ tự khác OFFLINE, không cần giao dịch mới.
     * - hai chữ ký: xác nhận đúng là lệch nội dung chứ không phải lệch hoa/thường hay rỗng.
     *
     * KHÔNG lộ bí mật: hash-secret là KHOÁ của HMAC, không nằm trong chuỗi bị băm. Phản hồi
     * querydr cũng không chứa số thẻ — chỉ mã giao dịch, số tiền, mã ngân hàng, thời gian.
     *
     * Đọc kỹ {@code vnp_ResponseCode} trong body trước khi kết luận thứ tự trường sai: khi mã
     * này khác "00" (94 trùng yêu cầu, 02 sai TmnCode...) thì phản hồi vốn đã thiếu trường,
     * và checksum lệch chỉ là HỆ QUẢ. Chỉ thứ tự trường mới làm nó lệch ở cả phản hồi mã 00.
     */
    private void logChecksumEvidence(JsonNode body, String hashData, String expected, String provided) {
        log.warn("Chuỗi ký querydr ta dựng: [{}]", hashData);
        log.warn("Phản hồi querydr thô: {}", body);
        log.warn("Chữ ký ta tính={}, cổng gửi={}", expected, provided);
    }

    private static String text(JsonNode body, String field) {
        JsonNode node = body.get(field);
        return node == null || node.isNull() ? "" : node.asText();
    }

    private static Long parseLongOrNull(String value) {
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException | NullPointerException e) {
            return null;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String resolveMerchantIp() {
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "127.0.0.1";
        }
    }
}
