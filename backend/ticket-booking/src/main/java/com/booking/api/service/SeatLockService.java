package com.booking.api.service;

import com.booking.api.realtime.SeatStatusBroadcaster;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lớp giữ ghế tạm — <b>lớp 1 trong ba lớp chống đặt trùng vé</b>.
 *
 * <pre>
 *   Lớp 1 (lớp này)  Lock tạm trong bộ nhớ, phát qua WebSocket   → chặn ở mức trải nghiệm
 *   Lớp 2            SeatRepository.findByIdWithLock (khoá bi quan) + existsByTripIdAndSeatId
 *                                                                → chặn ở mức giao dịch
 *   Lớp 3            BookingRepository.findByIdForUpdate          → chặn xác nhận trùng
 * </pre>
 *
 * <h3>Giới hạn đã biết: lock này KHÔNG sống sót qua restart và KHÔNG dùng chung giữa nhiều
 * instance</h3>
 *
 * <p>Bảng lock nằm trong {@link ConcurrentHashMap} của tiến trình. Backend restart (Render
 * gói miễn phí ngủ sau một thời gian không có request) là mất sạch; chạy hai instance thì
 * mỗi instance có một bảng riêng, và {@code enableSimpleBroker} cũng chỉ phát trong nội bộ
 * một JVM nên client nối vào instance A không bao giờ thấy sự kiện sinh ra ở instance B.
 *
 * <p><b>Vì sao vẫn chấp nhận được.</b> Vì tính đúng đắn không đặt ở lớp này. Mất toàn bộ
 * lock tạm thì hậu quả tệ nhất là hai người cùng chọn được một ghế trên giao diện, rồi một
 * trong hai bị từ chối ở bước tạo đơn — khó chịu, nhưng không có vé trùng. Bất biến thật sự
 * do lớp 2 giữ, và lớp 2 nằm dưới CSDL nên đúng với mọi số lượng instance.
 * {@code SeatDoubleBookingIntegrationTest} khoá lại đúng điều đó: vô hiệu hoá hoàn toàn lớp
 * này rồi cho hai luồng trong hai giao dịch thật cùng đặt một ghế, vẫn chỉ một đơn qua
 * được và CSDL chỉ ra đúng một vé.
 *
 * <p><b>Muốn bỏ giới hạn thì cần gì.</b> Đưa bảng lock ra kho ngoài tiến trình (Redis, hoặc
 * một bảng trong CSDL kèm cột hết hạn) <i>và</i> thay {@code SimpleBroker} bằng một broker
 * thật (RabbitMQ/Redis pub-sub) để sự kiện đi được giữa các instance. Thiếu vế thứ hai thì
 * lock có đúng nhưng giao diện vẫn không đồng bộ. Cả hai đều nằm ngoài hạn mức RAM
 * của gói Render đang dùng (backend chạy với {@code -Xmx256m}), nên đây là đánh đổi có chủ ý chứ không phải thiếu sót.
 */
@Service
@RequiredArgsConstructor
public class SeatLockService {

    private static final Logger log = LoggerFactory.getLogger(SeatLockService.class);

    private final SeatStatusBroadcaster broadcaster;

    /** seatId -> lock. Xem Javadoc lớp về giới hạn một-instance của cấu trúc này. */
    private final Map<Long, SeatLock> locks = new ConcurrentHashMap<>();

    private static final int LOCK_TIMEOUT_MINUTES = 10;

    /**
     * Trần số ghế một danh tính được giữ cùng lúc.
     *
     * <p>Không có trần thì một phiên chỉ cần gửi liên tiếp vài trăm frame là giữ sạch ghế
     * của mọi chuyến trong 10 phút — không cướp được vé của ai, nhưng đủ để không ai đặt
     * được vé nữa. {@code RateLimitingFilter} không chạm tới được vì nó là servlet filter,
     * còn các frame này đi trong một kết nối WebSocket đã mở.
     *
     * <p>Đặt 20 vì nhóm khách lớn nhất hệ thống cho đặt một lần vẫn nhỏ hơn con số này.
     */
    private static final int MAX_SEATS_PER_IDENTITY = 20;

