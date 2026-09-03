package com.booking.api.service;

import com.booking.api.entity.ChatFeedback;
import com.booking.api.entity.ChatTurnMetric;
import com.booking.api.repository.ChatFeedbackRepository;
import com.booking.api.repository.ChatTurnMetricRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Số đo vận hành của chatbot: ghi nhận từng lượt và tổng hợp cho bảng điều khiển.
 *
 * Ranh giới với {@link ChatHistoryService}: ở đây KHÔNG có nội dung và KHÔNG có danh tính
 * (xem {@link ChatTurnMetric}). Nhờ vậy phần này ghi cho mọi lượt chat, kể cả khách vãng
 * lai và cả người đã tắt lưu lịch sử — không có gì trong đó quy được về một con người.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMetricService {

    private final ChatTurnMetricRepository repository;
    private final ChatFeedbackRepository feedbackRepository;

    @Value("${chat.metrics.enabled:true}")
    private boolean enabled;

    @Value("${chat.metrics.retention-days:90}")
    private int retentionDays;

    @Value("${chat.metrics.max-issues-returned:20}")
    private int maxIssuesReturned;

    /**
     * Ghi một lượt. Nuốt mọi lỗi: hỏng việc đo đạc không được phép làm hỏng câu trả lời
     * mà khách đang chờ — cùng nguyên tắc với việc lưu lịch sử.
     */
    @Transactional
    public void record(String lang, boolean authenticated, boolean streamed, long latencyMs,
                       int questionChars, int answerChars, int ragChunks, String outcome) {
        if (!enabled) {
            return;
        }
        try {
            repository.save(ChatTurnMetric.builder()
                    .createdAt(LocalDateTime.now())
                    .lang(lang == null || lang.isBlank() ? null : lang.substring(0, Math.min(8, lang.length())))
                    .authenticated(authenticated)
                    .streamed(streamed)
                    .latencyMs((int) Math.min(latencyMs, Integer.MAX_VALUE))
                    .questionChars(questionChars)
                    .answerChars(answerChars)
                    .ragChunks(ragChunks)
                    .outcome(outcome)
                    .build());
        } catch (Exception e) {
            log.error("[ChatMetric] Không ghi được số đo lượt chat: {}", e.getMessage());
        }
    }

    /**
     * Toàn bộ số liệu cho bảng điều khiển trong N ngày gần nhất.
     *
     * Gộp thành MỘT endpoint thay vì để giao diện gọi bốn cái rồi tự ghép: các con số
     * trên cùng một màn hình phải cùng một kỳ, nếu không sẽ có lúc biểu đồ chỏi với ô
     * tổng ngay bên cạnh.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(int days) {
        int window = Math.min(Math.max(days, 1), 365);
        LocalDateTime since = LocalDate.now().minusDays(window - 1L).atStartOfDay();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days", window);
        result.put("totals", totals(since));
        result.put("feedback", feedbackTotals(since));
        result.put("reasons", reasonBreakdown(since));
        result.put("daily", dailySeries(since));
        return result;
    }

    private Map<String, Object> totals(LocalDateTime since) {
        Map<String, Object> totals = new LinkedHashMap<>();
        List<Object[]> rows = repository.aggregateSince(since);
        Object[] row = rows.isEmpty() ? null : rows.get(0);

        long turns = row == null ? 0 : toLong(row[0]);
        totals.put("turns", turns);
        totals.put("avgLatencyMs", row == null ? 0 : Math.round(toDouble(row[1])));
        totals.put("maxLatencyMs", row == null ? 0 : toLong(row[2]));
        totals.put("memberTurns", row == null ? 0 : toLong(row[3]));
        totals.put("guestTurns", row == null ? 0 : turns - toLong(row[3]));
        totals.put("ragHitTurns", row == null ? 0 : toLong(row[4]));
        totals.put("failedTurns", row == null ? 0 : toLong(row[5]));
        totals.put("avgAnswerChars", row == null ? 0 : Math.round(toDouble(row[6])));
        return totals;
    }

    private Map<String, Object> feedbackTotals(LocalDateTime since) {
        long up = 0;
        long down = 0;
        for (Object[] row : feedbackRepository.summarizeSince(since)) {
            long count = toLong(row[2]);
            if ("UP".equals(row[0])) {
                up += count;
            } else {
                down += count;
            }
        }
        Map<String, Object> feedback = new LinkedHashMap<>();
        feedback.put("up", up);
        feedback.put("down", down);
        return feedback;
    }

    /** Lý do bị chê, nhiều nhất trước — đây chính là danh sách việc cần làm. */
    private List<Map<String, Object>> reasonBreakdown(LocalDateTime since) {
        Map<String, Long> byReason = new LinkedHashMap<>();
        for (Object[] row : feedbackRepository.summarizeSince(since)) {
            if (!"DOWN".equals(row[0])) {
                continue;
            }
            String reason = row[1] == null ? "NONE" : String.valueOf(row[1]);
            byReason.merge(reason, toLong(row[2]), Long::sum);
        }
        return byReason.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> Map.<String, Object>of("reason", e.getKey(), "count", e.getValue()))
                .toList();
    }

    /** Một phần tử mỗi ngày CÓ dữ liệu; ngày trống không được bịa ra thành số 0. */
    private List<Map<String, Object>> dailySeries(LocalDateTime since) {
        Map<String, Map<String, Object>> byDate = new LinkedHashMap<>();

        for (Object[] row : repository.dailySince(since)) {
            String date = isoDate(row[0], row[1], row[2]);
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", date);
            day.put("turns", toLong(row[3]));
            day.put("avgLatencyMs", Math.round(toDouble(row[4])));
            day.put("failed", toLong(row[5]));
            day.put("ragHit", toLong(row[6]));
            day.put("up", 0L);
            day.put("down", 0L);
            byDate.put(date, day);
        }

        for (Object[] row : feedbackRepository.dailyRatingsSince(since)) {
            String date = isoDate(row[0], row[1], row[2]);
            // Có thể có đánh giá vào một ngày không có lượt chat nào được đo (ví dụ người
            // dùng bấm 👎 cho câu trả lời từ hôm trước) — vẫn phải hiện, nên tạo dòng mới.
            Map<String, Object> day = byDate.computeIfAbsent(date, d -> {
                Map<String, Object> empty = new LinkedHashMap<>();
                empty.put("date", d);
                empty.put("turns", 0L);
                empty.put("avgLatencyMs", 0L);
                empty.put("failed", 0L);
                empty.put("ragHit", 0L);
                empty.put("up", 0L);
                empty.put("down", 0L);
                return empty;
            });
            day.put("UP".equals(row[3]) ? "up" : "down", toLong(row[4]));
        }

        List<Map<String, Object>> series = new ArrayList<>(byDate.values());
        series.sort((a, b) -> String.valueOf(a.get("date")).compareTo(String.valueOf(b.get("date"))));
        return series;
    }

    /**
     * Các câu hỏi bị chê gần đây. CHỈ dành cho admin và cố ý không trả về userEmail:
     * mục đích là sửa chatbot, không phải để biết ai đã hỏi gì.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> recentIssues(int days) {
        int window = Math.min(Math.max(days, 1), 365);
        LocalDateTime since = LocalDate.now().minusDays(window - 1L).atStartOfDay();
        List<ChatFeedback> issues = feedbackRepository.findRecentIssues(
                since, PageRequest.of(0, maxIssuesReturned));

        List<Map<String, Object>> result = new ArrayList<>(issues.size());
        for (ChatFeedback f : issues) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("question", f.getQuestionSnippet());
            item.put("reason", f.getReason() == null ? "NONE" : f.getReason());
            item.put("lang", f.getLang());
            item.put("createdAt", f.getCreatedAt().toString());
            result.add(item);
        }
        return result;
    }

    @Scheduled(cron = "${chat.metrics.cleanup-cron:0 45 3 * * *}")
    @Transactional
    public void purgeExpiredMetrics() {
        if (!enabled) {
            return;
        }
        int deleted = repository.deleteOlderThan(LocalDateTime.now().minusDays(retentionDays));
        if (deleted > 0) {
            log.info("[ChatMetric] Đã xóa {} số đo cũ hơn {} ngày.", deleted, retentionDays);
        }
    }

    private static String isoDate(Object year, Object month, Object day) {
        return String.format("%04d-%02d-%02d", toLong(year), toLong(month), toLong(day));
    }

    private static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    private static double toDouble(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0d;
    }
}
