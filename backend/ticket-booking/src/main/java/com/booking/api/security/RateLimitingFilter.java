package com.booking.api.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Filter Rate Limiting bảo vệ backend khỏi Brute-Force & Spam API.
 * Sử dụng Caffeine Cache (Sliding Window 1 phút).
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
    private static final int BOOKING_LIMIT_PER_MIN = 10;

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
        } else if (path.startsWith("/api/chat")) {
            if (isRateLimited(clientIp + ":chat", requestCounts, CHAT_LIMIT_PER_MIN)) {
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

    private boolean isRateLimited(String key, Cache<String, AtomicInteger> cache, int maxLimit) {
        AtomicInteger count = cache.get(key, k -> new AtomicInteger(0));
        if (count.incrementAndGet() > maxLimit) {
            log.warn("[RateLimit] IP/Key {} vượt quá giới hạn {} reqs/chu kỳ", key, maxLimit);
            return true;
        }
        return false;
    }

    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            return xfHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String json = String.format(
                "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"%s\",\"timestamp\":\"%s\"}",
                message, java.time.LocalDateTime.now()
        );
        response.getWriter().write(json);
    }
}
