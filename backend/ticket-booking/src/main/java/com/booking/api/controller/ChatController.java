package com.booking.api.controller;

import com.booking.api.dto.ChatRequest;
import com.booking.api.dto.ChatResponse;
import com.booking.api.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, java.security.Principal principal) {
        String username = principal != null ? principal.getName() : null;
        String reply = chatService.getChatResponse(request.getMessage(), username);
        return ResponseEntity.ok(new ChatResponse(reply));
    }
}
