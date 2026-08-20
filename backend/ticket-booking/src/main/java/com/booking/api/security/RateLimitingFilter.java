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
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

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
    private static final int BOOKING_LIMIT_PER_MIN = 10;

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
        } else if (path.startsWith("/api/chat") && !path.equals("/api/chat/status")) {
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
     * Lấy IP client thật. X-Forwarded-For được proxy NỐI THÊM vào, nên các mục bên phải
     * đáng tin hơn bên trái — mục đầu tiên chính là giá trị client tự khai, bịa được.
     * Ta lùi từ phải sang trái đúng bằng số proxy tin cậy để lấy địa chỉ mà proxy ngoài
     * cùng thực sự nhìn thấy.
     */
    private String getClientIP(HttpServletRequest request) {
        if (trustedProxyCount <= 0) {
            return request.getRemoteAddr();
        }
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isBlank()) {
            return request.getRemoteAddr();
        }
        String[] parts = xfHeader.split(",");
        int index = Math.max(0, parts.length - trustedProxyCount);
        String candidate = parts[index].trim();
        return candidate.isEmpty() ? request.getRemoteAddr() : candidate;
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
