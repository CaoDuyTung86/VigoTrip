package com.booking.api.dto;

import java.time.Duration;

/**
 * Kết quả của một lần mở hoặc gia hạn phiên: phần trả về cho client, và phần chỉ được phép
 * đi vào cookie.
 *
 * Hai nửa này cố tình tách rời để không ai lỡ tay ghép chúng lại. {@link AuthResponse} là
 * thứ được tuần tự hoá xuống JSON và JavaScript đọc được; {@code refreshToken} thì không,
 * và nếu nó lọt vào body thì toàn bộ công dụng của cookie HttpOnly biến mất — mã độc XSS
 * chỉ cần gọi /api/auth/refresh rồi đọc body là có chìa khoá sống 14 ngày mang đi.
 *
 * Vì vậy: chỉ AuthController được chạm vào {@code refreshToken}, và chỉ để đưa cho
 * RefreshCookieFactory.
 */
public record AuthResult(AuthResponse response, String refreshToken, Duration refreshTtl) {
}
