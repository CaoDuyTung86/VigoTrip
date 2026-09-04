package com.booking.api.service;

import com.booking.api.entity.ChatMessage;
import com.booking.api.repository.ChatMessageRepository;
import com.booking.api.repository.UserRepository;
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
    private static final int MAX_REF_LENGTH = 64;
    /** UUID hoặc ref dự phòng của client — chữ, số, gạch ngang, gạch dưới. */
    private static final java.util.regex.Pattern REF_PATTERN =
            java.util.regex.Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private final ChatMessageRepository repository;
    private final UserRepository userRepository;

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
    public void saveExchange(String userEmail, String sessionId, String question, String answer, String lang,
                             String messageRef) {
        if (!enabled || userEmail == null || userEmail.isBlank()) {
            return;
        }
        if (!isHistoryAllowed(userEmail)) {
            return;
        }
        try {
            LocalDateTime now = LocalDateTime.now();
            List<ChatMessage> batch = new ArrayList<>(2);
            batch.add(build(userEmail, sessionId, "user", question, lang, now, null));
            if (answer != null && !answer.isBlank()) {
                // Cộng 1 nano để câu trả lời luôn xếp sau câu hỏi khi sắp theo thời gian.
                batch.add(build(userEmail, sessionId, "assistant", answer, lang, now.plusNanos(1000),
                        sanitizeRef(messageRef)));
            }
            repository.saveAll(batch);
        } catch (Exception e) {
            log.error("[ChatHistory] Không lưu được hội thoại của {}: {}", userEmail, e.getMessage());
        }
    }

    /**
     * Ref do client gửi lên nên coi là dữ liệu chưa tin được: quá dài hoặc có ký tự lạ thì
     * bỏ hẳn chứ không cắt bừa — mất nút đánh giá ở một lượt còn hơn ghi rác vào cột khóa.
     */
    private static String sanitizeRef(String messageRef) {
        String trimmed = messageRef == null ? null : messageRef.trim();
        if (trimmed == null || trimmed.isEmpty() || trimmed.length() > MAX_REF_LENGTH) {
            return null;
        }
        return REF_PATTERN.matcher(trimmed).matches() ? trimmed : null;
    }

    private ChatMessage build(String userEmail, String sessionId, String role, String content,
                              String lang, LocalDateTime createdAt, String messageRef) {
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
                .messageRef(messageRef)
                .build();
    }

    /**
     * Người dùng này có đang cho phép lưu nội dung hội thoại không.
     *
     * Đọc thêm một dòng ở mỗi lượt chat là cái giá phải trả để công tắc có hiệu lực ngay:
     * cache lại thì người vừa tắt vẫn bị ghi thêm vài lượt nữa, mà đó đúng là điều họ
     * vừa nói là không muốn.
     */
    @Transactional(readOnly = true)
    public boolean isHistoryAllowed(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return false;
        }
        return userRepository.findChatHistoryOptIn(userEmail).orElse(Boolean.TRUE);
    }

    /**
     * Câu trả lời mang mã này có nằm trong lịch sử của chính người dùng đó không.
     *
     * Đường kiểm tra thứ hai cho đánh giá 👍/👎, bên cạnh sổ trong bộ nhớ
     * ({@link ChatMessageRefRegistry}). Cần cả hai vì chúng bù chỗ hở của nhau: sổ mất sau
     * mỗi lần server khởi động lại, còn lịch sử DB thì chỉ có với người đã đăng nhập và đang
     * bật đồng ý lưu.
     */
    @Transactional(readOnly = true)
    public boolean ownsMessageRef(String userEmail, String messageRef) {
        if (userEmail == null || userEmail.isBlank() || messageRef == null || messageRef.isBlank()) {
            return false;
        }
        return repository.existsByMessageRefAndUserEmail(messageRef, userEmail);
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
