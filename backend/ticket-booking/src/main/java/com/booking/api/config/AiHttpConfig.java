package com.booking.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * HTTP client dùng chung cho các lời gọi ra ngoài (Gemini/LLM, Cloudflare Turnstile).
 *
 * Trước đây mỗi chỗ tự `new RestTemplate()` / `HttpClient.newHttpClient()` mà KHÔNG set
 * timeout nào — upstream treo là giữ luôn thread request cho tới khi SseEmitter hết 180s,
 * hoặc treo vô hạn với endpoint đồng bộ. Trên Render free tier (1 container, heap 256MB)
 * chỉ vài request treo là đủ làm nghẽn toàn bộ API.
 */
@Configuration
public class AiHttpConfig {

    @Value("${llm.timeouts.connect-seconds:5}")
    private long connectSeconds;

    @Value("${llm.timeouts.read-seconds:30}")
    private long readSeconds;

    /** RestTemplate cho các lời gọi đồng bộ (chat non-stream, analysis, verify captcha). */
    @Bean
    public RestTemplate aiRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(connectSeconds));
        factory.setReadTimeout(Duration.ofSeconds(readSeconds));
        return new RestTemplate(factory);
    }

    /**
     * HttpClient cho SSE streaming. Chỉ set connectTimeout ở đây — read timeout của
     * stream phải đặt trên từng HttpRequest (xem AIService), vì stream sống lâu hơn
     * một request thường.
     */
    @Bean
    public HttpClient aiHttpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(connectSeconds))
                .build();
    }
}
