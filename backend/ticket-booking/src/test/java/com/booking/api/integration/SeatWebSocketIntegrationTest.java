package com.booking.api.integration;

import com.booking.api.entity.User;
import com.booking.api.realtime.SeatTopic;
import com.booking.api.repository.UserRepository;
import com.booking.api.security.JwtService;
import com.booking.api.service.SeatLockService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.lang.NonNull;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kiểm thử đầu-cuối tầng WebSocket giữ ghế, chạy trên một máy chủ thật ở cổng ngẫu nhiên.
 *
 * <p>Các test đơn vị đã khoá từng mảnh (bộ chặn xác thực, controller, dịch vụ lock), nhưng
 * hai thứ chỉ đúng hay sai khi chạy thật mới biết: quy ước đích {@code /user/queue/**} của
 * Spring có nhận đúng danh tính có dấu hai chấm ({@code user:a@b.com}) hay không, và frame
 * CONNECT mang JWT có thực sự đi qua được toàn bộ chuỗi bộ chặn hay không. Sai một trong hai
 * thì phản hồi giữ ghế không bao giờ về tới trình duyệt — người dùng thấy "hết thời gian
 * chờ" trong khi log máy chủ sạch bong.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class SeatWebSocketIntegrationTest {

    private static final Long TRIP_ID = 4242L;
    private static final Long SEAT_ID = 909L;
    private static final String DEVICE_KEY = "sess_1700000000_ws_test";
    private static final int TIMEOUT_SECONDS = 10;

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserDetailsService userDetailsService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SeatLockService seatLockService;

    private WebSocketStompClient stompClient;
    private User nguoiDung;

    @BeforeEach
    void setUp() {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        nguoiDung = new User();
        nguoiDung.setEmail("ws.test@example.com");
        nguoiDung.setFullName("WS Test");
        nguoiDung.setPassword("password123");
        nguoiDung.setRole("ROLE_USER");
        nguoiDung.setPoints(0);
        // Bắt buộc: CustomUserDetailsService map cột này sang UserDetails.isEnabled(),
        // và bộ chặn từ chối CONNECT của tài khoản bị khoá y như JwtAuthFilter làm với REST.
        nguoiDung.setEnabled(true);
        nguoiDung = userRepository.save(nguoiDung);
    }

    @AfterEach
    void tearDown() {
        seatLockService.removeLockBySeatId(SEAT_ID);
        userRepository.delete(nguoiDung);
        stompClient.stop();
    }

    private String jwtCuaNguoiDung() {
        UserDetails userDetails = userDetailsService.loadUserByUsername(nguoiDung.getEmail());
        return jwtService.generateToken(userDetails);
    }

    /** Nối STOMP với header y hệt frontend gửi. */
    private StompSession connect(String jwt, String guestKey) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        if (jwt != null) {
            connectHeaders.add("Authorization", "Bearer " + jwt);
        }
        if (guestKey != null) {
            connectHeaders.add("X-Guest-Key", guestKey);
        }
        return stompClient.connectAsync("ws://localhost:" + port + "/ws/websocket",
                        new org.springframework.web.socket.WebSocketHttpHeaders(),
                        connectHeaders,
                        new StompSessionHandlerAdapter() {})
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    /** Hàng đợi nhận thông điệp của một đích, để test chờ đồng bộ. */
    private BlockingQueue<Map<String, Object>> subscribe(StompSession session, String destination) {
        BlockingQueue<Map<String, Object>> received = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            @NonNull
            public Type getPayloadType(@NonNull StompHeaders headers) {
                return Map.class;
            }

            @Override
            public void handleFrame(@NonNull StompHeaders headers, Object payload) {
                @SuppressWarnings("unchecked")
                Map<String, Object> body = (Map<String, Object>) payload;
                received.add(body);
            }
        });
        return received;
    }

    private Map<String, Object> nhan(BlockingQueue<Map<String, Object>> queue) throws InterruptedException {
        Map<String, Object> message = queue.poll(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        assertNotNull(message, "không nhận được thông điệp nào trong " + TIMEOUT_SECONDS + "s");
        return message;
    }

    /**
     * Đích riêng của phiên nhìn từ phía client: máy chủ gọi
     * {@code convertAndSendToUser(danhTinh, "/queue/...")}, còn trình duyệt đăng ký
     * {@code "/user/queue/..."} và Spring tự nối hai đầu theo phiên.
     */
    private static String userQueue(String serverDestination) {
        return "/user" + serverDestination;
    }

    private Map<String, Object> lenhChonGhe(String status) {
        return Map.of("tripId", TRIP_ID, "seatId", SEAT_ID, "status", status);
    }

    @Test
    @DisplayName("Đích /user/queue/** tới đúng phiên, kể cả khi danh tính có dấu hai chấm")
    void whoami_ReachesTheRequestingSession() throws Exception {
        StompSession session = connect(jwtCuaNguoiDung(), DEVICE_KEY);

        BlockingQueue<Map<String, Object>> identity = subscribe(session, userQueue(SeatTopic.USER_IDENTITY_QUEUE));
        session.send("/app/whoami", Map.of());

        Map<String, Object> message = nhan(identity);
        assertNotNull(message.get("ownerToken"));
        assertEquals(true, message.get("authenticated"));
        // Mã ẩn danh, không phải email: đây là thứ thay cho userId trong mọi thông điệp phát ra.
        assertFalse(message.get("ownerToken").toString().contains("@"));

        session.disconnect();
    }

    @Test
    @DisplayName("Khách chưa đăng nhập vẫn nối được và giữ được ghế")
    void guestSession_CanConnectAndLock() throws Exception {
        StompSession session = connect(null, DEVICE_KEY);

        BlockingQueue<Map<String, Object>> identity = subscribe(session, userQueue(SeatTopic.USER_IDENTITY_QUEUE));
        session.send("/app/whoami", Map.of());
        assertEquals(false, nhan(identity).get("authenticated"));

        BlockingQueue<Map<String, Object>> tripFeed = subscribe(session, SeatTopic.forTrip(TRIP_ID));
        session.send("/app/seat-selection", lenhChonGhe("SELECTED"));

        Map<String, Object> update = nhan(tripFeed);
        assertEquals("SELECTED", update.get("status"));
        assertEquals(SEAT_ID.intValue(), update.get("seatId"));
        assertEquals("guest:" + DEVICE_KEY, seatLockService.getLockedBy(SEAT_ID));

        session.disconnect();
    }

    @Test
    @DisplayName("Token hỏng thì CONNECT bị từ chối, không âm thầm hạ xuống phiên khách")
    void invalidToken_ConnectIsRejected() {
        ExecutionException ex = assertThrows(ExecutionException.class,
                () -> connect("token.khong.hop.le", DEVICE_KEY));
        assertNotNull(ex.getCause());
    }

    @Test
    @DisplayName("LỖ HỔNG CŨ: phiên khác không nhả được ghế mình đang giữ")
    void otherSessionCannotReleaseMySeat() throws Exception {
        StompSession chinhChu = connect(jwtCuaNguoiDung(), DEVICE_KEY);
        BlockingQueue<Map<String, Object>> feedChinhChu = subscribe(chinhChu, SeatTopic.forTrip(TRIP_ID));
        chinhChu.send("/app/seat-selection", lenhChonGhe("SELECTED"));

        Map<String, Object> giuGhe = nhan(feedChinhChu);
        assertEquals("SELECTED", giuGhe.get("status"));
        String ownerToken = giuGhe.get("ownerToken").toString();

        // Kẻ tấn công: một phiên khách khác. Bản cũ chỉ cần kèm "userId": "<email nạn nhân>"
        // trong thân thông điệp là nhả được ghế; giờ thân thông điệp không còn trường đó, và
        // máy chủ chỉ nhìn danh tính của phiên.
        StompSession keTanCong = connect(null, "sess_1700000000_ke_tan_cong");
        BlockingQueue<Map<String, Object>> feedKeTanCong = subscribe(keTanCong, SeatTopic.forTrip(TRIP_ID));
        BlockingQueue<Map<String, Object>> queueKeTanCong = subscribe(keTanCong, userQueue(SeatTopic.USER_SEAT_QUEUE));

        keTanCong.send("/app/seat-selection", lenhChonGhe("AVAILABLE"));
        keTanCong.send("/app/seat-selection", lenhChonGhe("SELECTED"));

        // Nhả hụt thì im lặng; giữ hụt thì báo riêng cho kẻ gửi.
        assertEquals("LOCK_FAILED", nhan(queueKeTanCong).get("status"));
        assertTrue(feedKeTanCong.isEmpty(), "không được phát thay đổi nào cho cả phòng");
        assertEquals("user:" + nguoiDung.getEmail(), seatLockService.getLockedBy(SEAT_ID));

        // Chính chủ vẫn nhả được ghế của mình.
        chinhChu.send("/app/seat-selection", lenhChonGhe("AVAILABLE"));
        Map<String, Object> nhaGhe = nhan(feedChinhChu);
        assertEquals("AVAILABLE", nhaGhe.get("status"));
        assertNull(nhaGhe.get("ownerToken"));
        assertNull(seatLockService.getLockedBy(SEAT_ID));
        assertNotNull(ownerToken);

        chinhChu.disconnect();
        keTanCong.disconnect();
    }

    @Test
    @DisplayName("Nhận lại ghế đã giữ lúc chưa đăng nhập, trong một thao tác")
    void handover_ClaimsGuestSeatsAfterLogin() throws Exception {
        StompSession phienKhach = connect(null, DEVICE_KEY);
        BlockingQueue<Map<String, Object>> feedKhach = subscribe(phienKhach, SeatTopic.forTrip(TRIP_ID));
        phienKhach.send("/app/seat-selection", lenhChonGhe("SELECTED"));
        assertEquals("SELECTED", nhan(feedKhach).get("status"));
        phienKhach.disconnect();

        // Đăng nhập xong: frontend nối lại kèm JWT, vẫn khai đúng khoá thiết bị cũ.
        StompSession phienDaDangNhap = connect(jwtCuaNguoiDung(), DEVICE_KEY);
        BlockingQueue<Map<String, Object>> feed = subscribe(phienDaDangNhap, SeatTopic.forTrip(TRIP_ID));
        phienDaDangNhap.send("/app/seat-handover", Map.of("tripId", TRIP_ID, "seatIds", List.of(SEAT_ID)));

        assertEquals("SELECTED", nhan(feed).get("status"));
        assertEquals("user:" + nguoiDung.getEmail(), seatLockService.getLockedBy(SEAT_ID));

        phienDaDangNhap.disconnect();
    }
}
