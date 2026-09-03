package com.booking.api.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Khoá lại lỗ hổng lớn nhất của kênh WebSocket: trước đây danh tính người giữ ghế là trường
 * {@code userId} nằm trong thân thông điệp, do trình duyệt tự khai và máy chủ tin thẳng.
 * Bộ chặn này chuyển danh tính sang "máy chủ suy ra một lần lúc bắt tay".
 */
@ExtendWith(MockitoExtension.class)
class StompAuthChannelInterceptorTest {

    private static final String DEVICE_KEY = "sess_1700000000_fake_device";
    private static final String TOKEN = "jwt-hop-le";

    @Mock
    private JwtService jwtService;
    @Mock
    private UserDetailsService userDetailsService;

    private final MessageChannel channel = mock(MessageChannel.class);

    private StompAuthChannelInterceptor interceptor() {
        return new StompAuthChannelInterceptor(jwtService, userDetailsService);
    }

    private Message<?> connectFrame(String authHeader, String guestKey) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        if (authHeader != null) {
            accessor.setNativeHeader(StompAuthChannelInterceptor.AUTH_HEADER, authHeader);
        }
        if (guestKey != null) {
            accessor.setNativeHeader(StompAuthChannelInterceptor.GUEST_KEY_HEADER, guestKey);
        }
        return MessageBuilder.createMessage("".getBytes(StandardCharsets.UTF_8), accessor.getMessageHeaders());
    }

    private StompPrincipal principalOf(Message<?> message) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        assertNotNull(accessor);
        return (StompPrincipal) accessor.getUser();
    }

    private UserDetails enabledUser(String email) {
        UserDetails userDetails = mock(UserDetails.class);
        lenient().when(userDetails.getUsername()).thenReturn(email);
        lenient().when(userDetails.isEnabled()).thenReturn(true);
        return userDetails;
    }

    @Test
    @DisplayName("Không có token thì là phiên khách, danh tính dựng từ khoá thiết bị")
    void guestSession() {
        Message<?> result = interceptor().preSend(connectFrame(null, DEVICE_KEY), channel);

        StompPrincipal principal = principalOf(result);
        assertEquals("guest:" + DEVICE_KEY, principal.getName());
        assertEquals(DEVICE_KEY, principal.guestKey());
    }

    @Test
    @DisplayName("Token hợp lệ thì danh tính là tài khoản, hạ về chữ thường")
    void authenticatedSession() {
        UserDetails userDetails = enabledUser("Nguoi.Dung@Gmail.com");
        when(jwtService.extractUsername(TOKEN)).thenReturn("Nguoi.Dung@Gmail.com");
        when(userDetailsService.loadUserByUsername("Nguoi.Dung@Gmail.com")).thenReturn(userDetails);
        when(jwtService.isTokenValid(TOKEN, userDetails)).thenReturn(true);

        Message<?> result = interceptor().preSend(connectFrame("Bearer " + TOKEN, DEVICE_KEY), channel);

        StompPrincipal principal = principalOf(result);
        assertEquals("user:nguoi.dung@gmail.com", principal.getName());
        // Vẫn giữ khoá thiết bị để chuyển được ghế đã giữ lúc còn là khách (seat-handover).
        assertEquals(DEVICE_KEY, principal.guestKey());
    }

    @Test
    @DisplayName("Token hết hạn thì TỪ CHỐI CONNECT, không âm thầm hạ xuống phiên khách")
    void expiredTokenIsRejected() {
        // Hạ ngầm sẽ khiến người dùng tưởng đang giữ ghế dưới tài khoản của mình, tới bước
        // tạo đơn mới vỡ ra là không phải.
        when(jwtService.extractUsername(TOKEN)).thenThrow(new IllegalArgumentException("hết hạn"));

        MessageDeliveryException ex = assertThrows(MessageDeliveryException.class,
                () -> interceptor().preSend(connectFrame("Bearer " + TOKEN, DEVICE_KEY), channel));
        assertTrue(ex.getMessage().contains(StompAuthChannelInterceptor.INVALID_TOKEN_ERROR));
    }

    @Test
    @DisplayName("Tài khoản bị khoá mất quyền ngay, không đợi token hết hạn")
    void disabledAccountIsRejected() {
        UserDetails userDetails = mock(UserDetails.class);
        when(userDetails.isEnabled()).thenReturn(false);
        when(jwtService.extractUsername(TOKEN)).thenReturn("bi.khoa@gmail.com");
        when(userDetailsService.loadUserByUsername(anyString())).thenReturn(userDetails);
        when(jwtService.isTokenValid(TOKEN, userDetails)).thenReturn(true);

        assertThrows(MessageDeliveryException.class,
                () -> interceptor().preSend(connectFrame("Bearer " + TOKEN, DEVICE_KEY), channel));
    }

    @Test
    @DisplayName("Tài khoản không còn tồn tại thì cũng bị từ chối")
    void unknownAccountIsRejected() {
        when(jwtService.extractUsername(TOKEN)).thenReturn("da.xoa@gmail.com");
        when(userDetailsService.loadUserByUsername(anyString()))
                .thenThrow(new UsernameNotFoundException("không có"));

        assertThrows(MessageDeliveryException.class,
                () -> interceptor().preSend(connectFrame("Bearer " + TOKEN, DEVICE_KEY), channel));
    }

    @Test
    @DisplayName("Khoá thiết bị sai hình dạng thì máy chủ tự cấp, không dùng chuỗi client khai")
    void malformedGuestKeyIsReplaced() {
        // Nếu nhận bừa chuỗi client khai thì chỉ cần gửi khoá thiết bị bằng đúng email nạn
        // nhân là đụng được vào không gian danh tính của họ.
        Message<?> result = interceptor().preSend(connectFrame(null, "nan.nhan@gmail.com"), channel);

        StompPrincipal principal = principalOf(result);
        assertNotEquals("guest:nan.nhan@gmail.com", principal.getName());
        assertTrue(principal.getName().startsWith("guest:sess_srv_"));
    }

    @Test
    @DisplayName("Không khai khoá thiết bị thì máy chủ vẫn cấp một khoá, mỗi phiên một khác")
    void missingGuestKeyGetsServerGenerated() {
        StompAuthChannelInterceptor interceptor = interceptor();

        String first = principalOf(interceptor.preSend(connectFrame(null, null), channel)).getName();
        String second = principalOf(interceptor.preSend(connectFrame(null, null), channel)).getName();

        assertTrue(first.startsWith("guest:sess_srv_"));
        assertNotEquals(first, second);
    }

    @Test
    @DisplayName("Header Authorization không phải Bearer thì coi như không có token")
    void nonBearerAuthHeaderIsIgnored() {
        Message<?> result = interceptor().preSend(connectFrame("Basic YWRtaW46YWRtaW4=", DEVICE_KEY), channel);

        assertEquals("guest:" + DEVICE_KEY, principalOf(result).getName());
    }

    @Test
    @DisplayName("Frame không phải CONNECT thì đi qua nguyên vẹn, không đụng tới danh tính")
    void nonConnectFrameUntouched() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/app/seat-selection");
        Message<?> send = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor().preSend(send, channel);

        assertSame(send, result);
        // Danh tính đã chốt ở CONNECT; các frame sau không được phép khai lại.
        assertNull(MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class).getUser());
        verifyNoJwtWork();
    }

    private void verifyNoJwtWork() {
        org.mockito.Mockito.verify(jwtService, org.mockito.Mockito.never()).extractUsername(any());
    }
}
