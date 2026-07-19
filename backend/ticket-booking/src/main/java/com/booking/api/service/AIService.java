package com.booking.api.service;

import com.booking.api.dto.MessageDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${gemini.api-key:}")
    private String groqApiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

    // Model nhẹ, nhanh, 14,400 req/ngày - dùng cho chatbot customer support
    private static final String CHAT_MODEL = "llama-3.1-8b-instant";

    // Model mạnh, dùng cho phân tích báo cáo AI (Analytics) - 1,000 req/ngày
    private static final String ANALYSIS_MODEL = "llama-3.3-70b-versatile";

    // Giới hạn an toàn
    private static final int MAX_HISTORY_PAIRS = 8;     // tối đa 8 cặp user/assistant = 16 items
    private static final int MAX_CONTENT_LENGTH = 500;  // tối đa 500 ký tự/tin nhắn trong history
    private static final int CHAT_MAX_TOKENS = 512;     // tiết kiệm TPM cho chat
    private static final int ANALYSIS_MAX_TOKENS = 1024;

    public String getAIAnalysis(String systemInstruction, String dataToAnalyze) {
        return callGroqApi(ANALYSIS_MODEL, systemInstruction, null, dataToAnalyze, 0.3, ANALYSIS_MAX_TOKENS);
    }

    public String getChatResponse(String systemInstruction, List<MessageDto> history, String userMessage) {
        return callGroqApi(CHAT_MODEL, systemInstruction, history, userMessage, 0.7, CHAT_MAX_TOKENS);
    }

    private String callGroqApi(String model, String systemInstruction, List<MessageDto> history,
                                String userContent, double temperature, int maxTokens) {
        if (groqApiKey == null || groqApiKey.trim().isEmpty() || "YOUR_API_KEY_HERE".equals(groqApiKey)) {
            return "Hệ thống AI chưa được cấu hình. Vui lòng kiểm tra API Key.";
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        List<Map<String, Object>> messages = new ArrayList<>();

        // 1. System message
        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemInstruction);
        messages.add(systemMessage);

        // 2. Lịch sử hội thoại (có kiểm soát sliding window + cắt nội dung)
        if (history != null && !history.isEmpty()) {
            // Phòng thủ backend: chỉ lấy MAX_HISTORY_PAIRS cặp cuối (= 2*MAX_HISTORY_PAIRS items)
            int startIndex = Math.max(0, history.size() - MAX_HISTORY_PAIRS * 2);
            List<MessageDto> trimmedHistory = history.subList(startIndex, history.size());

            for (MessageDto msg : trimmedHistory) {
                if (msg.getRole() == null || msg.getContent() == null) continue;
                // Cắt nội dung mỗi tin nhắn trong history nếu quá dài
                String content = msg.getContent();
                if (content.length() > MAX_CONTENT_LENGTH) {
                    content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
                }
                Map<String, Object> historyMsg = new HashMap<>();
                historyMsg.put("role", msg.getRole());
                historyMsg.put("content", content);
                messages.add(historyMsg);
            }
        }

        // 3. Tin nhắn mới của user
        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", userContent);
        messages.add(userMessage);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", maxTokens);
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
