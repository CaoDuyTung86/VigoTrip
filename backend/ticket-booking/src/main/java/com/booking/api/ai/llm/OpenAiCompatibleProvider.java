package com.booking.api.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Nhà cung cấp nói giao thức Chat Completions của OpenAI.
 *
 * Một lớp này phục vụ được Gemini (qua endpoint /v1beta/openai), Groq và OpenRouter —
 * cả ba đều dùng chung schema request/response. Khác biệt duy nhất nằm ở baseUrl,
 * apiKey và tên model, tất cả đều lấy từ cấu hình.
 *
 * Phần parse HTTP và SSE ở đây được chuyển gần như nguyên vẹn từ AIService cũ: đó là
 * code đã chạy đúng trên production, không có lý do viết lại.
 */
@Slf4j
public class OpenAiCompatibleProvider implements LlmProvider {

    private static final Duration STREAM_TIMEOUT = Duration.ofSeconds(120);

    private final LlmProperties.Provider config;
    private final RestTemplate restTemplate;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OpenAiCompatibleProvider(LlmProperties.Provider config, RestTemplate restTemplate,
                                    HttpClient httpClient, ObjectMapper objectMapper) {
        this.config = config;
        this.restTemplate = restTemplate;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return config.getName();
    }

    @Override
    public String model() {
        return config.getModel();
    }

    @Override
    public int maxTokens() {
        return config.getMaxTokens();
    }

    @Override
    public double temperature() {
        return config.getTemperature();
    }

    private String completionsUrl() {
        String base = config.getBaseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/chat/completions";
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiKey());
        return headers;
    }

    /**
     * Thân request chung cho cả hai đường gọi.
     *
     * extraBody đổ vào TRƯỚC rồi mới tới các trường cố định, nên một khoá gõ nhầm trong YAML
     * không thể đổi model hay nuốt mất messages — nó chỉ thêm được thứ endpoint hiểu mà lớp
     * này chưa biết, ví dụ reasoning_effort của model biết suy nghĩ.
     */
    private Map<String, Object> newBody(List<Map<String, Object>> messages,
                                        double temperature,
                                        int maxTokens) {
        Map<String, Object> body = new HashMap<>(config.getExtraBody());
        body.put("model", config.getModel());
        body.put("messages", messages);
        body.put("max_tokens", maxTokens);
        body.put("temperature", temperature);
        return body;
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> chatCompletion(List<Map<String, Object>> messages,
                                              List<Map<String, Object>> tools,
                                              double temperature,
                                              int maxTokens) {
        Map<String, Object> body = newBody(messages, temperature, maxTokens);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    completionsUrl(), new HttpEntity<>(body, headers()), Map.class);
            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null || !responseBody.containsKey("choices")) {
                throw new LlmProviderException(name(), "Phản hồi không có trường choices", true, null, null);
            }
            List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
            if (choices.isEmpty()) {
                throw new LlmProviderException(name(), "choices rỗng", true, null, null);
            }
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            if (message == null) {
                throw new LlmProviderException(name(), "choice không có message", true, null, null);
            }
            return message;

        } catch (HttpClientErrorException e) {
            // 429 đáng để đổi nhà cung cấp; 4xx còn lại là lỗi ở phía ta.
            boolean retryable = e.getStatusCode().value() == 429;
            throw new LlmProviderException(name(),
                    "Lỗi client " + e.getStatusCode() + ": " + e.getResponseBodyAsString(),
                    retryable, e.getStatusCode().value(), e);
        } catch (HttpServerErrorException e) {
            throw new LlmProviderException(name(),
                    "Lỗi server " + e.getStatusCode(), true, e.getStatusCode().value(), e);
        } catch (ResourceAccessException e) {
            // timeout kết nối/đọc, DNS hỏng, socket đứt
            throw new LlmProviderException(name(), "Không kết nối được: " + e.getMessage(), true, null, e);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public void streamCompletion(List<Map<String, Object>> messages,
                                 double temperature,
                                 int maxTokens,
                                 Consumer<String> chunkConsumer) {
        Map<String, Object> body = newBody(messages, temperature, maxTokens);
        body.put("stream", true);

        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(completionsUrl()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + config.getApiKey())
                    // Ngắn hơn 180s của SseEmitter để lỗi nổi lên trước khi emitter hết hạn.
                    .timeout(STREAM_TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

            int status = response.statusCode();
            if (status >= 400) {
                boolean retryable = status == 429 || status >= 500;
                throw new LlmProviderException(name(), "Stream trả về HTTP " + status, retryable, status, null);
            }

            readSseStream(response.body(), chunkConsumer);

        } catch (LlmProviderException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmProviderException(name(), "Bị ngắt khi đang stream", false, null, e);
        } catch (Exception e) {
            throw new LlmProviderException(name(), "Lỗi stream: " + e.getMessage(), true, null, e);
        }
    }

    @SuppressWarnings("unchecked")
    private void readSseStream(InputStream stream, Consumer<String> chunkConsumer) throws java.io.IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (!line.startsWith("data:")) {
                    continue;
                }
                String data = line.substring(5).trim();
                if ("[DONE]".equals(data)) {
                    return;
                }
                try {
                    Map<String, Object> map = objectMapper.readValue(data, Map.class);
                    List<Map<String, Object>> choices = (List<Map<String, Object>>) map.get("choices");
                    if (choices == null || choices.isEmpty()) {
                        continue;
                    }
                    Map<String, Object> delta = (Map<String, Object>) choices.get(0).get("delta");
                    if (delta == null) {
                        continue;
                    }
                    String content = (String) delta.get("content");
                    if (content != null && !content.isEmpty()) {
                        chunkConsumer.accept(content);
                    }
                } catch (Exception parseEx) {
                    // Dòng SSE bị cắt dở — bỏ qua, mẩu sau sẽ tới.
                    log.trace("Bỏ qua dòng SSE không parse được từ {}", name());
                }
            }
        }
    }
}
