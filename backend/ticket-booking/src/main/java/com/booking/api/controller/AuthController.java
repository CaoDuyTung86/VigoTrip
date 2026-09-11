package com.booking.api.controller;

import com.booking.api.dto.AuthResponse;
import com.booking.api.dto.AuthResult;
import com.booking.api.dto.ForgotPasswordRequest;
import com.booking.api.dto.GoogleLoginRequest;
import com.booking.api.dto.LoginRequest;
import com.booking.api.dto.RegisterRequest;
import com.booking.api.dto.ResetPasswordRequest;
import com.booking.api.security.RefreshCookieFactory;
import com.booking.api.service.AuthService;
import com.booking.api.service.RefreshTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshCookieFactory refreshCookieFactory;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        // Đăng ký KHÔNG mở phiên: tài khoản còn enabled = false cho tới khi xác thực email.
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletRequest httpRequest) {
        return withRefreshCookie(authService.login(request, userAgent(httpRequest)), httpRequest);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request,
                                              HttpServletRequest httpRequest) {
        authService.resetPassword(request);
        // Mọi phiên vừa bị thu hồi phía máy chủ, kể cả phiên của chính trình duyệt này nếu
        // người dùng đổi mật khẩu trong lúc vẫn đang đăng nhập. Xoá luôn cookie để trình
        // duyệt không còn cầm một chuỗi đã chết và gọi /refresh vô ích ở mỗi lần mở trang.
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.clear(httpRequest))
                .build();
    }

    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@RequestParam String email,
                                                    @RequestParam String code,
                                                    HttpServletRequest httpRequest) {
        return withRefreshCookie(authService.verifyEmail(email, code, userAgent(httpRequest)), httpRequest);
    }

    /** Gửi lại mã xác thực cho tài khoản chưa kích hoạt. Luôn 204 để không lộ email nào tồn tại. */
    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@RequestParam String email) {
        authService.resendVerification(email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/google-login")
    public ResponseEntity<AuthResponse> googleLogin(@Valid @RequestBody GoogleLoginRequest request,
                                                    HttpServletRequest httpRequest) {
        return withRefreshCookie(authService.googleLogin(request, userAgent(httpRequest)), httpRequest);
    }

    /**
     * Đổi refresh token (nằm trong cookie HttpOnly, client không đọc được và cũng không gửi
     * tay được) lấy một access token mới.
     *
     * Đây là endpoint DUY NHẤT của hệ thống hoạt động dựa trên cookie, nên cũng là endpoint
     * duy nhất có bề mặt CSRF. Ba lớp che nó:
     *   1. SameSite=Lax trên cookie — trình duyệt không đính cookie vào POST từ site khác.
     *   2. Method POST — Lax chỉ nới lỏng cho điều hướng GET ở cấp cao nhất.
     *   3. Kết quả nằm trong body, mà body thì CORS không cho trang khác đọc. Kể cả khi
     *      request lọt qua được, kẻ tấn công cũng chỉ làm token của nạn nhân xoay một vòng
     *      chứ không lấy được gì.
     *
     * Trả 401 khi không có cookie hoặc cookie đã chết; giao diện hiểu đó là "chưa đăng nhập"
     * và dừng lại, không thử lại.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest httpRequest) {
        String rawToken = refreshCookieFactory.read(httpRequest).orElse(null);
        AuthResult result = authService.refreshSession(rawToken, userAgent(httpRequest));
        return withRefreshCookie(result, httpRequest);
    }

    /**
     * Đăng xuất: thu hồi cả họ token phía máy chủ RỒI mới xoá cookie.
     *
     * Thứ tự đó quan trọng. Chỉ xoá cookie là "đăng xuất" kiểu trang trí — bản sao mà kẻ
     * tấn công đã kịp lấy vẫn dùng được tới hết hạn, và chính đó là điều mà một hệ thống
     * chỉ có JWT không bao giờ làm được.
     *
     * Luôn trả 204 kể cả khi không có cookie: đăng xuất không phải là thao tác có thể thất
     * bại từ góc nhìn người dùng, và việc phân biệt "có phiên / không có phiên" ở đây cũng
     * chẳng cho ai thêm thông tin gì hữu ích.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        refreshCookieFactory.read(httpRequest).ifPresent(refreshTokenService::revokeByRawToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.clear(httpRequest))
                .build();
    }

    /**
     * Đăng xuất mọi thiết bị khác, giữ nguyên thiết bị đang gọi.
     *
     * Nằm ở /api/auth chứ không ở /api/users là có lý do vật lý: cookie refresh được đặt
     * Path=/api/auth, nên đây là nhóm endpoint DUY NHẤT trình duyệt chịu đính nó vào. Mà
     * cookie lại là thứ duy nhất cho biết "phiên nào đang được dùng" — thông tin mà access
     * token không mang. Chuyển endpoint này sang chỗ khác là mất khả năng chừa lại đúng
     * thiết bị hiện tại.
     *
     * Giao diện gọi nó ngay sau khi đổi mật khẩu thành công.
     */
    @PostMapping("/revoke-other-sessions")
    public ResponseEntity<Void> revokeOtherSessions(HttpServletRequest httpRequest) {
        String rawToken = refreshCookieFactory.read(httpRequest).orElse(null);
        refreshTokenService.revokeOtherSessions(rawToken, RefreshTokenService.REASON_PASSWORD_CHANGED);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthResult result, HttpServletRequest httpRequest) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshCookieFactory.build(result.refreshToken(), result.refreshTtl(), httpRequest))
                .body(result.response());
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }
}
