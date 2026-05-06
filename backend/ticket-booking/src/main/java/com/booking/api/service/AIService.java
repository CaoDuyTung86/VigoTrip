package com.booking.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${gemini.api-key:}")
    private String groqApiKey; // Dùng tên này cho đúng bản chất

    private final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private final String MODEL_NAME = "llama-3.3-70b-versatile";

    public String getAIAnalysis(String systemInstruction, String dataToAnalyze) {
        return callGroqApi(systemInstruction, dataToAnalyze, 0.3);
    }

    public String getChatResponse(String systemInstruction, String userMessage) {
        return callGroqApi(systemInstruction, userMessage, 0.7);
    }

    private String callGroqApi(String systemInstruction, String userContent, double temperature) {
        if (groqApiKey == null || groqApiKey.trim().isEmpty() || "YOUR_API_KEY_HERE".equals(groqApiKey)) {
            return "Hệ thống AI chưa được cấu hình. Vui lòng kiểm tra API Key.";
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemInstruction);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", userContent);

        Map<String, Object> body = new HashMap<>();
        body.put("model", MODEL_NAME);
        body.put("messages", List.of(systemMessage, userMessage));
        body.put("max_tokens", 1024);
        body.put("temperature", temperature);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(GROQ_URL, entity, Map.class);
            Map<String, Object> responseBody = response.getBody();

            if (responseBody != null && responseBody.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    return (String) message.get("content");
                }
            }
            return "Xin lỗi, AI không thể xử lý yêu cầu lúc này.";

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Groq API Error: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 429) {
                return "AI đang quá tải (Rate limit), vui lòng thử lại sau vài giây.";
            }
            return "Lỗi kết nối AI (" + e.getStatusCode() + ").";
        } catch (Exception e) {
            log.error("AI Service Error", e);
            return "Đã có lỗi xảy ra khi kết nối với máy chủ AI.";
        }
    }
}
