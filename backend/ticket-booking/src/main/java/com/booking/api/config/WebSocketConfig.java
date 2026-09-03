package com.booking.api.config;

import com.booking.api.security.StompAuthChannelInterceptor;
import com.booking.api.security.StompRateLimitChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;
    private final StompRateLimitChannelInterceptor stompRateLimitChannelInterceptor;

    /**
     * Tên miền được phép mở WebSocket.
     *
     * <p>Bản cũ để {@code setAllowedOriginPatterns("*")}, tức bất kỳ trang web nào trên
     * Internet cũng mở được kết nối tới máy chủ này từ trình duyệt của người dùng. Cộng với
     * việc kênh không xác thực, một trang bất kỳ chỉ cần nhúng vài dòng JavaScript là đọc
     * được toàn bộ luồng chọn ghế và nhả ghế người khác.
     *
     * <p>Danh sách để cấu hình được vì mỗi lần deploy xem trước, Vercel lại cấp một tên miền
     * mới — chặn cứng trong mã sẽ khiến bản xem trước không dùng được rồi lại bị nới về
     * {@code "*"} cho xong.
     */
    @Value("${app.websocket.allowed-origin-patterns}")
    private List<String> allowedOriginPatterns;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // /topic: phát cho cả phòng, tách theo từng chuyến (SeatTopic.forTrip).
        // /queue: gửi riêng cho một phiên — phản hồi giữ ghế và mã chủ sở hữu, những thứ
        //         không ai khác cần biết.
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    /**
     * Thứ tự có ý nghĩa: xác thực trước, rồi mới tới trần tần suất.
     *
     * <p>Bộ đếm tần suất khoá theo phiên, mà phiên chỉ có danh tính sau khi frame CONNECT
     * đi qua bộ chặn xác thực. Đảo lại thì một phiên chưa xác thực cũng chiếm được một gáo
     * token.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor, stompRateLimitChannelInterceptor);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new))
                .withSockJS();
    }
}
