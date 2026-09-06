package com.booking.api.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Cổng chặn lượt quét chỉ được phép sai theo một hướng: quét thừa. Sai theo hướng còn lại là
 * đơn PENDING nằm lại vĩnh viễn và ghế không bao giờ được trả — nên các test dưới đây đều
 * kiểm đúng chiều đó.
 */
class PendingBookingSignalTest {

    private final PendingBookingSignal signal = new PendingBookingSignal(30);

    @AfterEach
    void clearTransactionState() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("Mới khởi động thì phải quét: RAM trống không nói gì về đơn còn trong DB")
    void sweepsOnStartup() {
        assertTrue(signal.shouldSweep());
    }

    @Test
    @DisplayName("Quét xong thấy DB sạch thì ngừng quét")
    void stopsSweepingAfterCleanRun() {
        signal.markNoPendingLeft(signal.beginSweep());

        assertFalse(signal.shouldSweep());
    }

    @Test
    @DisplayName("Có đơn mới thì mở cổng lại")
    void resumesSweepingAfterNewBooking() {
        signal.markNoPendingLeft(signal.beginSweep());

        signal.bookingCreated();

        assertTrue(signal.shouldSweep());
    }

    @Test
    @DisplayName("Đơn tạo GIỮA lúc quét không bị kết luận 'DB sạch' của lượt đó xoá mất")
    void bookingCreatedDuringSweepSurvives() {
        long token = signal.beginSweep();   // lượt quét bắt đầu
        signal.bookingCreated();            // đơn mới tới khi truy vấn đã chạy xong
        signal.markNoPendingLeft(token);    // lượt quét kết luận theo dữ liệu đã cũ

        assertTrue(signal.shouldSweep(), "kết luận cũ mà đóng cổng thì đơn này không ai dọn");
    }

    @Test
    @DisplayName("Đơn chưa commit thì chưa tính, commit xong mới tính")
    void countsBookingOnlyAfterCommit() {
        signal.markNoPendingLeft(signal.beginSweep());

        TransactionSynchronizationManager.initSynchronization();
        signal.bookingCreated();
        assertFalse(signal.shouldSweep(),
                "tính sớm thì lượt quét có thể chốt xong trước khi dòng kịp hiện ra trong DB");

        TransactionSynchronizationManager.getSynchronizations()
                .forEach(TransactionSynchronization::afterCommit);

        assertTrue(signal.shouldSweep());
    }

    @Test
    @DisplayName("Đặt safety-sweep-minutes <= 0 là tắt hẳn cổng, quét như trước")
    void gateCanBeDisabled() {
        PendingBookingSignal always = new PendingBookingSignal(0);

        always.markNoPendingLeft(always.beginSweep());

        assertTrue(always.shouldSweep());
    }
}
