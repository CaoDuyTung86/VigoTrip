package com.booking.api.service;

import com.booking.api.dto.ChatFeedbackRequest;
import com.booking.api.entity.ChatFeedback;
import com.booking.api.repository.ChatFeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Ghi nhận đánh giá 👍/👎 cho câu trả lời của chatbot.
 *
 * Đây là nguồn tín hiệu để biết chatbot đang sai/thiếu ở đâu mà không phải ngồi đọc
 * hội thoại của người dùng. Xem {@link ChatFeedback} về ranh giới dữ liệu.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatFeedbackService {

    private static final String RATING_UP = "UP";
    private static final String RATING_DOWN = "DOWN";

    /**
     * Danh sách lý do đóng. Không có "nhập lý do khác" bằng chữ tự do: ô text tự do là
     * đường nhanh nhất để số điện thoại, mã vé, email lọt vào một bảng vốn không định
     * chứa thông tin cá nhân.
     */
    private static final Set<String> ALLOWED_REASONS = Set.of(
            "WRONG_INFO",       // thông tin sai
            "NOT_UNDERSTOOD",   // không hiểu câu hỏi
            "INCOMPLETE",       // trả lời thiếu, chung chung
            "OFF_TOPIC",        // lạc đề
            "OTHER");

    private static final int MAX_SNIPPET_LENGTH = 500;
    private static final int MAX_REF_LENGTH = 64;

    private final ChatFeedbackRepository repository;
    private final ChatHistoryService chatHistoryService;

    @Value("${chat.feedback.enabled:true}")
    private boolean enabled;

    @Value("${chat.history.retention-days:30}")
    private int retentionDays;

    /**
     * Lưu một lượt đánh giá. Bấm lại lần nữa trên cùng câu trả lời thì SỬA dòng cũ, vì
     * người dùng đổi ý không phải là hai lượt đánh giá.
     *
     * @param userEmail email từ JWT, null nếu là khách vãng lai
     * @return true nếu đã ghi nhận
     */
    @Transactional
    public boolean submit(ChatFeedbackRequest request, String userEmail) {
        if (!enabled || request == null) {
            return false;
        }
        String messageRef = trimToNull(request.getMessageRef());
        String rating = request.getRating() == null ? null : request.getRating().trim().toUpperCase();
        if (messageRef == null || messageRef.length() > MAX_REF_LENGTH) {
            return false;
        }
        if (!RATING_UP.equals(rating) && !RATING_DOWN.equals(rating)) {
            return false;
        }

        // Lý do chỉ có nghĩa với đánh giá xấu; mã lạ thì bỏ chứ không lưu rác vào cột.
        String reason = null;
        if (RATING_DOWN.equals(rating)) {
            String raw = request.getReason() == null ? null : request.getReason().trim().toUpperCase();
            if (raw != null && ALLOWED_REASONS.contains(raw)) {
                reason = raw;
            }
        }

        String snippet = null;
        if (userEmail != null && chatHistoryService.isHistoryAllowed(userEmail)) {
            snippet = trimToNull(request.getQuestion());
            if (snippet != null && snippet.length() > MAX_SNIPPET_LENGTH) {
                snippet = snippet.substring(0, MAX_SNIPPET_LENGTH);
            }
        }

        try {
            Optional<ChatFeedback> existing = repository.findByMessageRef(messageRef);
            ChatFeedback feedback = existing.orElseGet(() -> ChatFeedback.builder()
                    .messageRef(messageRef)
                    .createdAt(LocalDateTime.now())
                    .build());

            feedback.setSessionId(truncate(request.getSessionId(), 100));
            feedback.setUserEmail(userEmail);
            feedback.setRating(rating);
            feedback.setReason(reason);
            feedback.setQuestionSnippet(snippet);
            feedback.setLang(truncate(request.getLanguage(), 8));
            repository.save(feedback);
            return true;
        } catch (Exception e) {
            // Hỏng việc ghi đánh giá không được phép làm hỏng cuộc trò chuyện.
            log.error("[ChatFeedback] Không lưu được đánh giá {}: {}", messageRef, e.getMessage());
            return false;
        }
    }

    /**
     * Đánh giá hiện có của các câu trả lời được nêu tên, dạng {messageRef -> {rating, reason}}.
     *
     * Chỉ dùng để dựng lại trạng thái nút 👍/👎 khi người dùng tải lại trang. Bên gọi phải
     * tự giới hạn danh sách ref vào những câu trả lời của chính người dùng đó — ở đây không
     * có cách nào kiểm tra, và cũng không được biến nó thành đường đọc đánh giá của người khác.
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, String>> ratingsFor(Collection<String> messageRefs) {
        if (messageRefs == null || messageRefs.isEmpty()) {
            return Map.of();
        }
        Map<String, Map<String, String>> result = new java.util.HashMap<>();
        for (ChatFeedback f : repository.findByMessageRefIn(messageRefs)) {
            Map<String, String> value = new java.util.HashMap<>(2);
            value.put("rating", f.getRating());
            value.put("reason", f.getReason());
            result.put(f.getMessageRef(), value);
        }
        return result;
    }

    /** Số liệu gộp trong N ngày gần nhất: mỗi phần tử là {rating, reason, count}. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> summary(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        return repository.summarizeSince(since).stream()
                .map(row -> Map.of(
                        "rating", row[0],
                        "reason", row[1] == null ? "NONE" : row[1],
                        "count", row[2]))
                .toList();
    }

    /** Người dùng xóa lịch sử thì phần nội dung họ để lại ở đây cũng phải đi theo. */
    @Transactional
    public int clearForUser(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return 0;
        }
        return repository.deleteByUserEmail(userEmail);
    }

    /**
     * Xóa trắng câu hỏi đã quá hạn lưu trữ nhưng GIỮ dòng điểm số: thống kê "tháng này
     * tỉ lệ 👎 tăng hay giảm" không cần biết người ta đã hỏi gì.
     */
    @Scheduled(cron = "${chat.feedback.cleanup-cron:0 30 3 * * *}")
    @Transactional
    public void purgeExpiredSnippets() {
        if (!enabled) {
            return;
        }
        int cleaned = repository.purgeSnippetsOlderThan(LocalDateTime.now().minusDays(retentionDays));
        if (cleaned > 0) {
            log.info("[ChatFeedback] Đã xóa nội dung câu hỏi ở {} đánh giá cũ hơn {} ngày.", cleaned, retentionDays);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
