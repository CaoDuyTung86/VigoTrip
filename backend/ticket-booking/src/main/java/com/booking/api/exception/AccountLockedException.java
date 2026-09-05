package com.booking.api.exception;

/**
 * Mật khẩu ĐÚNG nhưng tài khoản đã bị quản trị viên khóa.
 *
 * Phải tách khỏi EmailNotVerifiedException, dù cả hai cùng ứng với enabled = false:
 * lỗi "chưa xác thực email" kèm theo một nút cho người dùng tự lấy mã và tự kích hoạt,
 * nên nếu tài khoản bị khóa cũng rơi vào nhánh đó thì người bị khóa tự mở khóa được —
 * vô hiệu hóa luôn chức năng khóa tài khoản của trang quản trị.
 */
public class AccountLockedException extends RuntimeException {
    public AccountLockedException(String message) {
        super(message);
    }
}
