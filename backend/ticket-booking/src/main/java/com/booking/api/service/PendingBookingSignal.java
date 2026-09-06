package com.booking.api.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Cho {@link BookingCleanupService} biết khi nào lượt quét là thừa, để nó khỏi chạm vào DB.
 *
 * VÌ SAO CẦN: lượt dọn chạy mỗi 60 giây và luôn bắn ít nhất một câu SELECT, kể cả lúc nửa đêm
 * không có một đơn nào. Neon tính tiền theo <b>thời gian compute thức</b> và tự ngủ sau 5 phút
 * không có truy vấn — một câu SELECT mỗi phút là vừa đủ để nó không bao giờ ngủ được. Đặt
 * {@code minimum-idle: 0} đã bỏ được 10 kết nối treo, nhưng nhịp quét này thì không cấu hình
 * nào chữa được, phải chữa ở đây.
 *
 * NGUYÊN TẮC: chỉ được phép bỏ qua lượt quét khi <b>chắc chắn</b> DB không còn đơn PENDING nào.
 * Nhầm theo hướng quét thừa thì tốn một câu truy vấn; nhầm theo hướng bỏ sót là ghế bị khoá
 * vĩnh viễn và không ai biết. Mọi đánh đổi bên dưới đều nghiêng về phía quét thừa.
 *
 * CƠ CHẾ: {@link #createdCount} tăng mỗi lần một đơn PENDING được tạo. Lượt quét nào nhìn thấy
 * DB sạch sẽ ghi lại giá trị đếm <i>tại thời điểm nó bắt đầu</i>; từ đó cổng đóng cho tới khi
 * bộ đếm nhích lên. Dùng bộ đếm chứ không dùng một cờ boolean là để bịt đúng khe hở này: một
 * đơn được tạo <i>trong lúc</i> lượt quét đang chạy sẽ làm bộ đếm khác đi, nên kết luận "DB
 * sạch" của lượt đó tự động hết hiệu lực thay vì xoá mất tín hiệu vừa tới.
 *
 * CHỈ ĐÚNG KHI CHẠY MỘT INSTANCE — trạng thái này nằm trong RAM tiến trình, đúng như
 * {@code SeatLockService} và bộ đếm ngân sách AI. Xem §10 của docs/THANH_TOAN_VNPAY.md.
 */
@Slf4j
@Component
public class PendingBookingSignal {

    /** Số đơn PENDING đã được tạo (đã commit) kể từ lúc tiến trình khởi động. */
    private final AtomicLong createdCount = new AtomicLong();

    /**
     * Giá trị {@link #createdCount} tại lúc bắt đầu lượt quét gần nhất thấy DB không còn đơn
     * PENDING nào. {@code -1} nghĩa là chưa từng quan sát được điều đó — mặc định lúc khởi động
     * là "cứ quét đã", vì RAM vừa trống không nói gì về những đơn còn nằm trong DB từ lần chạy trước.
     */
    private volatile long noPendingAtCount = -1;

    private volatile Instant lastSweepAt = Instant.EPOCH;

    /**
     * Dù cổng có đóng thì vẫn quét lại sau ngần này phút.
     *
     * Lưới an toàn cho đúng một giả định: "mọi đơn PENDING đều sinh ra từ
     * {@code BookingService.createBooking}". Hôm nay giả định đó đúng, nhưng nó là loại giả định
     * bị phá vỡ âm thầm — thêm một đường tạo đơn mà quên gọi {@link #bookingCreated()} thì đơn
     * đó không bao giờ được dọn. Có lưới này thì hậu quả tệ nhất là dọn trễ 30 phút, thay vì
     * không bao giờ dọn. Giá phải trả: compute thức khoảng 5 phút mỗi 30 phút thay vì ngủ hẳn.
     * Đặt {@code <= 0} để tắt hẳn cổng (quét mỗi phút như trước).
     */
    private final Duration safetyInterval;

    public PendingBookingSignal(
            @Value("${booking.cleanup.safety-sweep-minutes:30}") int safetySweepMinutes) {
        this.safetyInterval = safetySweepMinutes <= 0 ? Duration.ZERO : Duration.ofMinutes(safetySweepMinutes);
    }

    /**
     * Báo rằng một đơn PENDING vừa được tạo.
     *
     * Chỉ tính SAU KHI transaction commit. Tính sớm hơn thì có một khe hở thật: lượt quét chốt
     * bộ đếm, rồi truy vấn DB mà chưa thấy dòng chưa commit, kết luận "sạch" và đóng cổng — đúng
     * lúc dòng đó commit xong. Đơn ấy sẽ không bao giờ được dọn. Đổi lại, đơn nào rollback thì
     * không tính, cũng là điều đúng.
     */
    public void bookingCreated() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    createdCount.incrementAndGet();
                }
            });
        } else {
            createdCount.incrementAndGet();
        }
    }

    /** Có đáng chạy lượt quét này không, hay chắc chắn không có gì để làm. */
    public boolean shouldSweep() {
        if (safetyInterval.isZero()) {
            return true;
        }
        if (createdCount.get() != noPendingAtCount) {
            return true;
        }
        return Instant.now().isAfter(lastSweepAt.plus(safetyInterval));
    }

    /**
     * Mở một lượt quét: chốt lại bộ đếm để {@link #markNoPendingLeft(long)} biết kết luận của
     * lượt này còn hiệu lực hay đã bị một đơn mới làm cũ.
     */
    public long beginSweep() {
        lastSweepAt = Instant.now();
        return createdCount.get();
    }

    /**
     * Lượt quét mở bằng {@code token} vừa thấy DB không còn đơn PENDING nào.
     *
     * Bỏ qua nếu bộ đếm đã nhích lên: có đơn mới sinh ra trong lúc quét, kết luận đã cũ.
     * Chỉ luồng của bộ lập lịch gọi hàm này nên không cần khoá.
     */
    public void markNoPendingLeft(long token) {
        if (createdCount.get() != token) {
            return;
        }
        if (noPendingAtCount != token) {
            log.debug("Không còn đơn PENDING nào, tạm ngừng quét cho tới khi có đơn mới.");
        }
        noPendingAtCount = token;
    }
}
