package com.booking.api.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * Sổ ghi các mã câu trả lời (messageRef) mà server THỰC SỰ đã cấp cho một lượt hỏi.
 *
 * VÌ SAO CẦN: mã do client tự sinh rồi gửi kèm lượt hỏi, còn /api/chat/feedback thì permitAll.
 * Trước sổ này, bất kỳ ai cũng gửi được 30 đánh giá mỗi phút với 30 mã bịa ra, và mỗi mã lạ
 * là một dòng mới trong bảng thống kê chất lượng chatbot — thứ dùng để quyết định chatbot
 * đang yếu ở đâu. Bịa mã thì rẻ; để server cấp một mã thì phải đi qua rate limit của
 * /api/chat (khách 5 lượt/phút) và tốn một lời gọi model.
 *
 * Nằm trong bộ nhớ chứ không phải DB, và đó là đánh đổi có ý thức:
 *  - Được: không thêm bảng, không thêm lượt ghi đĩa nào cho mỗi lượt chat.
 *  - Mất: server khởi động lại là sổ trắng. Khách chấm điểm một câu trả lời cũ đọc từ bộ nhớ
 *    đệm của trình duyệt sau khi server restart sẽ bị bỏ qua trong im lặng. Với người ĐÃ
 *    ĐĂNG NHẬP thì không sao — ChatFeedbackService còn đường kiểm tra thứ hai là chính lịch
 *    sử trong DB (xem ChatHistoryService#ownsMessageRef).
 *
 * Không giữ gì quy về được một người: chỉ mã ngẫu nhiên, không email, không session id.
 */
@Component
public class ChatMessageRefRegistry {

    private final Cache<String, Boolean> issued;

    /**
     * @param ttlHours mã sống bao lâu. Đủ dài để người dùng quay lại tab cũ hôm sau vẫn chấm
     *                 điểm được, đủ ngắn để sổ không phình theo tháng.
     * @param maxSize  trần số mã giữ đồng thời; chạm trần thì Caffeine tự bỏ mã ít dùng nhất.
     *                 Có trần vẫn hơn không: sổ không giới hạn là một lỗ rò bộ nhớ chờ sẵn.
     */
    public ChatMessageRefRegistry(@Value("${chat.feedback.ref-ttl-hours:24}") int ttlHours,
                                  @Value("${chat.feedback.ref-max-entries:50000}") int maxSize) {
        this.issued = Caffeine.newBuilder()
                .expireAfterWrite(Math.max(1, ttlHours), TimeUnit.HOURS)
                .maximumSize(Math.max(1000, maxSize))
                .build();
    }

    /** Ghi nhận một mã vừa được cấp cho lượt hỏi đang chạy. */
    public void register(String messageRef) {
        if (messageRef != null && !messageRef.isBlank()) {
            issued.put(messageRef, Boolean.TRUE);
        }
    }

    /** True nếu mã này từng được cấp và chưa quá hạn. */
    public boolean wasIssued(String messageRef) {
        return messageRef != null && issued.getIfPresent(messageRef) != null;
    }
}
