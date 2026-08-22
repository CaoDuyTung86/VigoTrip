package com.booking.api.config;

import com.booking.api.mail.BrevoMailSender;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Properties;

/**
 * Chọn đường gửi mail lúc khởi động.
 *
 * Có BREVO_API_KEY  -> đi HTTPS qua Brevo API (bắt buộc trên Render, vì Render chặn
 *                      outbound port 25/465/587 nên SMTP không bao giờ connect được).
 * Không có key      -> quay về SMTP như cũ, để chạy local/docker vẫn dùng Gmail bình thường.
 *
 * Khai báo bean MailSender ở đây cũng đồng thời tắt auto-config mail của Spring Boot
 * (MailSenderAutoConfiguration là @ConditionalOnMissingBean), nên chỉ tồn tại đúng một
 * JavaMailSender trong context — EmailService inject vào là nhận đúng cái đã chọn.
 */
@Slf4j
@Configuration
public class MailConfig {

    @Value("${brevo.api-key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:${spring.mail.username:}}")
    private String brevoSenderEmail;

    @Value("${brevo.sender.name:VigoTrip}")
    private String brevoSenderName;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String smtpHost;

    @Value("${spring.mail.port:587}")
    private int smtpPort;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    @Bean
    public JavaMailSender mailSender() {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            log.warn("BREVO_API_KEY chưa được cấu hình - fallback sang SMTP {}:{}. "
                    + "Trên Render đường này sẽ timeout vì port SMTP bị chặn.", smtpHost, smtpPort);
            return smtpSender();
        }
        if (brevoSenderEmail == null || brevoSenderEmail.isBlank()) {
            throw new IllegalStateException(
                    "Đã bật Brevo nhưng thiếu brevo.sender.email (hoặc spring.mail.username). "
                            + "Địa chỉ này phải là sender đã verify trong Brevo.");
        }
        log.info("Gửi mail qua Brevo API, sender = {} <{}>", brevoSenderName, brevoSenderEmail);
        // Dùng Jackson 2 riêng thay vì ObjectMapper bean của Spring: từ Boot 4, bean
        // auto-config là Jackson 3 (tools.jackson.databind.ObjectMapper), khác type
        // với com.fasterxml.jackson.databind.ObjectMapper mà BrevoMailSender cần.
        return new BrevoMailSender(brevoRestClient(), new ObjectMapper(), brevoSenderEmail, brevoSenderName);
    }

    /**
     * Timeout bắt buộc phải có: pool email chỉ 3 thread, một request treo vô hạn là
     * đủ chặn toàn bộ mail phía sau (xem AsyncConfig).
     */
    private RestClient brevoRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("api-key", brevoApiKey)
                .defaultHeader("accept", "application/json")
                .build();
    }

    private JavaMailSender smtpSender() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(smtpHost);
        sender.setPort(smtpPort);
        sender.setUsername(smtpUsername);
        sender.setPassword(smtpPassword);
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        // Không có timeout thì thread kẹt tới khi OS bỏ cuộc (hàng phút trên Render).
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");
        return sender;
    }
}
