package com.booking.api.controller;

import com.booking.api.dto.ChatFeedbackRequest;
import com.booking.api.dto.ChatRequest;
import com.booking.api.dto.ChatResponse;
import com.booking.api.service.ChatFeedbackService;
import com.booking.api.service.ChatHistoryService;
import com.booking.api.service.ChatMetricService;
import com.booking.api.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final ChatHistoryService chatHistoryService;
    private final ChatFeedbackService chatFeedbackService;
    private final ChatMetricService chatMetricService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, Principal principal) {
        String username = principal != null ? principal.getName() : null;
        // Khách chưa đăng nhập LUÔN phải qua Turnstile — không phụ thuộc việc client
        // có gửi captchaToken hay không (bỏ trống token trước đây là bypass được).
        if (username == null && !chatService.verifyTurnstile(request.getCaptchaToken())) {
            return ResponseEntity.status(403).body(new ChatResponse("Captcha verification failed."));
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
                if (username == null && !chatService.verifyTurnstile(request.getCaptchaToken())) {
                    emitter.send(SseEmitter.event().data(Map.of("content", "Captcha verification failed.")));
                    emitter.complete();
                    return;
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

    /**
     * Lịch sử chat của CHÍNH người dùng đang đăng nhập.
     *
     * Danh tính lấy từ Principal (JWT), không nhận tham số nào từ client — không có
     * cách nào yêu cầu lịch sử của người khác. Khách vãng lai nhận về danh sách rỗng
     * vì hội thoại của họ không được lưu.
     */
    @GetMapping("/chat/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(Principal principal) {
        if (principal == null) {
            return ResponseEntity.ok(List.of());
        }
        List<Map<String, Object>> history = chatHistoryService.getHistory(principal.getName()).stream()
                .map(msg -> Map.<String, Object>of(
                        "role", msg.getRole(),
                        "content", msg.getContent(),
                        "createdAt", msg.getCreatedAt().toString()))
                .toList();
        return ResponseEntity.ok(history);
    }

    /** Người dùng tự xóa lịch sử chat của mình. */
    @DeleteMapping("/chat/history")
    public ResponseEntity<Map<String, Object>> clearHistory(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Cần đăng nhập."));
        }
        int deleted = chatHistoryService.clearHistory(principal.getName());
        // Câu hỏi mà người dùng đính kèm khi bấm 👎 cũng là nội dung của họ: "xóa lịch sử"
        // mà để lại phần đó thì không phải là xóa.
        chatFeedbackService.clearForUser(principal.getName());
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    /**
     * Đánh giá 👍/👎 một câu trả lời của bot.
     *
     * Khách vãng lai gửi được: cú bấm chính là sự đồng ý, và thứ lưu lại chỉ là điểm số
     * ẩn danh. Luôn trả 200 kể cả khi request không hợp lệ — đây là tín hiệu phụ, không
     * đáng để bắn lỗi đỏ vào giữa cuộc trò chuyện của người dùng.
     */
    @PostMapping("/chat/feedback")
    public ResponseEntity<Map<String, Object>> submitFeedback(@RequestBody ChatFeedbackRequest request,
                                                              Principal principal) {
        String username = principal != null ? principal.getName() : null;
        boolean saved = chatFeedbackService.submit(request, username);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    /**
     * Số liệu gộp để biết chatbot đang yếu ở đâu. Không có đường nào đọc được đánh giá
     * của một người cụ thể.
     */
    @GetMapping("/chat/feedback/summary")
    public ResponseEntity<List<Map<String, Object>>> feedbackSummary(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(chatFeedbackService.summary(days));
    }

    /**
     * Toàn bộ số liệu vận hành chatbot cho bảng điều khiển: lượt hỏi, độ trễ, tỉ lệ lỗi,
     * tỉ lệ RAG trúng, đánh giá 👍/👎 và chuỗi theo ngày.
     *
     * Mở cho cả admin lẫn đối tác: ở đây toàn số đo ẩn danh, không có nội dung và không
     * có danh tính. Phần có nội dung nằm ở /chat/ops/issues và chỉ admin xem được.
     */
    @GetMapping("/chat/ops/summary")
    public ResponseEntity<Map<String, Object>> opsSummary(@RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(chatMetricService.summary(days));
    }

    /**
     * Các câu hỏi bị đánh giá 👎, để biết cụ thể chatbot hỏng ở chỗ nào.
     *
     * CHỈ ADMIN. Đây là nội dung do người dùng gõ ra — chỉ những dòng mà người hỏi đã
     * đăng nhập và đang bật đồng ý lưu hội thoại, không kèm email, không kèm câu trả lời
     * của bot, không kèm phần còn lại của hội thoại.
     */
    @GetMapping("/chat/ops/issues")
    public ResponseEntity<List<Map<String, Object>>> opsIssues(@RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(chatMetricService.recentIssues(days));
    }
}

