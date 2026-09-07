package com.booking.api.controller;

import com.booking.api.dto.ChangePasswordRequest;
import com.booking.api.dto.UserResponse;
import com.booking.api.dto.UserUpdateRequest;
import com.booking.api.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMyProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(userDetails.getUsername()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateMyProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(userDetails.getUsername(), request));
    }

    /**
     * Bật/tắt lưu hội thoại với trợ lý AI. Endpoint riêng chứ không nhét vào PUT /me:
     * đây là công tắc bấm phát ăn ngay, không nằm trong form "lưu thông tin cá nhân",
     * và tắt nó còn kéo theo việc xóa dữ liệu — trộn chung sẽ khó đọc lẫn khó kiểm toán.
     */
    @PutMapping("/me/chat-consent")
    public ResponseEntity<UserResponse> setChatConsent(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        Boolean optIn = body.get("chatHistoryOptIn");
        if (optIn == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(userService.setChatHistoryOptIn(userDetails.getUsername(), optIn));
    }

    /**
     * Ghi lại ngôn ngữ tài khoản đang dùng.
     *
     * <p>Endpoint riêng, cùng lý do với /me/chat-consent: nút đổi ngôn ngữ trên header bấm
     * phát ăn ngay, không nằm trong form "lưu thông tin cá nhân" — nhét vào PUT /me thì mỗi
     * lần đổi cờ tiếng lại phải gửi kèm cả họ tên và số điện thoại.
     */
    @PutMapping("/me/language")
    public ResponseEntity<UserResponse> setLanguage(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String language = body.get("language");
        if (language == null || language.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(userService.setLanguage(userDetails.getUsername(), language));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userDetails.getUsername(), request.getOldPassword(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công!"));
    }
}
