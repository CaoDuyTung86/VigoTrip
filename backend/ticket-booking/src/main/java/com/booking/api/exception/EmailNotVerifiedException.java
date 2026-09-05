package com.booking.api.exception;

/**
 * Mật khẩu ĐÚNG nhưng tài khoản chưa kích hoạt email.
 *
 * Tách riêng khỏi BadCredentialsException để frontend mở được màn nhập mã xác thực:
 * trước đây cả hai đều rơi vào handleBadCredentials và bị ghi đè thành
 * "Email hoặc mật khẩu không đúng", nên người đăng ký dở dang không còn đường quay lại.
 *
 * Chỉ được ném SAU khi đã so khớp mật khẩu — ném trước là biến /login thành công cụ
 * dò xem email nào đã đăng ký trên hệ thống.
 */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
