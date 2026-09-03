package com.booking.api.security;

import java.security.Principal;

/**
 * Danh tính của một phiên STOMP, do máy chủ suy ra ở bước CONNECT.
 *
 * @param name     danh tính chuẩn hoá ({@code user:...} hoặc {@code guest:...}). Đây cũng là
 *                 khoá mà Spring dùng để định tuyến các đích {@code /user/**}.
 * @param guestKey khoá thiết bị mà phiên này khai lúc CONNECT, kể cả khi đã đăng nhập.
 *                 Giữ lại để phục vụ việc chuyển chủ ghế lúc khách đăng nhập giữa chừng
 *                 (xem {@code /app/seat-handover}); null nếu client không khai.
 */
public record StompPrincipal(String name, String guestKey) implements Principal {

    @Override
    public String getName() {
        return name;
    }
}
