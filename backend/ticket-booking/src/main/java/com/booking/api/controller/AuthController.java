package com.booking.api.controller;

import com.booking.api.dto.AuthResponse;
import com.booking.api.dto.ForgotPasswordRequest;
import com.booking.api.dto.GoogleLoginRequest;
import com.booking.api.dto.LoginRequest;
import com.booking.api.dto.RegisterRequest;
import com.booking.api.dto.ResetPasswordRequest;
import com.booking.api.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@RequestParam String email, @RequestParam String code) {
        AuthResponse response = authService.verifyEmail(email, code);
        return ResponseEntity.ok(response);
    }

    /** Gửi lại mã xác thực cho tài khoản chưa kích hoạt. Luôn 204 để không lộ email nào tồn tại. */
    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@RequestParam String email) {
        authService.resendVerification(email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/google-login")
    public ResponseEntity<AuthResponse> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
        AuthResponse response = authService.googleLogin(request);
        return ResponseEntity.ok(response);
    }
}
