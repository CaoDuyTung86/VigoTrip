package com.booking.api.weather;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * HTTP client riêng cho Open-Meteo.
 *
 * <p>Không dùng chung {@code aiRestTemplate}: bên đó để giờ chờ đọc 30 giây vì một lượt trả lời
 * của mô hình ngôn ngữ vốn lâu. Thời tiết thì ngược lại — nó là một khối phụ trên trang chi tiết
 * chuyến, chờ nó 30 giây nghĩa là giữ một thread request của Render trong 30 giây cho một thứ mà
 * ẩn đi cũng không sao. Vài giây là quá đủ; quá thì bỏ.
 */
@Configuration
public class WeatherHttpConfig {

    @Value("${app.weather.connect-timeout-seconds:3}")
    private long connectSeconds;

    @Value("${app.weather.read-timeout-seconds:4}")
    private long readSeconds;

    @Bean
    public RestTemplate weatherRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(connectSeconds));
        factory.setReadTimeout(Duration.ofSeconds(readSeconds));
        return new RestTemplate(factory);
    }
}
