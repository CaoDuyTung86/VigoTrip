package com.booking.api.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Giới hạn tần suất frame trên mỗi phiên STOMP.
 *
 * <h3>Vì sao {@link RateLimitingFilter} không đỡ được chỗ này</h3>
 *
 * <p>Nó là một servlet filter: chỉ chạy trên request HTTP. WebSocket bắt tay bằng HTTP đúng
 * <b>một lần</b>, sau đó mọi frame đi trong kết nối đã mở và không sinh request nào nữa. Nên
 * một phiên đã nối được có thể bơm frame với tốc độ tuỳ thích mà bộ đếm HTTP không hề nhúc
 * nhích — mỗi frame vẫn khiến máy chủ giải mã, tra bảng lock và phát tin cho cả phòng.
 *
 * <p>Trần {@code MAX_SEATS_PER_IDENTITY} trong {@code SeatLockService} là chốt chặn <i>hệ
 * quả</i>: nó chặn việc giữ sạch ghế. Nó không chặn được <i>chi phí</i>: gửi 10.000
 * frame/giây vào ghế người khác đang giữ thì lần nào cũng bị từ chối, không giữ thêm ghế
 * nào, nhưng máy chủ vẫn phải xử lý đủ 10.000 lượt. Lớp này chặn đúng phần đó.
 *
 * <h3>Cơ chế: gáo token cho mỗi phiên</h3>
 *
 * <p>Mỗi phiên có một gáo chứa tối đa {@code burst} token, tự đầy lại {@code framesPerSecond}
 * token mỗi giây. Mỗi frame tiêu một token; hết token thì frame bị bỏ.
 *
 * <p>Cần cả hai tham số vì giao diện thật hoạt động theo cụm: chọn 10 ghế một lúc là 10
 * frame gửi liền nhau trong vài mili giây. Chỉ giới hạn tốc độ trung bình sẽ chặn nhầm
 * nhịp bấm bình thường; chỉ cho phép bùng nổ mà không giới hạn tốc độ thì không chặn được
 * gì. Gáo token cho phép cụm ngắn nhưng khống chế tốc độ về lâu dài.
 *
 * <p><b>Bỏ frame thay vì ngắt kết nối.</b> Client thật vẫn có thể chạm trần trong tình huống
 * lạ (mạng chập chờn khiến thư viện gửi lại). Bỏ frame thì việc giữ ghế lỗi có kiểm soát —
 * {@code lockSeats} ở frontend hết 8 giây sẽ báo "hết thời gian chờ" và người dùng bấm lại.
 * Ngắt kết nối sẽ cuốn theo cả sơ đồ ghế đang xem.
 *
 * <p>Nhưng vượt trần <b>liên tiếp</b> thì không còn là giao diện nữa. Quá
 * {@code maxViolations} lần liên tiếp, phiên đó bị ngắt hẳn. Bộ đếm về 0 ngay khi có một
 * frame đi qua được: một phiên mở cả buổi mà thỉnh thoảng chạm trần vì mạng chập chờn thì
 * không được cộng dồn thành án ngắt kết nối.
 *
 * <p>Đếm theo <b>phiên</b>, không theo danh tính: đây là chốt bảo vệ tài nguyên máy chủ, mà
 * chi phí thì phát sinh theo kết nối. Một kẻ tấn công mở nhiều kết nối cùng lúc là bài toán
 * khác (giới hạn số kết nối đồng thời), không thuộc phạm vi lớp này.
 */
