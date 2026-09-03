package com.booking.api.security;

import com.booking.api.realtime.SeatIdentity;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Xác thực phiên WebSocket ngay tại frame CONNECT.
 *
 * <p><b>Lỗ hổng được vá.</b> Kênh STOMP trước đây hoàn toàn không xác thực: danh tính người
 * giữ ghế là trường {@code userId} nằm trong thân thông điệp, do trình duyệt tự khai. Ai
 * cũng gửi được {@code {"seatId":42,"status":"AVAILABLE","userId":"nan.nhan@gmail.com"}} để
 * nhả ghế người khác đang giữ, hay giữ nguyên một chuyến dưới hàng loạt danh tính bịa ra.
 * Bộ lọc {@code RateLimitingFilter} không đỡ được vì nó là servlet filter, chỉ chạy trên
 * HTTP thường chứ không thấy các frame STOMP đi trong một kết nối đã mở.
 *
 * <p><b>Cách vá.</b> Danh tính chuyển từ "client khai" sang "máy chủ suy ra một lần lúc bắt
 * tay", đúng mô hình mà {@link JwtAuthFilter} đang áp dụng cho REST:
 * <ul>
 *   <li>Có header {@code Authorization: Bearer <jwt>} hợp lệ → {@code user:<email>}.</li>
 *   <li>Token sai/hết hạn/tài khoản bị khoá → <b>từ chối CONNECT</b>, không âm thầm hạ
 *       xuống thành khách. Hạ ngầm sẽ khiến người dùng tưởng mình đang giữ ghế dưới tài
 *       khoản của mình, tới bước tạo đơn mới vỡ ra là không phải.</li>
 *   <li>Không có header → {@code guest:<khoá thiết bị>}. Khách chưa đăng nhập vẫn phải giữ
 *       được ghế vì luồng đặt vé cho phép chọn ghế trước rồi mới đăng nhập.</li>
 * </ul>
 *
 * <p>Từ đây, {@code SeatStatusController} lấy danh tính từ {@link StompPrincipal} và bỏ hẳn
 * trường {@code userId} client gửi lên.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    public static final String AUTH_HEADER = "Authorization";
    public static final String GUEST_KEY_HEADER = "X-Guest-Key";
    public static final String BEARER_PREFIX = "Bearer ";

    /**
     * Frontend gửi lại đúng chuỗi này khi thấy ERROR, để phân biệt "token hỏng, thử lại
     * dưới dạng khách" với các lỗi kết nối khác và không rơi vào vòng lặp reconnect vô tận.
     */
    public static final String INVALID_TOKEN_ERROR = "WS_AUTH_INVALID_TOKEN";

    /** Khoá thiết bị do frontend sinh: "sess_" + timestamp + hai số base36. */
    private static final Pattern GUEST_KEY_PATTERN = Pattern.compile("sess_[A-Za-z0-9_-]{4,96}");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String guestKey = readGuestKey(accessor);
        String token = readBearerToken(accessor);

        String identity = token == null
                ? SeatIdentity.ofGuest(guestKey)
                : SeatIdentity.ofUser(authenticate(token));

        accessor.setUser(new StompPrincipal(identity, guestKey));
        return message;
    }

    /**
     * @return email của tài khoản nếu token hợp lệ
     * @throws MessageDeliveryException nếu token sai, hết hạn, hoặc tài khoản đã bị khoá
     */
    private String authenticate(String token) {
        try {
            String email = jwtService.extractUsername(token);
            if (email != null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                // Giống JwtAuthFilter: tài khoản bị admin khoá mất quyền NGAY, không đợi
                // token hết hạn sau 24 giờ.
                if (jwtService.isTokenValid(token, userDetails) && userDetails.isEnabled()) {
                    return email;
                }
            }
        } catch (Exception e) {
            log.debug("Từ chối CONNECT WebSocket: token không dùng được ({})", e.getMessage());
        }
        throw new MessageDeliveryException(INVALID_TOKEN_ERROR);
    }

    private String readBearerToken(StompHeaderAccessor accessor) {
        String header = firstNativeHeader(accessor, AUTH_HEADER);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    /**
     * Khoá thiết bị client khai, sau khi kiểm tra hình dạng.
     *
     * <p>Không khai hoặc khai sai hình dạng thì máy chủ tự cấp một khoá ngẫu nhiên: phiên
     * vẫn dùng được, nhưng khoá đó chết theo kết nối. Sinh phía máy chủ để một client nghịch
     * ngợm không thể chọn trùng khoá của người khác hòng chiếm ghế.
     */
    private String readGuestKey(StompHeaderAccessor accessor) {
        String header = firstNativeHeader(accessor, GUEST_KEY_HEADER);
        if (header != null && GUEST_KEY_PATTERN.matcher(header).matches()) {
            return header;
        }
        byte[] bytes = new byte[12];
        RANDOM.nextBytes(bytes);
        return "sess_srv_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String firstNativeHeader(StompHeaderAccessor accessor, String name) {
        List<String> values = accessor.getNativeHeader(name);
        return (values == null || values.isEmpty()) ? null : values.get(0);
    }
}
