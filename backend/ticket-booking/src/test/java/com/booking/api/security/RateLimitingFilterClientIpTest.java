package com.booking.api.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cách chọn IP từ X-Forwarded-For quyết định rate limit khoá theo ai. Chọn sai một bậc
 * là client tự chỉ định khoá của chính mình, và toàn bộ rate limit thành trang trí.
 */
class RateLimitingFilterClientIpTest {

    private static final String ATTACKER = "203.0.113.9";   // IP thật của socket
    private static final String CLIENT = "198.51.100.7";    // IP thật của người dùng
    private static final String FORGED = "1.2.3.4";         // IP client tự bịa trong XFF

    private String resolve(int trustedProxyCount, String xff) {
        RateLimitingFilter filter = new RateLimitingFilter();
        ReflectionTestUtils.setField(filter, "trustedProxyCount", trustedProxyCount);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ATTACKER);
        if (xff != null) {
            request.addHeader("X-Forwarded-For", xff);
        }
        return ReflectionTestUtils.invokeMethod(filter, "getClientIP", request);
    }

    @Test
    @DisplayName("count=0: bỏ qua XFF hoàn toàn, luôn dùng địa chỉ socket")
    void ignoresHeaderWhenNoProxyTrusted() {
        assertThat(resolve(0, FORGED)).isEqualTo(ATTACKER);
    }

    @Test
    @DisplayName("count=1, một hop: lấy đúng IP người dùng")
    void singleProxyHappyPath() {
        assertThat(resolve(1, CLIENT)).isEqualTo(CLIENT);
    }

    @Test
    @DisplayName("count=1: mục client tự bịa nằm bên trái bị bỏ qua, lấy mục phải nhất")
    void singleProxyIgnoresForgedLeftEntry() {
        assertThat(resolve(1, FORGED + ", " + CLIENT)).isEqualTo(CLIENT);
    }

    @Test
    @DisplayName("count=2, hai hop: lấy đúng IP người dùng")
    void twoProxyHappyPath() {
        assertThat(resolve(2, CLIENT + ", 10.0.0.1")).isEqualTo(CLIENT);
    }

    @Test
    @DisplayName("Chuỗi ngắn hơn cấu hình thì quay về socket, KHÔNG rơi về mục trái nhất")
    void failsClosedWhenChainShorterThanConfigured() {
        // Bản cũ dùng max(0, size - count) nên trả về FORGED — client tự chọn khoá.
        assertThat(resolve(3, FORGED + ", 10.0.0.1")).isEqualTo(ATTACKER);
        assertThat(resolve(2, FORGED)).isEqualTo(ATTACKER);
    }

    @Test
    @DisplayName("Mục không phải địa chỉ IP bị loại, tránh bơm khoá rác vào cache")
    void rejectsNonIpEntries() {
        assertThat(resolve(1, "khong-phai-ip")).isEqualTo(ATTACKER);
        assertThat(resolve(1, "999.999.999.999")).isEqualTo(ATTACKER);
        assertThat(resolve(1, "'; DROP TABLE users; --")).isEqualTo(ATTACKER);
    }

    @Test
    @DisplayName("Chấp nhận IPv6")
    void acceptsIpv6() {
        assertThat(resolve(1, "2001:db8::1")).isEqualTo("2001:db8::1");
    }

    @Test
    @DisplayName("Header rỗng hoặc toàn dấu phẩy thì quay về socket")
    void handlesEmptyHeader() {
        assertThat(resolve(1, null)).isEqualTo(ATTACKER);
        assertThat(resolve(1, "   ")).isEqualTo(ATTACKER);
        assertThat(resolve(1, " , , ")).isEqualTo(ATTACKER);
    }
}
