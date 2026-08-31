package com.booking.api.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Khóa lại hai lỗ hổng của rate limiter cho /api/chat:
 * (1) khóa theo X-Forwarded-For do client tự khai → xoay header là bypass;
 * (2) coi mọi request có header Authorization là thành viên → gửi header rác
 *     là nâng hạn mức từ 5 lên 15 request/phút.
 */
class RateLimitingFilterTest {

    private static final int GUEST_LIMIT = 5;
    private static final int USER_LIMIT = 15;

    private RateLimitingFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new RateLimitingFilter();
        chain = mock(FilterChain.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void setTrustedProxyCount(int count) {
        ReflectionTestUtils.setField(filter, "trustedProxyCount", count);
    }

    private MockHttpServletRequest chatRequest(String remoteAddr, String forwardedFor, String authHeader) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/chat");
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        if (authHeader != null) {
            request.addHeader("Authorization", authHeader);
        }
        return request;
    }

    private MockHttpServletRequest callbackRequest(String path, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    /** Trả về status code của request thứ n khi bắn liên tiếp n request giống nhau. */
    private int statusAfter(int attempts, java.util.function.Supplier<MockHttpServletRequest> requestSupplier)
            throws Exception {
        MockHttpServletResponse response = null;
        for (int i = 0; i < attempts; i++) {
            response = new MockHttpServletResponse();
            filter.doFilter(requestSupplier.get(), response, chain);
        }
        return response.getStatus();
    }

    @Test
    @DisplayName("trusted-proxy-count=0: xoay vòng X-Forwarded-For KHÔNG né được rate limit")
    void spoofedForwardedForDoesNotBypassLimit() throws Exception {
        setTrustedProxyCount(0);

        // Cùng một máy thật (remoteAddr), nhưng mỗi lần khai một XFF khác nhau.
        java.util.concurrent.atomic.AtomicInteger n = new java.util.concurrent.atomic.AtomicInteger();
        int status = statusAfter(GUEST_LIMIT + 1,
                () -> chatRequest("203.0.113.9", "10.0.0." + n.incrementAndGet(), null));

        assertThat(status)
                .as("request vượt hạn mức phải bị chặn dù XFF đổi liên tục")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("trusted-proxy-count=1: lấy IP do proxy ghi, bỏ qua phần client tự khai")
    void takesIpWrittenByTrustedProxy() throws Exception {
        setTrustedProxyCount(1);

        // Attacker khai "1.1.1.1"; proxy nối thêm IP thật "198.51.100.7" vào cuối.
        // Ta phải khóa theo 198.51.100.7 chứ không phải 1.1.1.1.
        java.util.concurrent.atomic.AtomicInteger n = new java.util.concurrent.atomic.AtomicInteger();
        int status = statusAfter(GUEST_LIMIT + 1,
                () -> chatRequest("10.0.0.1", "1.1.1." + n.incrementAndGet() + ", 198.51.100.7", null));

        assertThat(status)
                .as("phần XFF do client bịa không được tách thành các bucket khác nhau")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("Header Authorization rác KHÔNG nâng hạn mức khách lên mức thành viên")
    void garbageAuthorizationHeaderStaysOnGuestLimit() throws Exception {
        setTrustedProxyCount(0);
        // Không set SecurityContext => vẫn là khách, dù có header Authorization.
        int status = statusAfter(GUEST_LIMIT + 1,
                () -> chatRequest("203.0.113.20", null, "Bearer not-a-real-token"));

        assertThat(status)
                .as("chỉ SecurityContext mới quyết định là thành viên, không phải sự tồn tại của header")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("Thành viên đã xác thực được hưởng hạn mức cao hơn và khóa theo danh tính")
    void authenticatedUserGetsHigherLimit() throws Exception {
        setTrustedProxyCount(0);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("user@example.com", null, List.of()));

        // Vượt hạn mức khách nhưng chưa chạm hạn mức thành viên → vẫn phải đi tiếp.
        int status = statusAfter(GUEST_LIMIT + 1, () -> chatRequest("203.0.113.30", null, "Bearer valid"));
        assertThat(status).isEqualTo(200);

        // Bắn tiếp cho tới khi vượt hạn mức thành viên.
        int overLimit = statusAfter(USER_LIMIT, () -> chatRequest("203.0.113.30", null, "Bearer valid"));
        assertThat(overLimit).isEqualTo(429);
    }

    @Test
    @DisplayName("Callback Return của VNPay bị chặn sau 20 lượt/phút từ cùng một IP")
    void vnPayReturnIsRateLimited() throws Exception {
        setTrustedProxyCount(0);

        // 20 lượt đầu vẫn đi tiếp: một lần trả tiền chỉ sinh đúng một lượt Return, số này
        // đã tính dư cho việc khách bấm F5 hoặc mở lại tab.
        assertThat(statusAfter(20, () -> callbackRequest("/api/payment/vnpay-return", "203.0.113.50")))
                .isEqualTo(200);
        assertThat(statusAfter(1, () -> callbackRequest("/api/payment/vnpay-return", "203.0.113.50")))
                .as("endpoint public, mỗi lượt tốn một HMAC + vài truy vấn DB nên phải có trần")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("Trần của IPN cao hơn hẳn Return vì mọi giao dịch dùng chung IP của cổng")
    void vnPayIpnHasHigherCeilingThanReturn() throws Exception {
        setTrustedProxyCount(0);

        // Ở mức làm nghẹt Return (21 lượt), IPN vẫn phải thông: chặn nhầm một IPN thật là
        // khách đã bị trừ tiền mà đơn không bao giờ được xác nhận.
        assertThat(statusAfter(21, () -> callbackRequest("/api/payment/vnpay-ipn", "203.0.113.60")))
                .isEqualTo(200);

        assertThat(statusAfter(100, () -> callbackRequest("/api/payment/vnpay-ipn", "203.0.113.60")))
                .as("vẫn phải có trần để một flood không rút cạn connection pool")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("Hai IP khác nhau có bộ đếm callback riêng")
    void callbackLimitIsPerIp() throws Exception {
        setTrustedProxyCount(0);

        assertThat(statusAfter(21, () -> callbackRequest("/api/payment/vnpay-return", "203.0.113.70")))
                .isEqualTo(429);
        assertThat(statusAfter(1, () -> callbackRequest("/api/payment/vnpay-return", "203.0.113.71")))
                .as("IP khác không được thừa hưởng bộ đếm của IP đã vượt trần")
                .isEqualTo(200);
    }

    @Test
    @DisplayName("/api/chat/status không bị rate limit (frontend poll 45 giây/lần)")
    void statusEndpointIsNotRateLimited() throws Exception {
        setTrustedProxyCount(0);
        MockHttpServletResponse response = null;
        for (int i = 0; i < 50; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/chat/status");
            request.setRemoteAddr("203.0.113.40");
            response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
        }
        assertThat(response.getStatus()).isEqualTo(200);
    }
}
