package com.booking.api.realtime;

import java.util.Locale;

/**
 * Danh tính dùng để giữ ghế, ở dạng chuẩn hoá.
 *
 * <p>Trước đây danh tính là một chuỗi tự do do trình duyệt gửi lên qua WebSocket: hoặc là
 * email (khi đã đăng nhập), hoặc là khoá thiết bị {@code sess_...} sinh ngẫu nhiên trong
 * localStorage (khi chưa đăng nhập). Máy chủ tin thẳng chuỗi đó, nên bất kỳ ai cũng có thể
 * gửi {@code {"status":"AVAILABLE","userId":"nan.nhan@gmail.com"}} để nhả ghế người khác
 * đang giữ, hoặc giữ ghế dưới tên người khác.
 *
 * <p>Giờ danh tính luôn do máy chủ suy ra và mang tiền tố nói rõ nguồn gốc:
 * <ul>
 *   <li>{@code user:<email>} — lấy từ JWT đã xác thực ở bước CONNECT. Client không chọn được.</li>
 *   <li>{@code guest:<khoá thiết bị>} — khách chưa đăng nhập, vẫn được giữ ghế vì luồng đặt
 *       vé cho phép chọn ghế trước rồi mới đăng nhập ở bước thanh toán.</li>
 * </ul>
 *
 * <p>Tiền tố là ranh giới an ninh: một phiên khách không tài nào tạo ra được danh tính
 * {@code user:...}, nên không thể mạo danh tài khoản đã đăng nhập nữa. Hai phiên khách vẫn
 * phân biệt nhau bằng khoá thiết bị — khoá đó không còn bị phát tán ra ngoài nữa, xem
 * {@link SeatOwnerTokenService}.
 */
public final class SeatIdentity {

    public static final String USER_PREFIX = "user:";
    public static final String GUEST_PREFIX = "guest:";

    private SeatIdentity() {
    }

    /**
     * Danh tính của tài khoản đã đăng nhập. Email hạ hết về chữ thường vì tài khoản Google
     * có thể trả về email lệch hoa/thường so với bản lưu trong CSDL — so sánh phân biệt
     * hoa thường sẽ chặn nhầm chính người đang giữ ghế.
     */
    public static String ofUser(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email không được rỗng khi dựng danh tính giữ ghế");
        }
        return USER_PREFIX + email.trim().toLowerCase(Locale.ROOT);
    }

    /** Danh tính của khách chưa đăng nhập, dựa trên khoá thiết bị trong localStorage. */
    public static String ofGuest(String deviceKey) {
        if (deviceKey == null || deviceKey.isBlank()) {
            throw new IllegalArgumentException("Khoá thiết bị không được rỗng khi dựng danh tính giữ ghế");
        }
        return GUEST_PREFIX + deviceKey.trim();
    }

    public static boolean isUser(String identity) {
        return identity != null && identity.startsWith(USER_PREFIX);
    }

    public static boolean isGuest(String identity) {
        return identity != null && identity.startsWith(GUEST_PREFIX);
    }
}
