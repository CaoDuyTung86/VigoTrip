package com.booking.api.security;

import com.booking.api.dto.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Tách bạch 401 và 403 cho API stateless.
 *
 * Mặc định Spring Security (không formLogin/httpBasic) trả 403 cho CẢ HAI tình huống:
 *   - chưa đăng nhập / JWT hỏng, hết hạn  → đáng lẽ phải là 401
 *   - đã đăng nhập nhưng sai quyền        → đúng là 403
 *
 * Frontend không phân biệt được nên đã đăng xuất người dùng kèm thông báo
 * "tài khoản bị khóa" ngay cả khi họ chỉ vô tình gọi một endpoint dành cho admin.
 * Sau thay đổi này: 401 = phiên thật sự không còn hiệu lực (được phép đăng xuất),
 * 403 = thiếu quyền (giữ nguyên phiên đăng nhập).
 */
@Configuration
public class RestAuthenticationHandlers {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules();

    private static void write(HttpServletResponse response, HttpStatus status, String error, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        MAPPER.writeValue(
                response.getOutputStream(),
                new ErrorResponse(status.value(), error, message, LocalDateTime.now()));
    }

    @Bean
    public AuthenticationEntryPoint restAuthenticationEntryPoint() {
        return (HttpServletRequest request, HttpServletResponse response, org.springframework.security.core.AuthenticationException ex)
                -> write(response, HttpStatus.UNAUTHORIZED, "Unauthorized",
                        "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
    }

    @Bean
    public AccessDeniedHandler restAccessDeniedHandler() {
        return (HttpServletRequest request, HttpServletResponse response, org.springframework.security.access.AccessDeniedException ex)
                -> write(response, HttpStatus.FORBIDDEN, "Forbidden",
                        "Tài khoản của bạn không có quyền thực hiện thao tác này.");
    }
}
