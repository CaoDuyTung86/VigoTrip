package com.booking.api.controller;

import com.booking.api.service.ChatActionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

/**
 * Nút xác nhận cho những hành động có ghi dữ liệu mà trợ lý đề xuất (xem {@link ChatActionService}).
 *
 * <p>Cố ý KHÔNG nằm dưới {@code /api/chat/**}: nhánh đó mở cho khách vãng lai, còn ở đây mọi
 * request phải đăng nhập. Mã đề xuất của người khác trả 404 y như mã không tồn tại, để không ai
 * dùng endpoint này dò xem một mã có thật hay không.
 */
@RestController
@RequestMapping("/api/chat-actions")
@RequiredArgsConstructor
public class ChatActionController {

    private final ChatActionService chatActionService;

    @GetMapping("/{token}")
    public ResponseEntity<ChatActionService.ActionView> describe(@PathVariable String token, Principal principal) {
        return chatActionService.describe(token, principal.getName())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{token}/confirm")
    public ResponseEntity<Map<String, String>> confirm(@PathVariable String token, Principal principal) {
        ChatActionService.ConfirmResult result = chatActionService.confirm(token, principal.getName());
        return switch (result) {
            case SAVED -> ResponseEntity.ok(Map.of("status", result.name()));
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case NO_LONGER_AVAILABLE -> ResponseEntity.status(409).body(Map.of("status", result.name()));
        };
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> cancel(@PathVariable String token, Principal principal) {
        return chatActionService.cancel(token, principal.getName())
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
