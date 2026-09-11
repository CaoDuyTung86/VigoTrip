package com.booking.api.exception;

/**
 * Refresh token không dùng được: không tồn tại, đã hết hạn, đã đăng xuất, hoặc vừa kích
 * hoạt cơ chế phát hiện dùng lại.
 *
 * Cố tình KHÔNG nói ra lý do cụ thể cho client. Phân biệt "token này chưa từng tồn tại"
 * với "token này có thật nhưng đã bị thu hồi" là đưa cho kẻ tấn công một máy dò: nó thử
 * hàng loạt chuỗi và biết chuỗi nào từng là token thật. Ở đây chỉ có đúng một kết quả —
 * 401 kèm một câu duy nhất, phần chi tiết nằm trong log của máy chủ.
 */
public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}