    /**
     * Giữ ghế cho {@code identity}.
     *
     * @param identity danh tính chuẩn hoá do máy chủ suy ra ({@code user:...}/{@code guest:...}),
     *                 KHÔNG phải chuỗi client gửi lên — xem {@code StompAuthChannelInterceptor}
     * @return true nếu giữ được (hoặc gia hạn lock của chính mình)
     */
    public boolean lockSeat(Long tripId, Long seatId, String identity) {
        if (identity == null || identity.isBlank()) {
            return false;
        }
        SeatLock existingLock = locks.get(seatId);
        boolean heldByOther = existingLock != null
                && existingLock.getExpiresAt().isAfter(LocalDateTime.now())
                && !existingLock.getIdentity().equals(identity);
        if (heldByOther) {
            return false;
        }
        // Gia hạn ghế mình đang giữ thì không tính thêm vào hạn mức.
        boolean isNewSeat = existingLock == null || !existingLock.getIdentity().equals(identity);
        if (isNewSeat && heldSeatCount(identity) >= MAX_SEATS_PER_IDENTITY) {
            log.warn("Từ chối giữ ghế {}: danh tính đã chạm trần {} ghế", seatId, MAX_SEATS_PER_IDENTITY);
            return false;
        }

        locks.put(seatId, new SeatLock(seatId, tripId, identity,
                LocalDateTime.now(), LocalDateTime.now().plusMinutes(LOCK_TIMEOUT_MINUTES)));
        return true;
    }

    /** Nhả ghế. Chỉ chính chủ nhả được — đây là chỗ trước kia ai cũng nhả được ghế người khác. */
    public boolean unlockSeat(Long seatId, String identity) {
        if (identity == null || identity.isBlank()) {
            return false;
        }
        SeatLock existingLock = locks.get(seatId);
        if (existingLock != null && existingLock.getIdentity().equals(identity)) {
            locks.remove(seatId);
            return true;
        }
        return false;
    }

    /**
     * Chuyển chủ ghế từ {@code fromIdentity} sang {@code toIdentity} trong một bước.
     *
     * <p>Dùng khi khách chọn ghế lúc chưa đăng nhập rồi mới đăng nhập ở bước thanh toán:
     * danh tính đổi từ {@code guest:...} sang {@code user:...}, mà {@code BookingService} so
     * lock với danh tính tài khoản nên không chuyển thì chính họ bị báo "ghế đang được người
     * khác giữ".
     *
     * <p>Trước đây frontend tự làm việc này bằng hai lượt nhả-rồi-giữ-lại. Giữa hai lượt có
     * một khoảng vài chục mili giây ghế thực sự trống, đủ để người khác chen vào và khách
     * mất ghế dù không làm gì sai. Gộp vào một thao tác phía máy chủ thì khoảng trống đó
     * biến mất.
     *
     * @return true nếu ghế đang do {@code fromIdentity} giữ và đã chuyển xong
     */
    public boolean transferLock(Long seatId, String fromIdentity, String toIdentity) {
        if (fromIdentity == null || toIdentity == null || fromIdentity.equals(toIdentity)) {
            return false;
        }
        SeatLock transferred = locks.computeIfPresent(seatId, (id, lock) -> {
            if (!lock.getIdentity().equals(fromIdentity) || lock.getExpiresAt().isBefore(LocalDateTime.now())) {
                return lock;
            }
            return new SeatLock(lock.getSeatId(), lock.getTripId(), toIdentity,
                    lock.getLockedAt(), lock.getExpiresAt());
        });
        return transferred != null && transferred.getIdentity().equals(toIdentity);
    }

    /** Danh tính đang giữ ghế, hoặc null nếu ghế trống / lock đã hết hạn. */
    public String getLockedBy(Long seatId) {
        SeatLock existingLock = locks.get(seatId);
        if (existingLock != null && existingLock.getExpiresAt().isAfter(LocalDateTime.now())) {
            return existingLock.getIdentity();
        }
        return null;
    }

    /** Ghế có đang bị một danh tính KHÁC giữ không. */
    public boolean isHeldByOther(Long seatId, String identity) {
        String lockedBy = getLockedBy(seatId);
        return lockedBy != null && !lockedBy.equals(identity);
    }

    private long heldSeatCount(String identity) {
        LocalDateTime now = LocalDateTime.now();
        return locks.values().stream()
                .filter(lock -> lock.getIdentity().equals(identity) && lock.getExpiresAt().isAfter(now))
                .count();
    }

    @Scheduled(fixedRate = 10000) // Every 10 seconds
    public void releaseExpiredLocks() {
        LocalDateTime now = LocalDateTime.now();
        locks.entrySet().removeIf(entry -> {
            boolean expired = entry.getValue().getExpiresAt().isBefore(now);
            if (expired) {
                broadcaster.available(entry.getValue().getTripId(), entry.getValue().getSeatId());
            }
            return expired;
        });
    }

    public void removeLockBySeatId(Long seatId) {
        locks.remove(seatId);
    }

    @Data
    @AllArgsConstructor
    public static class SeatLock {
        private Long seatId;
        private Long tripId;
        /** Danh tính chuẩn hoá của chủ ghế, xem {@code SeatIdentity}. */
        private String identity;
        private LocalDateTime lockedAt;
        private LocalDateTime expiresAt;
    }
}
