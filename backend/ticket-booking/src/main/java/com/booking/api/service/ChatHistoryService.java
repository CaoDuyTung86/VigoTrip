package com.booking.api.service;

import com.booking.api.entity.ChatMessage;
import com.booking.api.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Lưu và dọn lịch sử hội thoại chatbot.
 *
 * Trước đây không có gì được lưu: lịch sử do client gửi lại ở mỗi lượt và mất sạch khi
 * tải lại trang.
 *
 * Ranh giới quyền riêng tư được thực thi ngay tại đây, không phụ thuộc bên gọi nhớ:
 * userEmail null (khách vãng lai) thì lưu là no-op, và mọi thao tác đọc đều bắt buộc
 * kèm userEmail.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatHistoryService {

    private static final int MAX_CONTENT_LENGTH = 4000;

    private final ChatMessageRepository repository;

    @Value("${chat.history.enabled:true}")
    private boolean enabled;

    @Value("${chat.history.retention-days:30}")
    private int retentionDays;

    @Value("${chat.history.max-messages-returned:50}")
    private int maxMessagesReturned;

    /**
     * Lưu một cặp hỏi-đáp. Không làm gì khi người dùng chưa đăng nhập — cố ý, xem
     * ghi chú quyền riêng tư ở {@link ChatMessage}.
     *
     * Lỗi khi lưu chỉ được ghi log: hỏng việc lưu lịch sử không được phép làm hỏng câu
     * trả lời mà khách đang chờ.
     */
    @Transactional
    public void saveExchange(String userEmail, String sessionId, String question, String answer, String lang) {
        if (!enabled || userEmail == null || userEmail.isBlank()) {
            return;
        }
        try {
            LocalDateTime now = LocalDateTime.now();
            List<ChatMessage> batch = new ArrayList<>(2);
            batch.add(build(userEmail, sessionId, "user", question, lang, now));
            if (answer != null && !answer.isBlank()) {
                // Cộng 1 nano để câu trả lời luôn xếp sau câu hỏi khi sắp theo thời gian.
                batch.add(build(userEmail, sessionId, "assistant", answer, lang, now.plusNanos(1000)));
            }
            repository.saveAll(batch);
        } catch (Exception e) {
            log.error("[ChatHistory] Không lưu được hội thoại của {}: {}", userEmail, e.getMessage());
        }
    }

    private ChatMessage build(String userEmail, String sessionId, String role, String content,
                              String lang, LocalDateTime createdAt) {
        String safeContent = content == null ? "" : content;
        if (safeContent.length() > MAX_CONTENT_LENGTH) {
            safeContent = safeContent.substring(0, MAX_CONTENT_LENGTH);
        }
        return ChatMessage.builder()
                .userEmail(userEmail)
                .sessionId(sessionId)
                .role(role)
                .content(safeContent)
                .lang(lang)
                .createdAt(createdAt)
                .build();
    }

    /** Lịch sử của chính người dùng, cũ trước mới sau để hiển thị thẳng lên UI. */
    @Transactional(readOnly = true)
    public List<ChatMessage> getHistory(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return List.of();
        }
        List<ChatMessage> newestFirst = repository.findByUserEmailOrderByCreatedAtDesc(
                userEmail, PageRequest.of(0, maxMessagesReturned));

        List<ChatMessage> chronological = new ArrayList<>(newestFirst);
        java.util.Collections.reverse(chronological);
        return chronological;
    }

    /** Người dùng tự xóa lịch sử của mình. */
    @Transactional
    public int clearHistory(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return 0;
        }
        return repository.deleteByUserEmail(userEmail);
    }

    /**
     * Dọn tin nhắn quá hạn lưu trữ. Chạy mỗi ngày một lần lúc 3 giờ sáng, giờ thấp điểm.
     */
    @Scheduled(cron = "${chat.history.cleanup-cron:0 0 3 * * *}")
    @Transactional
    public void purgeExpiredMessages() {
        if (!enabled) {
            return;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        int deleted = repository.deleteOlderThan(cutoff);
        if (deleted > 0) {
            log.info("[ChatHistory] Đã xóa {} tin nhắn cũ hơn {} ngày.", deleted, retentionDays);
        }
    }
}
