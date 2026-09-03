package com.booking.api.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Filter Rate Limiting bảo vệ backend khỏi Brute-Force & Spam API.
 * Sử dụng Caffeine Cache (Sliding Window 1 phút).
 *
 * LƯU Ý THỨ TỰ FILTER: filter này phải chạy SAU JwtAuthFilter (xem SecurityConfig),
 * vì nó phân biệt khách/thành viên bằng SecurityContext chứ không bằng sự tồn tại
 * của header Authorization — trước đây chỉ cần gửi một header Authorization rác là
 * nâng được hạn mức chat từ 5 lên 15 request/phút.
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    // Cache đếm số request theo IP + Path, hết hạn sau 1 phút
    private final Cache<String, AtomicInteger> requestCounts = Caffeine.newBuilder()
            .expireAfterWrite(1, TimeUnit.MINUTES)
            .maximumSize(10000)
            .build();

    // Cache riêng cho forgot-password (hết hạn sau 15 phút)
    private final Cache<String, AtomicInteger> forgotPasswordCounts = Caffeine.newBuilder()
            .expireAfterWrite(15, TimeUnit.MINUTES)
            .maximumSize(5000)
            .build();

    private static final int LOGIN_LIMIT_PER_MIN = 10;
    private static final int REGISTER_LIMIT_PER_MIN = 5;
    private static final int FORGOT_PW_LIMIT_PER_15MIN = 3;
    private static final int CHAT_LIMIT_PER_MIN = 15;
    private static final int GUEST_CHAT_LIMIT_PER_MIN = 5;
    /** Đánh giá 👍/👎 rất rẻ, nhưng vẫn cần trần để không ai bơm rác vào bảng thống kê. */
    private static final int FEEDBACK_LIMIT_PER_MIN = 30;
    private static final int BOOKING_LIMIT_PER_MIN = 10;

    /**
     * Hai endpoint callback của VNPay là public (SecurityConfig permitAll) và mỗi lần gọi
     * đều tốn một HMAC-SHA512 cộng vài lượt truy vấn DB. Không chặn thì bất kỳ ai cũng bơm
     * được request vào đó cho tới khi cạn connection pool — trên Render free tier chỉ cần
     * một script là đủ.
     *
     * Hạn mức lệch nhau vì hai đường đi khác nhau hoàn toàn:
     *
     * Return là trình duyệt của KHÁCH quay về, mỗi IP là một người. Một lần trả tiền chỉ
     * sinh đúng một lượt; 20 là đã tính dư cho việc bấm F5 và mở lại tab.
     *
     * IPN là server VNPay gọi sang, nên MỌI giao dịch của hệ thống dồn vào cùng một dải IP
     * của cổng. Khoá theo IP ở đây gom chung tất cả khách vào một bucket, vì vậy trần phải
     * đặt cao hơn hẳn lưu lượng thật: chặn nhầm một IPN thật nghĩa là khách đã bị trừ tiền
     * mà đơn không bao giờ được xác nhận — hỏng nặng hơn nhiều so với việc chịu thêm vài
     * chục request rác. 120/phút vẫn chặn được flood mà còn cách rất xa lưu lượng thật của
     * đồ án (cổng cũng chỉ retry IPN vài lần cho mỗi giao dịch).
     */
    private static final int VNPAY_RETURN_LIMIT_PER_MIN = 20;
    private static final int VNPAY_IPN_LIMIT_PER_MIN = 120;

    /** Một octet IPv4 hợp lệ: 0-255, không cho phép số 0 đứng đầu kiểu "010". */
    private static final String OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
    /** Dotted-quad. */
    private static final Pattern IPV4 = Pattern.compile(OCTET + "\\." + OCTET + "\\." + OCTET + "\\." + OCTET);
    /** IPv6 (kể cả dạng rút gọn "::" và hậu tố vùng "%eth0") — chỉ kiểm bộ ký tự và dấu ':'. */
    private static final Pattern IPV6_CHARS = Pattern.compile("[0-9A-Fa-f:]*:[0-9A-Fa-f:.]*(%[0-9A-Za-z]+)?");

    /**
     * Số proxy tin cậy đứng giữa client và ứng dụng; mỗi proxy nối thêm một mục vào
     * X-Forwarded-For. Chỉ (count) mục cuối cùng của XFF là do hạ tầng của ta ghi ra;
     * mọi mục nằm trước đó đều có thể do client tự bịa.
     *
     * 0 = không có proxy, dùng thẳng remoteAddr (mặc định — an toàn cho dev local và
     *     cho mọi cấu hình chưa xác minh).
     * 1 = client -> Render.
     * 2 = client -> Vercel rewrite -> Render.
     *
     * Đặt THẤP hơn thực tế chỉ khiến nhiều client dùng chung một hạn mức (phiền nhưng
     * an toàn); đặt CAO hơn thực tế sẽ mở lại đường spoofing.
     */
    @Value("${app.trusted-proxy-count:0}")
    private int trustedProxyCount;

    @PostConstruct
    void logProxyConfig() {
        if (trustedProxyCount <= 0) {
            log.info("[RateLimit] app.trusted-proxy-count=0 — khóa theo remoteAddr, bỏ qua X-Forwarded-For. "
                    + "Nếu chạy sau Vercel/Render hãy đặt APP_TRUSTED_PROXY_COUNT đúng số hop.");
        } else {
            log.info("[RateLimit] Tin cậy {} proxy cuối cùng trong X-Forwarded-For.", trustedProxyCount);
        }
        if (trustedProxyCount >= 2) {
            log.warn("[RateLimit] trusted-proxy-count={} chỉ đúng nếu backend KHÔNG thể gọi trực tiếp. "
                    + "Render nối thêm vào X-Forwarded-For, nên một request gọi thẳng vào *.onrender.com "
                    + "kèm một mục XFF tự bịa sẽ giả mạo được IP và né rate limit. "
                    + "Chặn truy cập thẳng, hoặc làm số hop đồng nhất rồi hạ về 1.", trustedProxyCount);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        // Chỉ kiểm tra các request ghi hoặc sensitive endpoints
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIP(request);

        if (path.startsWith("/api/auth/login")) {
            if (isRateLimited(clientIp + ":login", requestCounts, LOGIN_LIMIT_PER_MIN)) {
                sendRateLimitResponse(response, "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 phút.");
                return;
            }
        } else if (path.startsWith("/api/auth/register")) {
            if (isRateLimited(clientIp + ":register", requestCounts, REGISTER_LIMIT_PER_MIN)) {
                sendRateLimitResponse(response, "Yêu cầu đăng ký quá dồn dập. Vui lòng thử lại sau 1 phút.");
                return;
            }
        } else if (path.startsWith("/api/auth/forgot-password")) {
            if (isRateLimited(clientIp + ":forgot_pw", forgotPasswordCounts, FORGOT_PW_LIMIT_PER_15MIN)) {
                sendRateLimitResponse(response, "Bạn đã yêu cầu gửi OTP quá 3 lần. Vui lòng đợi 15 phút.");
                return;
            }
        } else if (path.startsWith("/api/auth/resend-verification")) {
            // Mỗi lần gọi là một email thật gửi đi, mà Brevo free chỉ 300 mail/ngày —
            // không chặn thì một script đủ đốt sạch quota của cả hệ thống.
            if (isRateLimited(clientIp + ":resend_verify", forgotPasswordCounts, FORGOT_PW_LIMIT_PER_15MIN)) {
                sendRateLimitResponse(response, "Bạn đã yêu cầu gửi lại mã quá 3 lần. Vui lòng đợi 15 phút.");
                return;
            }
        } else if (path.startsWith("/api/chat/feedback")) {
            // Không gọi model nên không tính vào hạn mức LLM, nhưng vẫn phải có trần riêng:
            // endpoint này permitAll và ghi DB, để trống là mời người ta bơm rác vào bảng
            // thống kê chất lượng.
            if (isRateLimited(clientIp + ":chat_feedback", requestCounts, FEEDBACK_LIMIT_PER_MIN)) {
                sendRateLimitResponse(response, "Bạn gửi đánh giá quá nhanh. Vui lòng đợi 1 phút.");
                return;
            }
        } else if (path.startsWith("/api/chat/ops")) {
            // Bảng điều khiển quản trị, chỉ đọc và đã có phân quyền — không dính gì tới
            // hạn mức gọi model.
            filterChain.doFilter(request, response);
            return;
        } else if (path.startsWith("/api/chat")
                && !path.equals("/api/chat/status")
                && !path.equals("/api/chat/history")) {
            // Hạn mức này tồn tại để chặn chi phí gọi LLM, nên chỉ áp cho đường thực sự
            // gọi model. /chat/status và /chat/history chỉ đọc hoặc xóa dữ liệu có sẵn:
            // tính chúng vào đây thì khách vãng lai đóng mở widget vài lần là hết lượt hỏi.
            //
            // Thành viên đã đăng nhập khóa theo danh tính: không bị ảnh hưởng khi dùng
            // chung IP với người khác, và cũng không nhân được hạn mức bằng cách đổi IP.
            String authenticatedUser = getAuthenticatedUsername();
            boolean isGuest = authenticatedUser == null;
            String chatKey = isGuest ? clientIp + ":chat" : "user:" + authenticatedUser + ":chat";
            int limit = isGuest ? GUEST_CHAT_LIMIT_PER_MIN : CHAT_LIMIT_PER_MIN;
            if (isRateLimited(chatKey, requestCounts, limit)) {
                sendRateLimitResponse(response, "Bạn đang hỏi AI quá nhanh. Vui lòng đợi 1 phút để tiếp tục.");
                return;
            }
        } else if (path.startsWith("/api/bookings") && "POST".equalsIgnoreCase(method)) {
            if (isRateLimited(clientIp + ":booking_create", requestCounts, BOOKING_LIMIT_PER_MIN)) {
                sendRateLimitResponse(response, "Thao tác đặt vé quá nhanh. Vui lòng thử lại sau 1 phút.");
                return;
            }
        } else if (path.startsWith("/api/payment/vnpay-return")) {
            if (isRateLimited(clientIp + ":vnpay_return", requestCounts, VNPAY_RETURN_LIMIT_PER_MIN)) {
                sendRateLimitResponse(response, "Quá nhiều lượt quay về từ cổng thanh toán. Vui lòng thử lại sau 1 phút.");
                return;
            }
        } else if (path.startsWith("/api/payment/vnpay-ipn")) {
            if (isRateLimited(clientIp + ":vnpay_ipn", requestCounts, VNPAY_IPN_LIMIT_PER_MIN)) {
                // Log ở mức error vì nếu đây là IP thật của cổng thì ta vừa chặn một thông
                // báo thanh toán thật — phải nhìn thấy ngay để nâng trần, đừng để lẫn vào
                // đống warn của rate limit thông thường.
                log.error("[RateLimit] Đã chặn IPN VNPay từ {} (trần {}/phút). Nếu đây là IP của cổng, "
                        + "giao dịch có thể đã bị trừ tiền mà đơn chưa được xác nhận.",
                        clientIp, VNPAY_IPN_LIMIT_PER_MIN);
                sendRateLimitResponse(response, "Too many IPN requests.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /** Email của người dùng đã xác thực, hoặc null nếu là khách vãng lai. */
    private String getAuthenticatedUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return auth.getName();
    }

    private boolean isRateLimited(String key, Cache<String, AtomicInteger> cache, int maxLimit) {
        AtomicInteger count = cache.get(key, k -> new AtomicInteger(0));
        if (count.incrementAndGet() > maxLimit) {
            log.warn("[RateLimit] IP/Key {} vượt quá giới hạn {} reqs/chu kỳ", key, maxLimit);
            return true;
        }
        return false;
    }

    /**
     * Lấy IP client thật từ X-Forwarded-For.
     *
     * XFF được proxy NỐI THÊM vào, nên các mục bên phải đáng tin hơn bên trái: mục đầu
     * tiên chính là giá trị client tự khai và bịa được. Ta lùi từ phải sang trái đúng
     * bằng số proxy tin cậy để lấy địa chỉ mà proxy ngoài cùng thực sự nhìn thấy.
     *
     * GIỚI HẠN CẦN BIẾT khi đặt trusted-proxy-count >= 2: Render NỐI THÊM vào XFF chứ
     * không ghi đè, và backend vẫn mở trực tiếp ở *.onrender.com (WebSocket đi thẳng,
     * VNP_RETURN_URL trỏ thẳng). Nên một request gọi THẲNG vào Render kèm sẵn một mục
     * XFF tự bịa sẽ tạo ra chuỗi dài đúng bằng chuỗi của request đi qua Vercel — hai
     * trường hợp không phân biệt được, và mục lấy ra là mục do client bịa.
     *
     * Không có cách sửa nào thuần trong hàm này: muốn đóng hẳn thì phải làm cho số hop
     * đồng nhất (chặn truy cập thẳng, hoặc bỏ rewrite /api của Vercel để mọi thứ đi 1
     * hop rồi đặt count=1). Ở đây ta làm được hai việc: hỏng thì hỏng về phía an toàn,
     * và cảnh báo rõ lúc khởi động thay vì im lặng.
     */
    private String getClientIP(HttpServletRequest request) {
        if (trustedProxyCount <= 0) {
            return request.getRemoteAddr();
        }
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isBlank()) {
            return request.getRemoteAddr();
        }

        List<String> hops = Arrays.stream(xfHeader.split(","))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .toList();

        // Chuỗi NGẮN hơn cấu hình = request không đi qua đủ số proxy đã khai báo, tức là
        // hạ tầng khác với giả định. Bản cũ dùng max(0, ...) nên rơi về mục trái nhất —
        // đúng cái mục client toàn quyền bịa. Quay về remoteAddr là lựa chọn an toàn:
        // cùng lắm thì gộp nhóm rộng hơn, chứ không trao chìa khoá cho client.
        if (hops.size() < trustedProxyCount) {
            return request.getRemoteAddr();
        }

        String candidate = hops.get(hops.size() - trustedProxyCount);

        // Chuỗi bất kỳ đều thành khoá cache. Không lọc thì client tự bơm hàng nghìn khoá
        // rác, đẩy Caffeine (maximumSize 10000) vào cảnh trục xuất liên tục và cuốn theo
        // cả bộ đếm của người dùng thật — rate limit tự vô hiệu hoá.
        return isValidIpLiteral(candidate) ? candidate : request.getRemoteAddr();
    }

    /**
     * Chỉ nhận dạng địa chỉ IP dạng literal. Cố tình KHÔNG dùng InetAddress.getByName:
     * với chuỗi không phải IP nó sẽ đi tra DNS, biến mỗi request rác thành một lượt
     * truy vấn mạng ngay trong filter.
     */
    private static boolean isValidIpLiteral(String value) {
        if (value.isEmpty() || value.length() > 45) {
            return false;
        }
        return IPV4.matcher(value).matches() || IPV6_CHARS.matcher(value).matches();
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", "60");
        String json = String.format(
                "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"%s\",\"timestamp\":\"%s\"}",
                message, java.time.LocalDateTime.now()
        );
        response.getWriter().write(json);
    }
}
