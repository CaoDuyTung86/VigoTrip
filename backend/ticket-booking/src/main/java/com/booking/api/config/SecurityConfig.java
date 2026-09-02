package com.booking.api.config;

import com.booking.api.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

import com.booking.api.security.RateLimitingFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final UserDetailsService userDetailsService;
    private final AuthenticationEntryPoint restAuthenticationEntryPoint;
    private final AccessDeniedHandler restAccessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/api/chat/**", "/api/voucher/**", "/ws/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        // Ảnh QR nhúng trong mail: client mail không gửi kèm JWT được.
                        .requestMatchers(HttpMethod.GET, "/api/public/qr/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/trips/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/additional-services/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews/trip/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/payment/vnpay-return", "/api/payment/vnpay-ipn").permitAll()
                        // Trang /admin/reviews cho cả provider lẫn admin vào, nên quyền ở đây
                        // phải khớp. Trước đây chỉ có ROLE_PROVIDER: admin đăng nhập là nhận 403
                        // và màn hình chỉ hiện "không tải được đánh giá", không nói vì sao.
                        // Liệt kê cả biến thể không tiền tố vì authority lấy nguyên văn từ
                        // cột role trong DB (xem CustomUserDetailsService), giống các dòng dưới.
                        .requestMatchers("/api/reviews/all").hasAnyAuthority("ROLE_PROVIDER", "PROVIDER", "ROLE_ADMIN", "ADMIN")
                        .requestMatchers("/api/refunds/all").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/refunds/*/approve").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/refunds/*/reject").hasAuthority("ROLE_ADMIN")
                        .requestMatchers("/api/admin/revenue").hasAnyAuthority("ROLE_PROVIDER", "PROVIDER", "ROLE_ADMIN", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/admin/vouchers/active").hasAnyAuthority("ROLE_PROVIDER", "PROVIDER", "ROLE_ADMIN", "ADMIN")
                        // Cả admin lẫn đối tác đều vào được /api/analytics; phạm vi dữ liệu ai
                        // được xem do AnalyticsController quyết định (scope=SYSTEM chỉ dành cho
                        // admin, scope=PROVIDER thu hẹp về đúng thương hiệu tài khoản đó sở hữu).
                        // Đặt luật ở đó thay vì ở đây vì nó phụ thuộc tham số, không phụ thuộc URL.
                        .requestMatchers("/api/analytics/**").hasAnyAuthority("ROLE_PROVIDER", "PROVIDER", "ROLE_ADMIN", "ADMIN")
                        .requestMatchers("/api/admin/**").hasAnyAuthority("ROLE_ADMIN", "ADMIN")
                        .anyRequest().authenticated())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 401 khi chưa/hết xác thực, 403 khi thiếu quyền — xem RestAuthenticationHandlers
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthenticationEntryPoint)
                        .accessDeniedHandler(restAccessDeniedHandler))
                .authenticationProvider(authenticationProvider())
                // Thứ tự quan trọng: JWT chạy TRƯỚC để SecurityContext đã có danh tính,
                // nhờ đó RateLimitingFilter phân biệt được khách với thành viên bằng
                // context thật thay vì bằng sự tồn tại của header Authorization.
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitingFilter, JwtAuthFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList(
                "http://localhost:*",
                "https://*.ngrok-free.dev",
                "https://*.ngrok.io",
                "https://*.duckdns.org",
                "https://*.vercel.app",
                "https://*.onrender.com"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
