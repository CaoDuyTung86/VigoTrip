package com.booking.api.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Admin khóa một tài khoản thì quyền phải mất NGAY.
 *
 * JwtService.isTokenValid chỉ so khớp email trong token với UserDetails và kiểm tra hạn,
 * nên nếu bộ lọc không tự hỏi thêm isEnabled() thì người bị khóa vẫn gọi API bình thường
 * cho tới khi token hết hạn (jwt.expiration, khi đó là 24 giờ). Đăng nhập mới bị chặn, còn
 * token đang cầm thì không, và đó đúng là kiểu lỗ hổng không ai nhìn thấy từ giao diện.
 *
 * Hạn access token nay là 15 phút nên cửa sổ đã hẹp đi nhiều, nhưng bài kiểm tra này vẫn
 * giữ nguyên giá trị: nó bảo đảm cửa sổ bằng 0 chứ không phải "chỉ 15 phút".
 */
class JwtAuthFilterTest {

    private static final String EMAIL = "khach@example.com";
    private static final String TOKEN = "jwt-hop-le";

    private JwtService jwtService;
    private UserDetailsService userDetailsService;
    private JwtAuthFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        userDetailsService = mock(UserDetailsService.class);
        filter = new JwtAuthFilter(jwtService, userDetailsService);

        request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + TOKEN);
        response = new MockHttpServletResponse();
        chain = mock(FilterChain.class);

        when(jwtService.extractUsername(TOKEN)).thenReturn(EMAIL);
        when(jwtService.isTokenValid(anyString(), any())).thenReturn(true);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserDetails account(boolean enabled) {
        return new User(EMAIL, "mat-khau-da-ma-hoa", enabled, true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    @DisplayName("Tài khoản bình thường: token hợp lệ thì được xác thực")
    void enabledAccountIsAuthenticated() throws Exception {
        when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(account(true));

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Tài khoản bị khóa: token cũ hết tác dụng ngay, không chờ hết hạn")
    void disabledAccountIsRejectedEvenWithValidToken() throws Exception {
        when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(account(false));

        filter.doFilter(request, response, chain);

        // Không có Authentication nào được đặt vào context, nên mọi endpoint cần đăng nhập
        // sẽ trả 401/403 dù token vẫn còn hạn.
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
