package com.booking.api.ai.llm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Circuit breaker theo từng nhà cung cấp, ba trạng thái.
 *
 * <pre>
 *   CLOSED    -- đủ N lỗi liên tiếp -->  OPEN
 *   OPEN      -- hết thời gian tạm loại -->  HALF_OPEN
 *   HALF_OPEN -- thăm dò thành công -->  CLOSED
 *   HALF_OPEN -- thăm dò thất bại ---->  OPEN   (mở lại NGAY, không cần đủ N lỗi)
 * </pre>
 *
 * Thời gian tạm loại NHÂN ĐÔI sau mỗi vòng mở mạch liên tiếp (60s, 120s, 240s... tới
 * trần), và về lại mốc đầu ngay khi có một lần thành công. Với nhà cung cấp chết hẳn
 * trong nhiều giờ, thời gian cố định nghĩa là cứ 60 giây lại đốt một request thăm dò
 * vô ích; nhân đôi dần thì số phép thử trong 2 tiếng giảm từ ~120 xuống ~10.
 *
 * HALF_OPEN cho đi ĐÚNG MỘT request thăm dò tại một thời điểm; mọi request khác vẫn bị
 * đẩy sang nhà dự phòng cho tới khi biết kết quả. Nhờ vậy khi nhà chính vẫn đang chết,
 * chỉ một người dùng chịu độ trễ thăm dò thay vì cả một đợt.
 *
 * Bản đầu tiên không có HALF_OPEN: hết hạn mở mạch là mở cửa cho TOÀN BỘ traffic quay
 * lại nhà chính cùng lúc, và vì bộ đếm lỗi bị xoá về 0 nên phải mất đủ N lượt lỗi nữa
 * mới đóng lại được — cứ mỗi 60 giây lại có một đợt request bị chậm.
 *
 * Ba trạng thái này được suy ra từ hai mốc thời gian chứ không lưu thành biến riêng:
 * một biến trạng thái tường minh sẽ cần ai đó đánh thức nó khi hết hạn, mà ở đây không
 * có luồng nền nào cả — mọi chuyển trạng thái đều xảy ra lười, ngay trong request.
 *
 * Trạng thái nằm trong bộ nhớ tiến trình: mất khi restart, không chia sẻ giữa nhiều
 * instance. Đúng với kiến trúc một container hiện tại.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProviderCircuitBreaker {

    public enum State {
        /** Bình thường, mọi request đi thẳng tới nhà cung cấp. */
        CLOSED,
        /** Đang bị tạm loại, không request nào được đi qua. */
        OPEN,
        /** Hết hạn tạm loại, đang chờ/đang chạy một request thăm dò. */
        HALF_OPEN
    }

    private final LlmProperties properties;

    private final Map<String, Circuit> circuits = new ConcurrentHashMap<>();

    /** Trạng thái một nhà cung cấp. Mọi truy cập đều nằm trong synchronized(circuit). */
    private static final class Circuit {
        int consecutiveFailures;
        /** Số vòng mở mạch liên tiếp chưa xen một lần thành công nào. Dùng để nhân đôi backoff. */
        int openCycles;
        /** Khác null khi mạch đã từng mở và chưa đóng lại; hết hạn nghĩa là HALF_OPEN. */
        Instant openUntil;
        /** Khác null khi đang có một request thăm dò được cấp phép. */
        Instant probeDeadline;
    }

    private Circuit circuitOf(String providerName) {
        return circuits.computeIfAbsent(providerName, k -> new Circuit());
    }

    /**
     * Xin phép gọi một nhà cung cấp. Trả về false nghĩa là bỏ qua nhà này.
     *
     * CÓ tác dụng phụ: ở trạng thái HALF_OPEN, lời gọi đầu tiên giành được suất thăm dò
     * và trả về true, những lời gọi song song sau đó nhận false cho tới khi có kết quả.
     * Vì vậy mỗi lượt thử phải kết thúc bằng đúng một recordSuccess/recordFailure.
     */
    public boolean tryAcquire(String providerName) {
        Circuit c = circuitOf(providerName);
        Instant now = Instant.now();

        synchronized (c) {
            if (c.openUntil != null && now.isBefore(c.openUntil)) {
                return false;
            }
            boolean halfOpen = c.openUntil != null || c.probeDeadline != null;
            if (!halfOpen) {
                return true;
            }
            if (c.probeDeadline != null && now.isBefore(c.probeDeadline)) {
                // Đã có người khác đang thăm dò — đừng ném thêm request vào nhà đang ốm.
                return false;
            }
            c.openUntil = null;
            c.probeDeadline = now.plusSeconds(properties.getCircuitBreaker().getProbeTimeoutSeconds());
            log.info("[LlmCircuit] {} chuyển sang HALF_OPEN — cho đi một request thăm dò.", providerName);
            return true;
        }
    }

    public void recordSuccess(String providerName) {
        Circuit c = circuitOf(providerName);
        synchronized (c) {
            if (c.probeDeadline != null) {
                log.info("[LlmCircuit] {} thăm dò thành công — đóng mạch, đưa trở lại vòng chọn.", providerName);
            }
            c.consecutiveFailures = 0;
            c.openCycles = 0;
            c.openUntil = null;
            c.probeDeadline = null;
        }
    }

    /** Ghi nhận lỗi. Trả về true nếu lần lỗi này làm mạch bị mở. */
    public boolean recordFailure(String providerName) {
        Circuit c = circuitOf(providerName);
        int threshold = properties.getCircuitBreaker().getFailureThreshold();

        synchronized (c) {
            if (c.probeDeadline != null) {
                // Thăm dò hỏng: đã biết chắc nhà này còn ốm, mở lại mạch ngay thay vì
                // bắt threshold-1 người dùng nữa phải chờ mới đi tới cùng kết luận.
                c.probeDeadline = null;
                c.consecutiveFailures = threshold;
                long seconds = openCircuit(c);
                log.warn("[LlmCircuit] {} thăm dò thất bại (vòng {}) — mở lại mạch {} giây.",
                        providerName, c.openCycles, seconds);
                return true;
            }
            c.consecutiveFailures++;
            if (c.consecutiveFailures >= threshold) {
                long seconds = openCircuit(c);
                log.warn("[LlmCircuit] {} lỗi {} lần liên tiếp — tạm loại {} giây (vòng {}).",
                        providerName, c.consecutiveFailures, seconds, c.openCycles);
                return true;
            }
            return false;
        }
    }

    /** Chuyển mạch sang OPEN với thời gian của vòng kế tiếp. Gọi trong synchronized(c). */
    private long openCircuit(Circuit c) {
        c.openCycles++;
        long seconds = openSecondsForCycle(c.openCycles);
        c.openUntil = Instant.now().plusSeconds(seconds);
        return seconds;
    }

    /**
     * Thời gian tạm loại cho vòng mở mạch thứ {@code cycle} (đếm từ 1): gấp đôi mỗi
     * vòng, chặn ở maxOpenSeconds. Dịch bit thay vì Math.pow, và giới hạn số dịch để
     * một nhà cung cấp chết cả tuần không làm tràn số.
     */
    long openSecondsForCycle(int cycle) {
        LlmProperties.CircuitBreaker cfg = properties.getCircuitBreaker();
        int shift = Math.min(Math.max(cycle - 1, 0), 20);
        return Math.min(cfg.getOpenSeconds() << shift, cfg.getMaxOpenSeconds());
    }

    /** Trạng thái hiện tại, không có tác dụng phụ. Dùng cho test và endpoint chẩn đoán. */
    public State stateOf(String providerName) {
        Circuit c = circuits.get(providerName);
        if (c == null) {
            return State.CLOSED;
        }
        Instant now = Instant.now();
        synchronized (c) {
            if (c.openUntil != null && now.isBefore(c.openUntil)) {
                return State.OPEN;
            }
            return (c.openUntil != null || c.probeDeadline != null) ? State.HALF_OPEN : State.CLOSED;
        }
    }

    /** Số giây còn lại tới khi nhà cung cấp được thử lại; 0 nếu đang không bị tạm loại. */
    public long secondsUntilRetry(String providerName) {
        Circuit c = circuits.get(providerName);
        if (c == null) {
            return 0;
        }
        Instant now = Instant.now();
        synchronized (c) {
            if (c.openUntil == null || !now.isBefore(c.openUntil)) {
                return 0;
            }
            // Làm tròn lên: còn 59,4 giây thì trả 60, đọc log mới khớp với con số đã ghi.
            return (Duration.between(now, c.openUntil).toMillis() + 999) / 1000;
        }
    }

    /** true khi nhà cung cấp đang bị tạm loại hoàn toàn (HALF_OPEN vẫn cho đi một request). */
    public boolean isOpen(String providerName) {
        return stateOf(providerName) == State.OPEN;
    }

    /** Ảnh chụp trạng thái mọi nhà cung cấp đã từng lỗi. Dùng cho log và chẩn đoán. */
    public Map<String, State> snapshot() {
        Map<String, State> result = new LinkedHashMap<>();
        circuits.keySet().forEach(name -> result.put(name, stateOf(name)));
        return result;
    }

    /** Dùng cho test và cho endpoint chẩn đoán. */
    public void reset() {
        circuits.clear();
    }
}
