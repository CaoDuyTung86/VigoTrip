package com.booking.api.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Dựng và xoá cookie chứa refresh token.
 *
 * Mọi thuộc tính dưới đây đều là một lớp phòng thủ, không phải thủ tục:
 *
 * HttpOnly — JavaScript trong trang KHÔNG đọc được cookie này. Đây là toàn bộ lý do tồn tại
 *   của cả thiết kế: mã độc chèn được vào trang (XSS) không có cách nào lấy ra chuỗi token
 *   để gửi về máy chủ của kẻ tấn công. Nó vẫn gọi API thay mặt nạn nhân được trong lúc trang
 *   còn mở, nhưng không mang được chìa khoá đi nơi khác.
 *
 * Path=/api/auth — trình duyệt chỉ đính cookie vào đúng nhóm endpoint cần nó. Hàng trăm
 *   request khác của ứng dụng (đặt vé, thanh toán, chat) không mang theo chìa khoá sống lâu
 *   này, nên một lỗi ghi log hay một proxy nói nhiều ở nhánh đó cũng không làm rò rỉ nó.
 *
 * SameSite=Lax — trình duyệt không gửi cookie kèm request POST xuất phát từ trang web khác.
 *   Đây là lá chắn CSRF chính cho /api/auth/refresh và /api/auth/logout.
 *
 * Secure — chỉ gửi qua HTTPS. Bật/tắt theo scheme thật của request (xem {@link #isSecure}),
 *   vì đặt cứng thành true sẽ làm cookie biến mất im lặng khi chạy local qua http.
 */
@Component
@Slf4j
public class RefreshCookieFactory {

    /**
     * Tên cookie có tiền tố dự án để không đụng cookie của dịch vụ khác khi chạy chung
     * tên miền (bản deploy AWS đặt cả frontend lẫn backend sau một Nginx).
     */
    public static final String COOKIE_NAME = "vg_refresh";

    private static final String COOKIE_PATH = "/api/auth";

    /**
     * auto = suy ra từ chính request (xem {@link #isSecure}). true/false = ép cứng.
     *
     * Để "auto" trừ khi có lý do rõ ràng: ép true trên môi trường http sẽ khiến trình duyệt
     * lặng lẽ bỏ cookie đi — không lỗi, không cảnh báo, chỉ là đăng nhập xong tải lại trang
     * là mất phiên, và sẽ mất rất nhiều thời gian để tìm ra vì sao.
     */
    @Value("${app.auth.refresh-cookie.secure:auto}")
    private String secureMode;

    /**
     * Lax là đúng cho kiến trúc hiện tại: frontend gọi /api qua rewrite của Vercel (và qua
     * Nginx ở bản AWS), nên với trình duyệt thì frontend và API cùng một site.
     *
     * Chỉ đổi sang None nếu có ngày nào đó frontend gọi THẲNG sang tên miền của backend.
     * Lúc đó None bắt buộc đi kèm Secure, và lá chắn CSRF do SameSite cung cấp biến mất —
     * phải bù lại bằng một cơ chế khác (double-submit token hoặc header bắt buộc), đừng đổi
     * giá trị này rồi bỏ đó.
     */
    @Value("${app.auth.refresh-cookie.same-site:Lax}")
    private String sameSite;

    /** Cookie mang token mới, sống đúng bằng hạn của token đó. */
    public String build(String rawToken, Duration ttl, HttpServletRequest request) {
        return ResponseCookie.from(COOKIE_NAME, rawToken)
                .httpOnly(true)
                .secure(isSecure(request))
                .sameSite(sameSite)
                .path(COOKIE_PATH)
                .maxAge(ttl.isNegative() ? Duration.ZERO : ttl)
                .build()
                .toString();
    }

    /**
     * Cookie rỗng, hạn 0 — trình duyệt xoá bản cũ.
     *
     * Phải khớp CHÍNH XÁC domain/path/secure/sameSite của cookie lúc đặt, nếu không trình
     * duyệt coi đây là một cookie khác và cookie thật vẫn nằm nguyên đó sau khi đăng xuất.
     */
    public String clear(HttpServletRequest request) {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(isSecure(request))
                .sameSite(sameSite)
                .path(COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build()
                .toString();
    }

    public Optional<String> read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> COOKIE_NAME.equals(c.getName()))
                .map(jakarta.servlet.http.Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }

    /**
     * Request này có thật sự đi qua HTTPS không.
     *
     * request.isSecure() một mình là chưa đủ khi ứng dụng đứng sau proxy: Vercel và Render
     * đều kết thúc TLS ở ngoài rồi nói chuyện HTTP với container, nên bên trong Tomcat mọi
     * request đều trông như http. X-Forwarded-Proto là thứ duy nhất còn giữ được sự thật.
     *
     * Header này do client gửi lên được, tức là giả mạo được — nhưng hậu quả của việc giả
     * mạo ở đây chỉ là tự đánh dấu cookie CỦA CHÍNH MÌNH là Secure, không ảnh hưởng tới ai.
     * Chiều ngược lại mới nguy hiểm (hạ cờ Secure), và chiều đó không xảy ra: bỏ header đi
     * thì kết quả là false, mà false chỉ khiến cookie kém an toàn hơn cho chính kẻ đó.
     */
    private boolean isSecure(HttpServletRequest request) {
        if ("true".equalsIgnoreCase(secureMode)) {
            return true;
        }
        if ("false".equalsIgnoreCase(secureMode)) {
            return false;
        }
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        // Chuỗi nhiều hop có dạng "https,http" — hop ngoài cùng (đầu tiên) mới là cái
        // trình duyệt thật sự nói chuyện.
        return forwardedProto != null && forwardedProto.split(",")[0].trim().equalsIgnoreCase("https");
    }
}