@Component
public class StompRateLimitChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompRateLimitChannelInterceptor.class);

    public static final String RATE_LIMIT_ERROR = "WS_RATE_LIMIT_EXCEEDED";

    private static final long NANOS_PER_SECOND = 1_000_000_000L;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    private final double framesPerSecond;
    private final double burst;
    private final int maxViolations;

    /** Tách ra để test tua thời gian được mà không phải ngủ thật. */
    private final LongSupplier nanoTime;

    /**
     * {@code @Autowired} là bắt buộc, không phải trang trí: lớp có hai constructor nên Spring
     * không tự chọn được cái nào và sẽ đi tìm constructor rỗng, làm hỏng toàn bộ application
     * context. Test đơn vị không bắt được vì chúng gọi thẳng constructor bên dưới.
     */
    @Autowired
    public StompRateLimitChannelInterceptor(
            @Value("${app.websocket.rate-limit.frames-per-second}") double framesPerSecond,
            @Value("${app.websocket.rate-limit.burst}") double burst,
            @Value("${app.websocket.rate-limit.max-violations}") int maxViolations) {
        this(framesPerSecond, burst, maxViolations, System::nanoTime);
    }

    /** Chỉ dùng trong test: cho phép tiêm đồng hồ để tua thời gian. */
    StompRateLimitChannelInterceptor(double framesPerSecond, double burst, int maxViolations, LongSupplier nanoTime) {
        this.framesPerSecond = framesPerSecond;
        this.burst = burst;
        this.maxViolations = maxViolations;
        this.nanoTime = nanoTime;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !isCounted(accessor.getCommand())) {
            return message;
        }

        String sessionId = accessor.getSessionId();
        if (sessionId == null) {
            return message;
        }

        Bucket bucket = buckets.computeIfAbsent(sessionId, id -> new Bucket(burst, nanoTime.getAsLong()));
        if (bucket.tryConsume(nanoTime.getAsLong(), framesPerSecond, burst)) {
            return message;
        }

        int violations = bucket.recordViolation();
        if (violations > maxViolations) {
            log.warn("Ngắt phiên STOMP {}: vượt trần tần suất {} lần", sessionId, violations);
            buckets.remove(sessionId);
            throw new MessageDeliveryException(message, RATE_LIMIT_ERROR);
        }

        log.debug("Bỏ frame {} của phiên {}: vượt trần tần suất (lần {})",
                accessor.getCommand(), sessionId, violations);
        // Trả null = frame không đi tiếp. Kết nối vẫn sống.
        return null;
    }

    /**
     * CONNECT và DISCONNECT không tính: CONNECT đã được
     * {@link StompAuthChannelInterceptor} và giới hạn origin canh, còn chặn DISCONNECT chỉ
     * làm rò rỉ phiên chứ chẳng bảo vệ được gì.
     */
    private boolean isCounted(StompCommand command) {
        return command == StompCommand.SEND || command == StompCommand.SUBSCRIBE;
    }

    /** Dọn gáo khi phiên đóng, kể cả khi đóng đột ngột không có frame DISCONNECT. */
    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        buckets.remove(event.getSessionId());
    }

    /** Số phiên đang được theo dõi — dùng để khoá lại việc dọn dẹp trong test. */
    int trackedSessionCount() {
        return buckets.size();
    }

    /**
     * Gáo token của một phiên.
     *
     * <p>Không lưu mốc nạp lại theo lịch mà tính bù theo thời gian trôi qua kể từ lần chạm
     * trước — không cần luồng nền nào đi nạp cho hàng nghìn phiên.
     */
    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;
        private int violations;

        Bucket(double initialTokens, long nowNanos) {
            this.tokens = initialTokens;
            this.lastRefillNanos = nowNanos;
        }

        synchronized boolean tryConsume(long nowNanos, double refillPerSecond, double capacity) {
            double elapsedSeconds = (double) (nowNanos - lastRefillNanos) / NANOS_PER_SECOND;
            if (elapsedSeconds > 0) {
                tokens = Math.min(capacity, tokens + elapsedSeconds * refillPerSecond);
                lastRefillNanos = nowNanos;
            }
            if (tokens < 1.0) {
                return false;
            }
            tokens -= 1.0;
            // Gáo hồi lại được nghĩa là phiên đã trở về nhịp bình thường; chuỗi vi phạm
            // trước đó khép lại tại đây.
            violations = 0;
            return true;
        }

        synchronized int recordViolation() {
            return ++violations;
        }
    }
}
