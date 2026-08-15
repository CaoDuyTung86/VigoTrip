package com.booking.api.controller;

import com.booking.api.dto.ChatRequest;
import com.booking.api.dto.ChatResponse;
import com.booking.api.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, Principal principal) {
        String username = principal != null ? principal.getName() : null;
        if (username == null && request.getCaptchaToken() != null) {
            boolean isValid = chatService.verifyTurnstile(request.getCaptchaToken());
            if (!isValid) return ResponseEntity.status(403).body(new ChatResponse("Captcha verification failed."));
        }
        String reply = chatService.getChatResponse(request.getMessage(), username, request.getSessionId(), request.getHistory(), request.getLanguage());
        return ResponseEntity.ok(new ChatResponse(reply));
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest request, Principal principal) {
        SseEmitter emitter = new SseEmitter(180000L); // 3 minutes timeout
        String username = principal != null ? principal.getName() : null;

        CompletableFuture.runAsync(() -> {
            try {
                if (username == null && request.getCaptchaToken() != null) {
                    boolean isValid = chatService.verifyTurnstile(request.getCaptchaToken());
                    if (!isValid) {
                        emitter.send(SseEmitter.event().data(Map.of("content", "Captcha verification failed.")));
                        emitter.complete();
                        return;
                    }
                }
                chatService.streamChatResponse(request.getMessage(), username, request.getSessionId(), request.getHistory(), request.getLanguage(), chunk -> {
                    try {
                        Map<String, String> data = Map.of("content", chunk);
                        emitter.send(SseEmitter.event().data(data));
                    } catch (Exception e) {
                        log.error("Error sending SSE chunk", e);
                    }
                });
                emitter.send(SseEmitter.event().data(Map.of("content", "[DONE]")));
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE stream error", e);
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @GetMapping("/chat/status")
    public ResponseEntity<Map<String, Object>> getChatStatus() {
        return ResponseEntity.ok(chatService.getAiHealthStatus());
    }
}

