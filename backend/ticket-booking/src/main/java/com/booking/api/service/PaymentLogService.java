package com.booking.api.service;

import com.booking.api.entity.PaymentLog;
import com.booking.api.repository.PaymentLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Ghi nhật ký giao dịch: mọi callback từ cổng, mọi lượt ta hỏi cổng, mọi quyết định hoàn tiền.
 *
 * Xem {@link PaymentLog} để biết vì sao cần một bảng chứ không chỉ log ứng dụng.
 *
 * NGUYÊN TẮC BẤT DI BẤT DỊCH CỦA LỚP NÀY: KHÔNG BAO GIỜ NÉM RA NGOÀI. Ghi chép hỏng thì
 * cùng lắm mất một dòng bằng chứng; ném lỗi ra ngoài là làm hỏng chính giao dịch mà nó sinh
 * ra để bảo vệ. Vì vậy mọi lối vào đều bọc try/catch tổng, kể cả phần commit của transaction
 * con — {@link PaymentLogWriter} nằm ở bean khác chính là để cái catch ở đây bắt được cả lỗi
 * xảy ra lúc commit.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentLogService {

    /** Dấu hiệu payload đã bị cắt bớt, để người đọc không tưởng cổng gửi thiếu. */
    private static final String TRUNCATED_MARKER = "...[CAT_BOT]";

    /** Chỗ của chữ ký sau khi bị lọc — để người đọc biết trường đó CÓ, chỉ là không lưu. */
    private static final String REDACTED = "[DA_LOC]";

    /**
     * Chữ ký nằm trong một phản hồi JSON của cổng, ví dụ {@code "vnp_SecureHash":"a1b2..."}.
     *
     * Phía yêu cầu đã được {@link #flatten} lọc sạch vì nó tới dưới dạng map, nhưng phản hồi
     * thì về dưới dạng chuỗi thô nên phải lọc bằng cách khác. Bỏ sót chỗ này nghĩa là mỗi
     * lượt querydr để lại một mẫu HMAC tạo bằng hash-secret nằm trong bảng — không phá được
     * khoá từ đó, nhưng cũng chẳng có lý do gì để nó ở đấy.
     */
    private static final Pattern SIGNATURE_IN_JSON = Pattern.compile(
            "(\"vnp_SecureHash(?:Type)?\"\\s*:\\s*\")[^\"]*(\")", Pattern.CASE_INSENSITIVE);

    /** Chữ ký nằm trong một chuỗi dạng {@code k=v&k=v}. */
    private static final Pattern SIGNATURE_IN_QUERY = Pattern.compile(
            "(vnp_SecureHash(?:Type)?=)[^&\\s]*", Pattern.CASE_INSENSITIVE);

    /**
     * Trần số dòng một lần tra cứu trả về.
     *
     * Không có màn hình nào duyệt cả bảng, và trần này giữ cho điều đó đúng cả khi ai đó
     * dựng thêm lối vào mới: một mã giao dịch thật chỉ để lại vài dòng, nên chạm trần nghĩa
     * là có gì đó bất thường chứ không phải nhu cầu hợp lệ.
     */
    public static final int MAX_LOOKUP_ROWS = 200;

    private final PaymentLogWriter writer;
    private final PaymentLogRepository repository;

    /**
     * Tắt được, nhưng mặc định BẬT: một cấu hình quên khai báo phải rơi về trạng thái giữ
     * lại nhiều bằng chứng hơn, không phải ít hơn.
     */
    @Value("${payment.audit.enabled:true}")
    private boolean enabled;

    /**
     * Giữ lâu hơn hẳn lịch sử chat (180 ngày so với 30) vì đây là dữ liệu tiền nong: tranh
     * chấp với ngân hàng và đối soát cuối kỳ đều tính bằng tháng, không phải bằng tuần.
     */
    @Value("${payment.audit.retention-days:180}")
    private int retentionDays;

    /** Ghi lại một callback Return/IPN, kể cả callback chữ ký sai hoặc bị từ chối. */
    public void recordCallback(PaymentLog.Channel channel, Long bookingId, String transactionRef,
                               Boolean signatureValid, String outcome, String sourceIp,
                               Map<String, String> params, String response) {
        save(PaymentLog.builder()
                .channel(channel)
                .bookingId(bookingId)
                .transactionRef(trim(transactionRef, 64))
                .signatureValid(signatureValid)
                .outcome(trim(outcome, 64))
                .sourceIp(trim(sourceIp, 64))
                .requestPayload(flatten(params))
                .responsePayload(truncate(redactSignatures(response))));
    }

    /**
     * Ghi lại một lượt hỏi cổng bằng querydr, cả lúc hỏi được lẫn lúc không.
     *
     * {@code signatureValid} nhận cả ba trạng thái: khớp, lệch, và {@code null} nghĩa là
     * phản hồi không mang chữ ký nào để đối chiếu — phản hồi mã 94 chỉ có hai trường, còn
     * lượt gọi hỏng thì không có phản hồi. Đây là cùng một quy ước với hai kênh callback,
     * nhờ vậy màn hình tra cứu đọc một cột duy nhất cho cả ba kênh.
     */
    public void recordQuery(String transactionRef, Boolean signatureValid, String outcome,
                            Map<String, String> request, String response) {
        save(PaymentLog.builder()
                .channel(PaymentLog.Channel.QUERYDR)
                .transactionRef(trim(transactionRef, 64))
                .signatureValid(signatureValid)
                .outcome(trim(outcome, 64))
                .requestPayload(flatten(request))
                .responsePayload(truncate(redactSignatures(response))));
    }

    /**
     * Ghi lại một quyết định hoàn tiền của con người.
     *
     * Đây là dòng nhật ký DUY NHẤT trong hệ thống trả lời được "ai đã đồng ý chi khoản này",
     * vì việc chuyển tiền hiện vẫn làm tay bên ngoài phần mềm. Không có nó thì bảng
     * {@code hoan_tien} chỉ nói trạng thái đã đổi, không nói ai đổi.
     */
    public void recordRefundDecision(PaymentLog.Channel channel, Long bookingId, String actor,
                                     String outcome, String detail) {
        save(PaymentLog.builder()
                .channel(channel)
                .bookingId(bookingId)
                .actor(trim(actor, 190))
                .outcome(trim(outcome, 64))
                .responsePayload(truncate(redactSignatures(detail))));
    }

    private void save(PaymentLog.PaymentLogBuilder builder) {
        if (!enabled) {
            return;
        }
        try {
            writer.write(builder.createdAt(LocalDateTime.now()).build());
        } catch (Exception e) {
            // Nuốt có chủ đích. Xem javadoc của lớp: mất một dòng nhật ký còn hơn hỏng
            // một giao dịch. In WARN chứ không ERROR vì bản thân giao dịch vẫn đang ổn.
            log.warn("Không ghi được nhật ký thanh toán: {}", e.toString());
        }
    }

    /**
     * Gộp bộ tham số thành một chuỗi đọc được, đã BỎ chữ ký.
     *
     * Sắp xếp theo tên tham số để hai dòng của cùng một giao dịch so sánh được bằng mắt —
     * thứ tự tự nhiên của map thay đổi theo từng lần nhận thì không đối chiếu được gì.
     *
     * Chữ ký bị loại vì nó không giúp truy vết (kết luận hợp lệ hay không đã nằm ở cột
     * {@code signature_valid}) mà lại là mẫu HMAC của hash-secret đang dùng — không có lý
     * do gì để nó nằm rải rác trong một bảng mà nhiều người đọc được.
     */
    static String flatten(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : new TreeMap<>(params).entrySet()) {
            if (isSecret(entry.getKey())) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return truncate(sb.toString());
    }

    private static boolean isSecret(String key) {
        return key != null && key.toLowerCase().contains("securehash");
    }

    /**
     * Bỏ chữ ký ra khỏi một payload dạng chuỗi thô (phản hồi của cổng, câu báo lỗi...).
     *
     * Lọc TRƯỚC khi cắt bớt: làm ngược lại thì một payload dài bị cắt ngang giữa chữ ký sẽ
     * để lọt một nửa chữ ký mà không lọc nào chạm tới nữa.
     */
    static String redactSignatures(String payload) {
        if (payload == null || payload.isEmpty()) {
            return payload;
        }
        String cleaned = SIGNATURE_IN_JSON.matcher(payload).replaceAll("$1" + REDACTED + "$2");
        return SIGNATURE_IN_QUERY.matcher(cleaned).replaceAll("$1" + REDACTED);
    }

    /**
     * Toàn bộ dấu vết của một mã giao dịch, theo đúng thứ tự đã xảy ra.
     *
     * Đây là đường tra cứu khi có tranh chấp: khách đưa mã giao dịch trong app ngân hàng.
     * CỐ Ý không có phương thức nào liệt kê cả bảng — muốn đọc thì phải biết trước mình
     * đang tìm gì, mà thứ đó do khách cung cấp. Nhờ vậy một tài khoản quản trị bị chiếm
     * cũng không "lướt" hay tải trọn được lịch sử giao dịch.
     */
    @Transactional(readOnly = true)
    public List<PaymentLog> findByTransactionRef(String transactionRef) {
        if (transactionRef == null || transactionRef.isBlank()) {
            return List.of();
        }
        return repository.findByTransactionRefOrderByCreatedAtAsc(
                transactionRef.trim(), PageRequest.of(0, MAX_LOOKUP_ROWS));
    }

    /**
     * Dấu vết theo đơn — dùng khi khách chỉ nhớ mã đơn chứ không có mã giao dịch.
     *
     * Hai bước chứ không một. Các dòng QUERYDR không mang mã đơn: lượt hỏi cổng xuất phát
     * từ {@code VNPayQueryService}, nơi chỉ biết mã giao dịch. Nếu chỉ lọc theo mã đơn thì
     * người vận hành thấy hai dòng callback mà không thấy ta đã hỏi lại cổng những gì —
     * đúng phần quan trọng nhất khi phân xử "khách nói đã trả, hệ thống nói chưa". Nên tìm
     * theo đơn trước, rồi bắc cầu qua chính những mã giao dịch vừa thấy.
     *
     * Không nới bề mặt tấn công: các mã giao dịch dùng ở bước hai đều lấy từ những dòng đã
     * thuộc về đơn này, chứ không phải do người gọi khai. Và một mã giao dịch chỉ thuộc về
     * một đơn duy nhất, vì index {@code ux_thanh_toan_transaction_ref} bắt nó là duy nhất.
     */
    @Transactional(readOnly = true)
    public List<PaymentLog> findByBookingId(Long bookingId) {
        if (bookingId == null) {
            return List.of();
        }
        PageRequest limit = PageRequest.of(0, MAX_LOOKUP_ROWS);
        List<PaymentLog> byBooking = repository.findByBookingIdOrderByCreatedAtAsc(bookingId, limit);

        Set<String> refs = byBooking.stream()
                .map(PaymentLog::getTransactionRef)
                .filter(ref -> ref != null && !ref.isBlank())
                .collect(Collectors.toSet());
        if (refs.isEmpty()) {
            return byBooking;
        }

        Map<Long, PaymentLog> merged = new LinkedHashMap<>();
        byBooking.forEach(row -> merged.put(row.getId(), row));
        repository.findByTransactionRefInOrderByCreatedAtAsc(refs, limit)
                .forEach(row -> merged.putIfAbsent(row.getId(), row));

        return merged.values().stream()
                .sorted(Comparator.comparing(PaymentLog::getCreatedAt)
                        .thenComparing(PaymentLog::getId))
                .limit(MAX_LOOKUP_ROWS)
                .toList();
    }

    /** Cắt cho vừa cột, kèm dấu hiệu để người đọc biết là bị cắt chứ không phải cổng gửi thiếu. */
    static String truncate(String value) {
        if (value == null || value.length() <= PaymentLog.MAX_PAYLOAD_CHARS) {
            return value;
        }
        return value.substring(0, PaymentLog.MAX_PAYLOAD_CHARS - TRUNCATED_MARKER.length())
                + TRUNCATED_MARKER;
    }

    /** Cắt cứng cho vừa các cột ngắn. Một giá trị dài bất thường không được phép làm hỏng lượt ghi. */
    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /**
     * Dọn nhật ký quá hạn, 3h15 sáng — lệch khỏi các job dọn chat (3h00, 3h30, 3h45) để
     * không có hai lệnh DELETE lớn chạy chồng lên nhau.
     */
    @Scheduled(cron = "${payment.audit.cleanup-cron:0 15 3 * * *}")
    @Transactional
    public void purgeExpiredLogs() {
        if (!enabled) {
            return;
        }
        int deleted = repository.deleteOlderThan(LocalDateTime.now().minusDays(retentionDays));
        if (deleted > 0) {
            log.info("[NhatKyThanhToan] Đã xóa {} dòng cũ hơn {} ngày.", deleted, retentionDays);
        }
    }
}
