package com.booking.api.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Trần tần suất frame trên mỗi phiên STOMP.
 *
 * <p>Đồng hồ được tiêm vào để tua thời gian, nên các test này tất định — không có
 * {@code Thread.sleep} nào và không phụ thuộc tốc độ máy chạy CI.
 */
class StompRateLimitChannelInterceptorTest {

    private static final String SESSION = "phien-1";
    private static final double FPS = 10;
    private static final double BURST = 40;
    private static final int MAX_VIOLATIONS = 20;
    private static final long MOT_GIAY = 1_000_000_000L;

    private final MessageChannel channel = mock(MessageChannel.class);
    private final AtomicLong dongHo = new AtomicLong(0);

    private StompRateLimitChannelInterceptor interceptor() {
        return new StompRateLimitChannelInterceptor(FPS, BURST, MAX_VIOLATIONS, dongHo::get);
    }

    private Message<?> frame(StompCommand command, String sessionId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setLeaveMutable(true);
        accessor.setSessionId(sessionId);
        if (command == StompCommand.SEND || command == StompCommand.SUBSCRIBE) {
            accessor.setDestination("/app/seat-selection");
        }
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<?> send() {
        return frame(StompCommand.SEND, SESSION);
    }

    /** @return số frame đi qua được */
    private int guiNhieuFrame(StompRateLimitChannelInterceptor interceptor, int soLuong) {
        int quaDuoc = 0;
        for (int i = 0; i < soLuong; i++) {
            if (interceptor.preSend(send(), channel) != null) {
                quaDuoc++;
            }
        }
        return quaDuoc;
    }

    @Test
    @DisplayName("Cụm frame trong hạn burst đi qua hết — chọn nhóm ghế không bị chặn nhầm")
    void burstWithinCapacityPasses() {
        // Chọn 20 ghế một lúc = 20 frame gửi liền nhau trong vài mili giây. Đây là thao
        // tác bình thường của giao diện, không được coi là tấn công.
        assertEquals(20, guiNhieuFrame(interceptor(), 20));
    }

    @Test
    @DisplayName("Vượt trần thì frame bị BỎ, kết nối vẫn sống")
    void framesBeyondCapacityAreDropped() {
        StompRateLimitChannelInterceptor interceptor = interceptor();

        // Đồng hồ đứng yên -> không nạp lại token nào, chỉ có đúng BURST lượt.
        assertEquals((int) BURST, guiNhieuFrame(interceptor, (int) BURST + 10));

        // Bỏ frame chứ không ném lỗi: client thật chạm trần vì mạng chập chờn thì việc giữ
        // ghế lỗi có kiểm soát (frontend hết 8s báo "hết thời gian chờ"), thay vì mất luôn
        // cả sơ đồ ghế đang xem.
        assertNull(interceptor.preSend(send(), channel));
    }

    @Test
    @DisplayName("Gáo tự đầy lại theo thời gian, đúng tốc độ đã cấu hình")
    void bucketRefillsOverTime() {
        StompRateLimitChannelInterceptor interceptor = interceptor();
        guiNhieuFrame(interceptor, (int) BURST);
        assertNull(interceptor.preSend(send(), channel), "gáo phải đang cạn");

        dongHo.addAndGet(MOT_GIAY);

        // 1 giây ở 10 frame/giây = đúng 10 lượt nữa.
        assertEquals(10, guiNhieuFrame(interceptor, 15));
    }

    @Test
    @DisplayName("Gáo không tích luỹ quá hạn burst dù để lâu bao nhiêu")
    void refillIsCappedAtBurst() {
        StompRateLimitChannelInterceptor interceptor = interceptor();
        guiNhieuFrame(interceptor, (int) BURST);

        // Để yên một giờ: nếu không chặn trần thì gáo tích được 36.000 token, và phiên đó
        // được phép bơm một cụm khổng lồ — đúng thứ mà giới hạn này sinh ra để chặn.
        dongHo.addAndGet(3600 * MOT_GIAY);

        assertEquals((int) BURST, guiNhieuFrame(interceptor, (int) BURST + 5));
    }

    @Test
    @DisplayName("Vượt trần liên tục quá ngưỡng thì ngắt hẳn phiên")
    void persistentAbuseKillsTheSession() {
        StompRateLimitChannelInterceptor interceptor = interceptor();
        guiNhieuFrame(interceptor, (int) BURST);

        // Bỏ frame là đủ cho một client lỡ nhịp. Nhưng bơm liên tục sau khi đã cạn gáo thì
        // không còn là giao diện nữa.
        guiNhieuFrame(interceptor, MAX_VIOLATIONS);

        MessageDeliveryException ex = assertThrows(MessageDeliveryException.class,
                () -> interceptor.preSend(send(), channel));
        assertTrue(ex.getMessage().contains(StompRateLimitChannelInterceptor.RATE_LIMIT_ERROR));
    }

    @Test
    @DisplayName("Chuỗi vi phạm khép lại khi phiên trở về nhịp bình thường")
    void violationStreakResetsAfterRecovery() {
        StompRateLimitChannelInterceptor interceptor = interceptor();

        // Chạm trần rồi hồi, lặp lại nhiều lần — tổng số lần chạm trần vượt xa MAX_VIOLATIONS.
        for (int lan = 0; lan < 5; lan++) {
            guiNhieuFrame(interceptor, (int) BURST + MAX_VIOLATIONS / 2);
            dongHo.addAndGet(3600 * MOT_GIAY);
        }

        // Vẫn không bị ngắt: một phiên mở cả buổi mà thỉnh thoảng chạm trần vì mạng chập
        // chờn không được cộng dồn thành án ngắt kết nối. Chỉ chuỗi LIÊN TIẾP mới tính.
        assertNotNull(interceptor.preSend(send(), channel));
    }

    @Test
    @DisplayName("Mỗi phiên một gáo riêng — phiên bị chặn không kéo theo phiên khác")
    void bucketsArePerSession() {
        StompRateLimitChannelInterceptor interceptor = interceptor();
        guiNhieuFrame(interceptor, (int) BURST);
        assertNull(interceptor.preSend(send(), channel));

        assertNotNull(interceptor.preSend(frame(StompCommand.SEND, "phien-2"), channel));
    }

    @Test
    @DisplayName("CONNECT và DISCONNECT không tính vào trần")
    void handshakeFramesAreNotCounted() {
        StompRateLimitChannelInterceptor interceptor = interceptor();

        for (int i = 0; i < 100; i++) {
            assertNotNull(interceptor.preSend(frame(StompCommand.CONNECT, SESSION), channel));
            assertNotNull(interceptor.preSend(frame(StompCommand.DISCONNECT, SESSION), channel));
        }
        // Không frame bắt tay nào tiêu token, nên gáo vẫn đầy.
        assertEquals(0, interceptor.trackedSessionCount());
        assertEquals((int) BURST, guiNhieuFrame(interceptor, (int) BURST + 5));
    }

    @Test
    @DisplayName("Gáo được dọn khi phiên đóng, kể cả khi đóng đột ngột")
    void bucketIsReleasedOnDisconnect() {
        StompRateLimitChannelInterceptor interceptor = interceptor();
        interceptor.preSend(send(), channel);
        assertEquals(1, interceptor.trackedSessionCount());

        // Đóng đột ngột (rút mạng, proxy cắt) không có frame DISCONNECT nào, nhưng Spring
        // vẫn phát sự kiện này — nếu không dọn ở đây thì bảng gáo rò rỉ theo từng kết nối.
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        accessor.setSessionId(SESSION);
        interceptor.onSessionDisconnect(new SessionDisconnectEvent(
                this, MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders()),
                SESSION, org.springframework.web.socket.CloseStatus.NORMAL));

        assertEquals(0, interceptor.trackedSessionCount());
    }

    @Test
    @DisplayName("Frame không có sessionId thì đi qua, không dựng gáo rác")
    void framesWithoutSessionIdPassThrough() {
        StompRateLimitChannelInterceptor interceptor = interceptor();

        assertNotNull(interceptor.preSend(frame(StompCommand.SEND, null), channel));
        assertEquals(0, interceptor.trackedSessionCount());
    }
}
