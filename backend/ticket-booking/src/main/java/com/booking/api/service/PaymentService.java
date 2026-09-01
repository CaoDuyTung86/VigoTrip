package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.dto.BookingConfirmationMail;
import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Payment;
import com.booking.api.entity.Refund;
import com.booking.api.entity.User;
import com.booking.api.event.BookingConfirmedEvent;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PaymentRepository;
import com.booking.api.repository.PromotionRepository;
import com.booking.api.repository.RefundRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.util.VNPayUtil;
import com.booking.api.entity.Ticket;
import com.booking.api.controller.SeatStatusController.SeatStatusUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    /**
     * Hạn phiên thanh toán báo cho cổng ({@code vnp_ExpireDate}). Khách nhìn thấy đúng con số
     * này đếm ngược trên trang của VNPay, nên đổi nó là đổi thứ khách đang nhìn.
     */
    public static final int GATEWAY_WINDOW_MINUTES = 15;

    /**
     * Cửa sổ mà BookingCleanupService không được đụng vào đơn.
     *
     * PHẢI LỚN HƠN {@link #GATEWAY_WINDOW_MINUTES}, không được bằng. Trước đây hai vai trò
     * này dùng chung một hằng số, nghĩa là cổng và ta đóng cửa đúng cùng một giây — trong khi
     * giữa lúc khách bấm trả tiền và lúc callback về còn cả quãng ngân hàng xử lý, 60–90 giây
     * là chuyện bình thường. Khách bấm ở phút 14:30 thì cổng vẫn nhận, nhưng callback về ở
     * phút ~16 đã thấy đơn bị hủy: tiền trừ rồi mà không có vé, phải đi đường hoàn tiền tay.
     *
     * Phần dôi ra chỉ là thời gian CHỜ CALLBACK chứ không phải thời gian trả tiền: cổng đã tự
     * đóng phiên ở phút 15 nên trong quãng đệm này không ai mở được giao dịch mới nữa.
     */
    public static final int PAYMENT_WINDOW_MINUTES = GATEWAY_WINDOW_MINUTES + 5;

    /**
     * Cổng VNPay đối chiếu vnp_CreateDate/vnp_ExpireDate theo giờ Việt Nam (GMT+7), không
     * theo múi giờ của server. Container deploy chạy UTC nên LocalDateTime.now() lùi 7 tiếng,
     * cổng đọc vnp_ExpireDate thấy đã qua và trả về "Giao dịch đã quá thời gian chờ thanh toán"
     * ngay khi vừa mở trang. Vì vậy hai tham số ngày giờ gửi sang cổng luôn lấy theo zone này.
     */
    private static final ZoneId VNPAY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Đơn ở các trạng thái này nghĩa là khách KHÔNG nhận được vé. */
    private static final Set<String> UNFULFILLED_STATUSES = Set.of("CANCELLED", "FAILED");

    /**
     * Đã dựng URL sang cổng, chưa biết kết quả. KHÔNG phải một khoản tiền đã thu — dòng này
     * tồn tại chỉ để giữ lại vnp_TxnRef và thời điểm mở phiên, hai thứ bắt buộc phải có mới
     * hỏi lại cổng được về sau.
     */
    static final String PAYMENT_INITIATED = "INITIATED";

    /** Cổng đã khẳng định lần thử này không thành công — thôi hỏi lại về nó. */
    private static final String PAYMENT_ABANDONED = "ABANDONED";

    /** Kết quả rà một đơn PENDING quá hạn với cổng, trước khi cho phép hủy nó. */
    public enum SweepResult {
        /** Không có lần mở cổng nào, hoặc cổng khẳng định không khoản nào được thu. */
        SAFE_TO_CANCEL,
        /** Cổng xác nhận đã thu tiền — đơn vừa được xác nhận, TUYỆT ĐỐI không hủy. */
        RECOVERED,
        /** Chưa hỏi được cổng. Chưa đủ căn cứ để hủy; thử lại lượt sau. */
        HOLD
    }

    /** Kết quả của một lần cổng báo về, dùng chung cho cả Return lẫn IPN. */
    private enum PaymentOutcome { SUCCESS, FAILED, ALREADY_PROCESSED, LATE_NEEDS_REFUND, INVALID_AMOUNT, UNVERIFIED }

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final UserRepository userRepository;
    private final PromotionRepository promotionRepository;
    private final VNPayConfig vnPayConfig;
    private final ApplicationEventPublisher eventPublisher;
    private final SimpMessagingTemplate messagingTemplate;
    private final VoucherService voucherService;
    private final VNPayQueryService vnPayQueryService;

    /** Tên miền frontend mặc định, dùng khi không xác định được nơi khách bắt đầu trả tiền. */
    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:5173}")
    private String defaultFrontendUrl;

    /**
     * Các origin frontend được phép nhận redirect sau thanh toán, ngăn cách bởi dấu phẩy.
     * Có allowlist vì origin đến từ phía client: không lọc thì đây là một open redirect.
     */
    @org.springframework.beans.factory.annotation.Value("${app.allowed-frontend-origins:}")
    private String allowedFrontendOrigins;

    /**
     * Tạo URL thanh toán VNPay
     */
    @Transactional
    public PaymentResponse createVNPayPayment(String email, PaymentRequest request, String ipAddress) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        // Kiểm tra booking thuộc user
        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền thanh toán booking này");
        }

        // Kiểm tra trạng thái booking
        if (!"PENDING".equals(booking.getStatus())) {
            throw new BookingException("Booking đã được thanh toán hoặc hủy");
        }

        // Mở cửa sổ thanh toán: từ đây tới paymentExpiresAt, cleanup không được hủy đơn.
        //
        // Cả hai mốc thời gian bên dưới phải sinh ra từ CÙNG một khoảnh khắc: dòng payment
        // lưu theo giờ server, còn vnp_CreateDate gửi sang cổng theo giờ VN. Gọi now() hai
        // lần thì hai giá trị có thể lệch nhau một giây, và lúc rà lại đơn quá hạn ta dựng
        // ra một vnp_TransactionDate mà cổng không nhận ra.
        Instant startedAt = Instant.now();
        LocalDateTime now = LocalDateTime.ofInstant(startedAt, ZoneId.systemDefault());
        LocalDateTime paymentExpiresAt = now.plusMinutes(PAYMENT_WINDOW_MINUTES);
        booking.setPaymentExpiresAt(paymentExpiresAt);
        // Ghi lại nơi khách bấm thanh toán để lát nữa trả họ về đúng tên miền đó
        String returnOrigin = allowedOriginOrNull(request.getReturnOrigin());
        if (returnOrigin != null) {
            booking.setPaymentReturnOrigin(returnOrigin);
        }
        bookingRepository.save(booking);

        // Tạo mã giao dịch nội bộ
        String txnRef = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        // Ghi lại lần mở cổng này TRƯỚC khi khách rời đi.
        //
        // Trước đây dòng payment chỉ ra đời khi CÓ callback. Nghĩa là một giao dịch bị trừ
        // tiền mà cổng không gọi được callback nào về sẽ không để lại dấu vết nào: không có
        // vnp_TxnRef thì không thể hỏi cổng, và khoản tiền mất dấu vĩnh viễn. Đã xảy ra thật
        // với booking 48 (680.000đ).
        //
        // Mỗi lần bấm thanh toán một dòng, không phải mỗi đơn một dòng: một đơn có thể được
        // thử nhiều lần, và lần bị trừ tiền không nhất thiết là lần cuối — cũng chính booking
        // 48, nơi lần thử ĐẦU mới là lần mất tiền.
        Payment attempt = new Payment();
        attempt.setBooking(booking);
        attempt.setPaymentMethod("VNPAY");
        attempt.setPaymentDate(now);
        attempt.setAmount(booking.getTotalPrice());
        attempt.setPaymentStatus(PAYMENT_INITIATED);
        attempt.setTransactionRef(txnRef);
        paymentRepository.save(attempt);

        // Tính tiền (VNPay yêu cầu nhân 100 vì không dùng dấu thập phân)
        long amount = booking.getTotalPrice().multiply(java.math.BigDecimal.valueOf(100)).longValue();

        // Xây dựng VNPay params
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", vnPayConfig.getTmnCode());
        params.put("vnp_Amount", String.valueOf(amount));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", "Thanh_toan_booking_" + booking.getId());
        params.put("vnp_OrderType", "billpayment");
        params.put("vnp_Locale", request.getLanguage() != null ? request.getLanguage() : "vn");
        params.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        String cleanIp = ipAddress;
        if (cleanIp == null || cleanIp.contains(":") || "0:0:0:0:0:0:0:1".equals(cleanIp)) {
            cleanIp = "127.0.0.1";
        }
        params.put("vnp_IpAddr", cleanIp);
        // Giờ gửi cho cổng lấy theo VNPAY_ZONE, độc lập với múi giờ server; còn now/paymentExpiresAt
        // ở trên vẫn theo giờ JVM vì chúng được so với LocalDateTime.now() của BookingCleanupService.
        LocalDateTime gatewayNow = LocalDateTime.ofInstant(startedAt, VNPAY_ZONE);
        params.put("vnp_CreateDate", VNPayUtil.formatDateTime(gatewayNow));
        // Cổng tự đóng phiên đúng lúc đơn hết hạn giữ chỗ, để hai bên không lệch nhau
        params.put("vnp_ExpireDate",
                VNPayUtil.formatDateTime(gatewayNow.plusMinutes(GATEWAY_WINDOW_MINUTES)));

        if (request.getBankCode() != null && !request.getBankCode().isBlank()) {
            params.put("vnp_BankCode", request.getBankCode());
        }

        // Tạo hash
        String hashData = VNPayUtil.buildHashData(params);
        String secureHash = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);

        // Build URL
        String queryString = VNPayUtil.buildQueryString(params);
        String paymentUrl = vnPayConfig.getPayUrl() + "?" + queryString + "&vnp_SecureHash=" + secureHash;

        return new PaymentResponse(paymentUrl, txnRef, "Tạo thanh toán thành công. Chuyển hướng đến VNPay.");
    }

    /**
     * Tên miền frontend để đưa khách quay về sau khi cổng trả kết quả.
     *
     * Ưu tiên origin đã ghi lại lúc mở phiên thanh toán, vì token đăng nhập nằm trong
     * localStorage — vốn tách riêng theo từng origin. Trả khách về một tên miền khác
     * (kể cả một alias cũ của cùng dự án) thì trình duyệt không thấy token nào, khách
     * bị đá về màn hình đăng nhập và mọi lời gọi API sau đó đều hỏng.
     */
    public String resolveReturnFrontendUrl(Map<String, String> params) {
        Long bookingId = parseBookingId(params.get("vnp_OrderInfo"));
        if (bookingId != null) {
            String origin = bookingRepository.findById(bookingId)
                    .map(Booking::getPaymentReturnOrigin)
                    .orElse(null);
            String allowed = allowedOriginOrNull(origin);
            if (allowed != null) {
                return allowed;
            }
            if (origin != null) {
                log.warn("Origin {} của booking {} không nằm trong app.allowed-frontend-origins, "
                        + "dùng app.frontend-url thay thế", origin, bookingId);
            }
        }
        return trimTrailingSlash(defaultFrontendUrl != null ? defaultFrontendUrl : "");
    }

    /**
     * Chuẩn hóa origin do client gửi lên và đối chiếu với allowlist.
     * @return origin dạng scheme://host[:port], hoặc null nếu không hợp lệ / không được phép.
     */
    private String allowedOriginOrNull(String rawOrigin) {
        String origin = normalizeOrigin(rawOrigin);
        return origin != null && allowedOrigins().contains(origin) ? origin : null;
    }

    /** Danh sách allowlist, luôn gồm cả app.frontend-url để cấu hình cũ vẫn chạy như trước. */
    private Set<String> allowedOrigins() {
        Set<String> origins = new HashSet<>();
        String configured = allowedFrontendOrigins != null ? allowedFrontendOrigins : "";
        for (String entry : configured.split(",")) {
            String normalized = normalizeOrigin(entry);
            if (normalized != null) {
                origins.add(normalized);
            }
        }
        String fallback = normalizeOrigin(defaultFrontendUrl);
        if (fallback != null) {
            origins.add(fallback);
        }
        return origins;
    }

    /** Rút gọn một URL bất kỳ về đúng phần origin; null nếu không phải http(s) URL hợp lệ. */
    private String normalizeOrigin(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) return null;
        try {
            java.net.URI uri = java.net.URI.create(rawUrl.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (host == null || !("http".equals(scheme) || "https".equals(scheme))) return null;
            return uri.getPort() > 0
                    ? scheme + "://" + host + ":" + uri.getPort()
                    : scheme + "://" + host;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String trimTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    /**
     * Xử lý callback Return từ VNPay (trình duyệt người dùng quay về).
     */
    @Transactional
    public String handleVNPayReturn(Map<String, String> params) {
        logCallbackReceived("Return", params);
        if (!VNPayUtil.validateHash(params, vnPayConfig.getHashSecret())) {
            logInvalidSignature("Return", params);
            return "INVALID_SIGNATURE";
        }

        Long bookingId = parseBookingId(params.get("vnp_OrderInfo"));
        if (bookingId == null) return "INVALID_ORDER_INFO";

        // Khóa dòng đơn: Return và IPN của cùng một giao dịch thường về gần như cùng lúc,
        // không xếp hàng thì cả hai cùng xác nhận đơn và khách nhận hai mail giống hệt nhau.
        Booking booking = bookingRepository.findByIdForUpdate(bookingId).orElse(null);
        if (booking == null) return "BOOKING_NOT_FOUND";

        return switch (applyPaymentResult(booking, params)) {
            case SUCCESS -> "SUCCESS";
            // Đã xử lý ở lần callback trước (thường là IPN về trước) — kết quả không đổi
            case ALREADY_PROCESSED -> isSuccessResponse(params)
                    ? "SUCCESS" : "FAILED_" + params.get("vnp_ResponseCode");
            case LATE_NEEDS_REFUND -> "LATE_REFUND";
            case FAILED -> "FAILED_" + params.get("vnp_ResponseCode");
            case INVALID_AMOUNT -> "INVALID_AMOUNT";
            case UNVERIFIED -> "UNVERIFIED";
        };
    }

    /**
     * Xử lý IPN từ VNPay (Server-to-Server). Đây mới là nguồn tin cậy về kết quả
     * thanh toán; Return chỉ là điều hướng trình duyệt và có thể không bao giờ tới.
     */
    @Transactional
    public Map<String, String> handleVNPayIPN(Map<String, String> params) {
        try {
            logCallbackReceived("IPN", params);
            if (!VNPayUtil.validateHash(params, vnPayConfig.getHashSecret())) {
                logInvalidSignature("IPN", params);
                return ipnResponse("97", "Invalid Signature");
            }

            Long bookingId = parseBookingId(params.get("vnp_OrderInfo"));
            if (bookingId == null) {
                return ipnResponse("01", "Order not found");
            }

            // Cùng lý do như ở handleVNPayReturn: khóa dòng để hai luồng callback nối đuôi
            // nhau, lượt sau nhìn thấy kết quả đã commit của lượt trước.
            Booking booking = bookingRepository.findByIdForUpdate(bookingId).orElse(null);
            if (booking == null) {
                return ipnResponse("01", "Order not found");
            }

            return switch (applyPaymentResult(booking, params)) {
                case INVALID_AMOUNT -> ipnResponse("04", "Invalid Amount");
                case ALREADY_PROCESSED -> ipnResponse("02", "Order already confirmed");
                // Không báo "00": cổng sẽ gửi lại IPN, và nếu lần truy vấn vừa rồi trượt vì
                // lý do nhất thời thì lần sau còn cơ hội xác nhận đúng. Báo "00" ở đây là
                // đóng sổ vĩnh viễn một giao dịch mà ta chưa kiểm chứng được.
                case UNVERIFIED -> ipnResponse("99", "Transaction not verified at gateway");
                // LATE_NEEDS_REFUND cũng là đã ghi nhận xong, báo "00" để cổng ngừng gọi lại
                default -> ipnResponse("00", "Confirm Success");
            };
        } catch (Exception e) {
            log.error("Lỗi xử lý IPN VNPay: {}", params, e);
            return ipnResponse("99", "Unknown Error");
        }
    }

    /**
     * Áp kết quả cổng trả về lên đơn hàng. Return và IPN dùng chung hàm này nên chỉ có
     * một chỗ duy nhất quyết định trạng thái, hai luồng không thể xử lý lệch nhau.
     */
    private PaymentOutcome applyPaymentResult(Booking booking, Map<String, String> params) {
        if (!isAmountMatching(booking, params)) {
            // In cả hai về cùng đơn vị vnp_Amount (VND x100), nếu không hai số lệch đơn vị
            // sẽ trông như nhau và người đọc log tưởng hệ thống từ chối nhầm.
            log.error("Callback thanh toán cho booking {} khai vnp_Amount={} nhưng đơn trị giá {} "
                            + "(tương đương vnp_Amount={}) — từ chối",
                    booking.getId(), params.get("vnp_Amount"), booking.getTotalPrice(),
                    expectedGatewayAmount(booking));
            return PaymentOutcome.INVALID_AMOUNT;
        }

        String txnRef = params.get("vnp_TxnRef");
        if (txnRef != null
                && paymentRepository.existsByTransactionRefAndPaymentStatusNot(txnRef, PAYMENT_INITIATED)) {
            return PaymentOutcome.ALREADY_PROCESSED;
        }

        if (!isSuccessResponse(params)) {
            savePayment(booking, params, "FAILED");
            if ("PENDING".equals(booking.getStatus())) {
                cancelBookingAndBroadcast(booking);
            }
            return PaymentOutcome.FAILED;
        }

        // Tới đây callback tự khai là đã thu tiền, và chữ ký của nó hợp lệ. Nhưng chữ ký chỉ
        // chứng minh người gửi biết hash-secret — mà hash-secret thì có thể lộ (và ĐÃ từng lộ
        // trong lịch sử Git của repo này). Nên trước khi giao vé hoặc mở yêu cầu hoàn tiền,
        // hỏi thẳng cổng bằng lệnh querydr. Chỉ dừng lại khi cổng PHỦ NHẬN; hỏi không được
        // thì đi tiếp như cũ (xem VNPayQueryService để biết vì sao fail-open).
        if (vnPayQueryService.verifySuccessfulCallback(params, expectedGatewayAmount(booking))
                == VNPayQueryService.Verdict.CONTRADICTED) {
            log.error("Từ chối callback thanh toán cho booking {} (txnRef={}): cổng VNPay không xác nhận "
                    + "giao dịch này", booking.getId(), txnRef);
            return PaymentOutcome.UNVERIFIED;
        }

        if ("PENDING".equals(booking.getStatus())) {
            processSuccessfulPayment(booking, params);
            return PaymentOutcome.SUCCESS;
        }

        if (txnRef == null && !UNFULFILLED_STATUSES.contains(booking.getStatus())) {
            // Vé đã giao mà callback lại không kèm mã giao dịch để đối chiếu: không phân biệt
            // được "cổng báo lại" với "thu tiền lần hai", coi như đã xử lý xong.
            log.warn("Callback thanh toán không có vnp_TxnRef cho booking {} đang ở trạng thái {}",
                    booking.getId(), booking.getStatus());
            return PaymentOutcome.ALREADY_PROCESSED;
        }

        // Tiền đã vào nhưng đơn không còn PENDING (hết hạn giữ chỗ, khách tự hủy,
        // hoặc đã trả tiền bằng một giao dịch khác). Không được im lặng bỏ qua.
        recordLatePaymentForRefund(booking, params);
        return PaymentOutcome.LATE_NEEDS_REFUND;
    }

    /**
     * Ghi nhận khoản tiền thu được ngoài luồng và mở yêu cầu hoàn tiền cho nhà cung cấp
     * xử lý, thay vì để khách mất tiền mà không có vé.
     */
    private void recordLatePaymentForRefund(Booking booking, Map<String, String> params) {
        String previousStatus = booking.getStatus();
        Payment payment = savePayment(booking, params, "SUCCESS_NEEDS_REFUND");

        Refund refund = new Refund();
        refund.setBooking(booking);
        refund.setRefundAmount(payment.getAmount());
        refund.setStatus("PENDING");
        refund.setRequestedAt(LocalDateTime.now());
        refund.setReason("Thanh toán về sau khi đơn đã ở trạng thái " + previousStatus
                + " (mã giao dịch " + params.get("vnp_TxnRef") + "). Cần hoàn tiền cho khách.");
        refundRepository.save(refund);

        log.error("Booking {} nhận thanh toán {} trong khi đang ở trạng thái {} - đã mở yêu cầu hoàn tiền",
                booking.getId(), payment.getAmount(), previousStatus);
    }

    /**
     * Đối chiếu số tiền cổng khai báo với giá trị thật của đơn (VNPay nhân 100).
     *
     * Kiểm tra này trước đây chỉ có ở nhánh IPN, nên nhánh Return — vẫn xác nhận được đơn —
     * chấp nhận mọi số tiền miễn là chữ ký hợp lệ. Ai có hash-secret thì tự ký được một URL
     * Return và mua vé với giá tự đặt. Đặt ở đây để cả hai luồng dùng chung một luật.
     *
     * Thiếu hoặc sai định dạng vnp_Amount cũng coi là không khớp: một callback không nói rõ
     * đã thu bao nhiêu thì không đủ căn cứ để giao vé.
     */
    private boolean isAmountMatching(Booking booking, Map<String, String> params) {
        String amountStr = params.get("vnp_Amount");
        if (amountStr == null || amountStr.isBlank()) {
            return false;
        }
        try {
            long declared = Long.parseLong(amountStr.trim());
            return declared == expectedGatewayAmount(booking);
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * Giá trị đơn hàng quy về đơn vị của {@code vnp_Amount} (VND x100).
     *
     * Phải tính y hệt lúc dựng URL thanh toán (xem createVNPayPayment), kể cả việc
     * longValue() cắt phần thập phân. Lệch công thức là đơn hợp lệ bị từ chối, nên chỉ để
     * đúng một chỗ tính ra con số này.
     */
    private static long expectedGatewayAmount(Booking booking) {
        return booking.getTotalPrice().multiply(BigDecimal.valueOf(100)).longValue();
    }

    private boolean isSuccessResponse(Map<String, String> params) {
        return "00".equals(params.get("vnp_ResponseCode"));
    }

    /**
     * Một dòng cho MỌI callback đi vào, in TRƯỚC cả bước đối chiếu chữ ký.
     *
     * Đường thành công của cả Return lẫn IPN đều đang im lặng, nên một đơn được xác nhận
     * không để lại dấu vết nào về việc nó đã được xác nhận bằng kênh nào. Hệ quả: khi đơn
     * không được xác nhận, log không phân biệt nổi "cổng chưa từng gọi IPN" với "cổng có gọi
     * nhưng ta từ chối" — hai nguyên nhân đòi hai cách sửa hoàn toàn khác nhau.
     *
     * In trước khi kiểm tra chữ ký là cố ý: một callback chữ ký sai vẫn là một callback ĐÃ
     * tới, và chính sự phân biệt đó là toàn bộ giá trị của dòng log này.
     *
     * Callback VNPay không chứa dữ liệu thẻ; bốn trường dưới đây là mã giao dịch, mã kết quả,
     * nội dung đơn và số tiền — đủ để lần dấu, không có gì nhạy cảm.
     */
    private void logCallbackReceived(String channel, Map<String, String> params) {
        log.info("[VNPay {}] Nhận callback: vnp_TxnRef={}, vnp_ResponseCode={}, vnp_OrderInfo={}, vnp_Amount={}",
                channel,
                params.get("vnp_TxnRef"),
                params.get("vnp_ResponseCode"),
                params.get("vnp_OrderInfo"),
                params.get("vnp_Amount"));
    }

    /**
     * Chữ ký sai là lỗi câm nhất của tích hợp cổng: mã 97 trả về không nói được nguyên nhân,
     * mà nguyên nhân thì gần như luôn nằm ở cấu hình chứ không ở thuật toán. Ba thứ dưới đây
     * đủ để phân biệt hầu hết các trường hợp mà KHÔNG in bí mật ra log:
     *
     * - TmnCode nhận được khác TmnCode đang cấu hình -> đang nghe callback của terminal khác,
     *   hoặc biến VNP_TMN_CODE trên môi trường deploy chưa được cập nhật.
     * - TmnCode khớp nhưng chữ ký sai -> hash-secret không phải của terminal đó.
     * - Độ dài secret lệch, hoặc có khoảng trắng thừa ở đầu/cuối -> lỗi lúc dán giá trị vào
     *   biến môi trường (rất hay gặp: dán kèm một dấu xuống dòng). Chỉ in độ dài và cờ
     *   khoảng trắng, không bao giờ in giá trị.
     */
    private void logInvalidSignature(String channel, Map<String, String> params) {
        String secret = vnPayConfig.getHashSecret();
        String configuredTmn = vnPayConfig.getTmnCode();
        String receivedTmn = params.get("vnp_TmnCode");

        log.warn("[VNPay {}] Chữ ký KHÔNG hợp lệ. vnp_TmnCode nhận được={}, đang cấu hình={}, khớp={}. "
                        + "hash-secret: {} ký tự{}. vnp_TxnRef={}, số tham số={}.",
                channel,
                receivedTmn,
                configuredTmn,
                configuredTmn != null && configuredTmn.equals(receivedTmn),
                secret == null ? 0 : secret.length(),
                secret != null && !secret.equals(secret.trim()) ? " (CÓ KHOẢNG TRẮNG THỪA ĐẦU/CUỐI)" : "",
                params.get("vnp_TxnRef"),
                params.size());
        // Tên tham số (KHÔNG kèm giá trị) là thứ thiếu nhất khi truy một lỗi 97: nó cho biết
        // cổng gửi sang đúng bộ trường nào, và một trường lạ/thiếu lộ ra ngay. Callback VNPay
        // không chứa số thẻ hay dữ liệu nhạy cảm, nhưng vẫn chỉ in tên cho chắc.
        log.warn("[VNPay {}] Các tham số nhận được: {}", channel, new TreeSet<>(params.keySet()));
    }

    private Map<String, String> ipnResponse(String code, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("RspCode", code);
        response.put("Message", message);
        return response;
    }

    /**
     * Lưu lịch sử giao dịch. transactionRef là khóa chống xử lý trùng Return/IPN.
     *
     * Lần mở cổng đã ghi sẵn một dòng INITIATED mang chính mã giao dịch này, nên ở đây phải
     * CẬP NHẬT lại nó chứ không chèn dòng mới: chèn thêm thì mỗi giao dịch để lại hai dòng
     * và lịch sử thanh toán đọc thành khách bị thu tiền hai lần.
     */
    private Payment savePayment(Booking booking, Map<String, String> params, String status) {
        String amountStr = params.get("vnp_Amount");
        String txnRef = params.get("vnp_TxnRef");
        Payment payment = txnRef == null
                ? new Payment()
                : paymentRepository.findByTransactionRef(txnRef).orElseGet(Payment::new);
        payment.setBooking(booking);
        payment.setPaymentMethod("VNPAY");
        payment.setPaymentDate(LocalDateTime.now());
        payment.setAmount(amountStr != null
                ? new BigDecimal(amountStr).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : booking.getTotalPrice());
        payment.setPaymentStatus(status);
        payment.setTransactionRef(txnRef);
        paymentRepository.save(payment);
        return payment;
    }

    /**
     * Hỏi cổng xem một đơn sắp bị hủy vì quá hạn có thật sự đã bị trừ tiền hay chưa.
     *
     * Đây là chỗ 680.000đ của booking 48 đã bốc hơi: cleanup hủy đơn PENDING quá hạn mà
     * không hỏi cổng câu nào, nên một khoản đã thu nhưng không có callback về thì vừa không
     * thành vé, vừa không thành yêu cầu hoàn tiền.
     *
     * Nguyên tắc: chỉ trả SAFE_TO_CANCEL khi cổng nói rõ là không có khoản nào. "Không hỏi
     * được" KHÔNG phải là "chưa trả tiền" — nó là HOLD, và bên gọi quyết định chờ tới bao giờ.
     */
    @Transactional
    public SweepResult sweepExpiredBooking(Booking booking) {
        // Tắt kiểm chứng thì mọi thứ chạy y như trước khi có lớp này, không giữ đơn lại.
        if (!vnPayQueryService.isEnabled()) {
            return SweepResult.SAFE_TO_CANCEL;
        }

        List<Payment> attempts = paymentRepository
                .findByBooking_IdAndPaymentStatus(booking.getId(), PAYMENT_INITIATED);
        if (attempts.isEmpty()) {
            // Khách chưa từng bấm sang cổng (hoặc đơn có từ trước bản sửa này) — không có gì để hỏi.
            return SweepResult.SAFE_TO_CANCEL;
        }

        long expectedAmount = expectedGatewayAmount(booking);
        boolean anyUnavailable = false;
        for (Payment attempt : attempts) {
            String transactionDate = attempt.getPaymentDate() == null
                    ? null
                    : VNPayUtil.toGatewayDate(attempt.getPaymentDate());

            switch (vnPayQueryService.verifyTransaction(
                    attempt.getTransactionRef(), transactionDate, expectedAmount)) {
                case CONFIRMED -> {
                    log.error("Đơn {} sắp bị hủy vì quá hạn, nhưng cổng VNPay xác nhận giao dịch {} "
                                    + "ĐÃ THU {} — xác nhận đơn thay vì hủy. Đây là một callback mà cổng "
                                    + "chưa bao giờ gửi tới được.",
                            booking.getId(), attempt.getTransactionRef(), booking.getTotalPrice());
                    processSuccessfulPayment(booking, recoveredParams(attempt, expectedAmount));
                    return SweepResult.RECOVERED;
                }
                case CONTRADICTED -> {
                    // Cổng đã trả lời dứt khoát; đánh dấu để những lượt sau thôi hỏi lại.
                    attempt.setPaymentStatus(PAYMENT_ABANDONED);
                    paymentRepository.save(attempt);
                }
                case UNAVAILABLE -> anyUnavailable = true;
            }
        }
        return anyUnavailable ? SweepResult.HOLD : SweepResult.SAFE_TO_CANCEL;
    }

    /**
     * Bộ tham số tương đương một callback thành công, dựng lại từ điều cổng vừa xác nhận.
     *
     * Không phải dữ liệu bịa: chỉ tới được đây khi querydr đã trả CONFIRMED, mà kết luận đó
     * đòi đúng mã giao dịch này, trạng thái thành công VÀ số tiền khớp với giá trị đơn. Ba
     * trường dưới đây là toàn bộ những gì processSuccessfulPayment thật sự đọc.
     */
    private static Map<String, String> recoveredParams(Payment attempt, long expectedAmount) {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", attempt.getTransactionRef());
        params.put("vnp_Amount", String.valueOf(expectedAmount));
        params.put("vnp_ResponseCode", "00");
        return params;
    }

    private Long parseBookingId(String orderInfo) {
        if (orderInfo == null) return null;
        try {
            String[] parts = orderInfo.split("_");
            return Long.parseLong(parts[parts.length - 1].trim());
        } catch (Exception e) {
            return null;
        }
    }

    private void processSuccessfulPayment(Booking booking, Map<String, String> params) {
        booking.setStatus("CONFIRMED");
        booking.setPaymentExpiresAt(null); // phiên thanh toán đã kết thúc
        bookingRepository.save(booking);

        savePayment(booking, params, "SUCCESS");

        // Tích điểm cho User
        User user = booking.getUser();
        if (user != null) {
            int earnedPoints = booking.getTotalPrice()
                    .divide(BigDecimal.valueOf(10000), 0, RoundingMode.DOWN)
                    .intValue();
            int currentPoints = user.getPoints() == null ? 0 : user.getPoints();
            user.setPoints(currentPoints + earnedPoints);

            String levelName = UserService.getMembershipLevel(user.getPoints());
            if (!"Đồng".equalsIgnoreCase(levelName)) {
                promotionRepository.findByLevelName(levelName)
                        .or(() -> "Kim Cương".equals(levelName) ? promotionRepository.findByLevelName("Kim cương") : Optional.empty())
                        .ifPresent(user::setPromotion);
            }
            userRepository.save(user);
        }

        // Phẳng hóa ngay tại đây, khi transaction còn mở: mail được gửi ở thread khác,
        // sau khi commit, nên lúc đó không đọc được các quan hệ LAZY của booking nữa.
        // BookingConfirmedListener mới là nơi thực sự gọi EmailService.
        // Vé đi tới người liên hệ của đơn, không mặc định là chủ tài khoản: một người có
        // thể đặt hộ cả đoàn và người cầm vé mới là người cần nhận mã check-in.
        eventPublisher.publishEvent(new BookingConfirmedEvent(
                booking.resolveNotificationEmail(),
                BookingConfirmationMail.from(booking)
        ));
    }

    private void cancelBookingAndBroadcast(Booking booking) {
        booking.setStatus("FAILED");
        booking.setPaymentExpiresAt(null);
        bookingRepository.save(booking);

        // Thanh toán thất bại/bị hủy => hoàn lại lượt sử dụng voucher vì chưa thực sự áp dụng thành công
        if (booking.getVoucherCode() != null && !booking.getVoucherCode().isBlank()) {
            voucherService.refundVoucherUsage(booking.getVoucherCode());
        }

        if (booking.getTickets() != null && !booking.getTickets().isEmpty()) {
            Long tripId = booking.getTickets().get(0).getTrip().getId();
            for (Ticket t : booking.getTickets()) {
                if (t.getSeat() != null) {
                    SeatStatusUpdate update = new SeatStatusUpdate(
                        tripId,
                        t.getSeat().getId(),
                        "AVAILABLE",
                        null
                    );
                    messagingTemplate.convertAndSend("/topic/seat-status", update);
                }
            }
        }
    }
}
