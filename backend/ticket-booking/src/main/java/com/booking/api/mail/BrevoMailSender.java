package com.booking.api.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.BodyPart;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.mail.MailParseException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessagePreparator;
import org.springframework.web.client.RestClient;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Gửi mail qua Brevo REST API (HTTPS 443) thay vì SMTP.
 *
 * Lý do tồn tại: Render chặn outbound TCP trên port 25/465/587 để chống spam, nên
 * JavaMailSenderImpl luôn chết với `MailConnectException: Couldn't connect to host,
 * port: smtp.gmail.com, 587`. Gmail SMTP không có port thay thế nào thoát được chặn,
 * nên cách duy nhất là bỏ SMTP và đi qua HTTP API.
 *
 * Class này cài đặt đúng interface JavaMailSender để EmailService KHÔNG phải sửa gì:
 * vẫn createMimeMessage() + MimeMessageHelper như cũ, chỉ khác ở bước send() — thay
 * vì mở socket SMTP thì bóc MimeMessage ra thành JSON rồi POST lên Brevo.
 */
@Slf4j
public class BrevoMailSender implements JavaMailSender {

    private static final String API_URL = "https://api.brevo.com/v3/smtp/email";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String senderEmail;
    private final String senderName;

    public BrevoMailSender(RestClient restClient, ObjectMapper objectMapper,
                           String senderEmail, String senderName) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
    }

    /**
     * MimeMessage rỗng không gắn Session thật — nó chỉ là cấu trúc dữ liệu trung gian
     * để MimeMessageHelper ghi vào, không bao giờ được transport qua JavaMail.
     */
    @Override
    public MimeMessage createMimeMessage() {
        return new MimeMessage(Session.getInstance(new Properties()));
    }

    @Override
    public MimeMessage createMimeMessage(InputStream contentStream) throws MailParseException {
        try {
            return new MimeMessage(Session.getInstance(new Properties()), contentStream);
        } catch (Exception e) {
            throw new MailParseException(e);
        }
    }

    @Override
    public void send(MimeMessage mimeMessage) throws MailSendException {
        send(new MimeMessage[]{mimeMessage});
    }

    @Override
    public void send(MimeMessage... mimeMessages) throws MailSendException {
        Map<Object, Exception> failures = new LinkedHashMap<>();
        for (MimeMessage message : mimeMessages) {
            try {
                dispatch(message);
            } catch (Exception e) {
                failures.put(message, e);
            }
        }
        if (!failures.isEmpty()) {
            throw new MailSendException(failures);
        }
    }

    @Override
    public void send(MimeMessagePreparator mimeMessagePreparator) throws MailSendException {
        send(new MimeMessagePreparator[]{mimeMessagePreparator});
    }

    @Override
    public void send(MimeMessagePreparator... mimeMessagePreparators) throws MailSendException {
        List<MimeMessage> messages = new ArrayList<>();
        for (MimeMessagePreparator preparator : mimeMessagePreparators) {
            MimeMessage message = createMimeMessage();
            try {
                preparator.prepare(message);
            } catch (Exception e) {
                throw new MailPreparationException(e);
            }
            messages.add(message);
        }
        send(messages.toArray(new MimeMessage[0]));
    }

    /** EmailService không dùng SimpleMailMessage, nhưng interface MailSender bắt buộc có. */
    @Override
    public void send(SimpleMailMessage simpleMessage) throws MailSendException {
        send(new SimpleMailMessage[]{simpleMessage});
    }

    @Override
    public void send(SimpleMailMessage... simpleMessages) throws MailSendException {
        Map<Object, Exception> failures = new LinkedHashMap<>();
        for (SimpleMailMessage simpleMessage : simpleMessages) {
            try {
                String[] to = simpleMessage.getTo();
                if (to == null || to.length == 0) {
                    throw new IllegalArgumentException("Mail không có người nhận");
                }
                post(List.of(to), simpleMessage.getSubject(), null, simpleMessage.getText());
            } catch (Exception e) {
                failures.put(simpleMessage, e);
            }
        }
        if (!failures.isEmpty()) {
            throw new MailSendException(failures);
        }
    }

    private void dispatch(MimeMessage message) throws Exception {
        List<String> recipients = new ArrayList<>();
        var addresses = message.getRecipients(Message.RecipientType.TO);
        if (addresses != null) {
            for (var address : addresses) {
                recipients.add(((InternetAddress) address).getAddress());
            }
        }
        if (recipients.isEmpty()) {
            throw new IllegalArgumentException("Mail không có người nhận");
        }

        Body body = new Body();
        extract(message.getContent(), message.getContentType(), body);
        post(recipients, message.getSubject(), body.html, body.text);
    }

    /**
     * MimeMessageHelper(message, true, "UTF-8") sinh cây multipart lồng nhau
     * (mixed &gt; related &gt; alternative), nên phải duyệt đệ quy mới lấy được phần HTML.
     *
     * Các part nhị phân bị bỏ qua có chủ đích: Brevo không hỗ trợ Content-ID, ảnh QR
     * đã được EmailService chuyển sang &lt;img src="URL"&gt; nên không còn part nào cần giữ.
     */
    private void extract(Object content, String contentType, Body body) throws Exception {
        if (content instanceof MimeMultipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                extract(part.getContent(), part.getContentType(), body);
            }
        } else if (content instanceof String text) {
            String type = contentType == null ? "" : contentType.toLowerCase();
            if (type.startsWith("text/html")) {
                body.html = text;
            } else if (body.text == null) {
                body.text = text;
            }
        }
    }

    private void post(List<String> recipients, String subject, String html, String text) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sender", Map.of("email", senderEmail, "name", senderName));
        payload.put("to", recipients.stream().map(email -> Map.of("email", email)).toList());
        payload.put("subject", subject == null ? "" : subject);
        if (html != null) {
            payload.put("htmlContent", html);
        } else {
            payload.put("textContent", text == null ? "" : text);
        }

        String requestBody;
        try {
            requestBody = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Không serialize được payload Brevo", e);
        }

        restClient.post()
                .uri(API_URL)
                .header("content-type", "application/json")
                .body(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    // Body của Brevo nêu rõ lý do (sender chưa verify, hết quota, sai key)
                    // nên phải ném kèm, không thì log chỉ có mã 400 trống rỗng.
                    String responseBody = new String(response.getBody().readAllBytes(),
                            StandardCharsets.UTF_8);
                    throw new IllegalStateException(
                            "Brevo trả về " + response.getStatusCode() + ": " + responseBody);
                })
                .toBodilessEntity();
    }

    private static final class Body {
        private String html;
        private String text;
    }
}
