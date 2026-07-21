package com.booking.api.service;

import com.booking.api.dto.MessageDto;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper = new ObjectMapper();

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

    public interface ToolHandler {
        String executeTool(String functionName, Map<String, Object> arguments);
    }

    public String getAIAnalysis(String systemInstruction, String dataToAnalyze) {
        return callGroqApi(ANALYSIS_MODEL, systemInstruction, null, dataToAnalyze, 0.3, ANALYSIS_MAX_TOKENS);
    }

    public String getChatResponse(String systemInstruction, List<MessageDto> history, String userMessage, ToolHandler toolHandler) {
        return callGroqApiWithTools(CHAT_MODEL, systemInstruction, history, userMessage, 0.7, CHAT_MAX_TOKENS, toolHandler);
    }

    private List<Map<String, Object>> buildToolsDefinition() {
        List<Map<String, Object>> tools = new ArrayList<>();

        // Tool 1: search_trips
        Map<String, Object> searchTripsFn = new HashMap<>();
        searchTripsFn.put("name", "search_trips");
        searchTripsFn.put("description", "Tra cứu chuyến đi (vé máy bay, xe khách, tàu hỏa) theo điểm đi, điểm đến hoặc loại phương tiện.");

        Map<String, Object> props = new HashMap<>();
        props.put("origin", Map.of("type", "string", "description", "Điểm khởi hành (ví dụ: 'Hà Nội', 'Sài Gòn')"));
        props.put("destination", Map.of("type", "string", "description", "Điểm đến (ví dụ: 'Đà Nẵng', 'Phú Quốc')"));
        props.put("vehicleType", Map.of("type", "string", "description", "Loại phương tiện: 'BUS' (xe khách), 'FLIGHT' (máy bay), 'TRAIN' (tàu hỏa)"));

        Map<String, Object> params = Map.of(
            "type", "object",
            "properties", props
        );
        searchTripsFn.put("parameters", params);
        tools.add(Map.of("type", "function", "function", searchTripsFn));

        // Tool 2: get_user_bookings
        Map<String, Object> getBookingsFn = new HashMap<>();
        getBookingsFn.put("name", "get_user_bookings");
        getBookingsFn.put("description", "Tra cứu danh sách vé đã đặt / lịch sử đơn hàng của người dùng hiện tại.");
        getBookingsFn.put("parameters", Map.of("type", "object", "properties", Map.of()));
        tools.add(Map.of("type", "function", "function", getBookingsFn));

        return tools;
    }

    private String callGroqApiWithTools(String model, String systemInstruction, List<MessageDto> history,
                                        String userContent, double temperature, int maxTokens, ToolHandler toolHandler) {
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

        // 2. Lịch sử hội thoại
        if (history != null && !history.isEmpty()) {
            int startIndex = Math.max(0, history.size() - MAX_HISTORY_PAIRS * 2);
            List<MessageDto> trimmedHistory = history.subList(startIndex, history.size());

            for (MessageDto msg : trimmedHistory) {
                if (msg.getRole() == null || msg.getContent() == null) continue;
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

        // 3. User message
        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", userContent);
        messages.add(userMessage);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", maxTokens);
        body.put("temperature", temperature);
        if (toolHandler != null) {
            body.put("tools", buildToolsDefinition());
            body.put("tool_choice", "auto");
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(GROQ_URL, entity, Map.class);
            Map<String, Object> responseBody = response.getBody();

            if (responseBody != null && responseBody.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> choiceObj = choices.get(0);
                    Map<String, Object> messageObj = (Map<String, Object>) choiceObj.get("message");

                    // Check if AI requested Tool Calling
                    if (messageObj != null && messageObj.containsKey("tool_calls") && toolHandler != null) {
                        List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) messageObj.get("tool_calls");
                        if (toolCalls != null && !toolCalls.isEmpty()) {
                            log.info("Groq AI requested {} tool calls", toolCalls.size());

                            // Add assistant message with tool_calls
                            messages.add(messageObj);

                            for (Map<String, Object> toolCall : toolCalls) {
                                String callId = (String) toolCall.get("id");
                                Map<String, Object> fnObj = (Map<String, Object>) toolCall.get("function");
                                String fnName = (String) fnObj.get("name");
                                String argsJson = String.valueOf(fnObj.get("arguments"));

                                Map<String, Object> argsMap = new HashMap<>();
                                if (argsJson != null && !argsJson.isBlank()) {
                                    try {
                                        argsMap = objectMapper.readValue(argsJson, Map.class);
                                    } catch (Exception parseEx) {
                                        log.error("Failed to parse tool args JSON", parseEx);
                                    }
                                }

                                String toolResult = toolHandler.executeTool(fnName, argsMap);

                                Map<String, Object> toolMsg = new HashMap<>();
                                toolMsg.put("role", "tool");
                                toolMsg.put("tool_call_id", callId);
                                toolMsg.put("content", toolResult != null ? toolResult : "[]");
                                messages.add(toolMsg);
                            }

                            // Second API call to Groq with tool results
                            Map<String, Object> secondBody = new HashMap<>();
                            secondBody.put("model", model);
                            secondBody.put("messages", messages);
                            secondBody.put("max_tokens", maxTokens);
                            secondBody.put("temperature", temperature);

                            HttpEntity<Map<String, Object>> secondEntity = new HttpEntity<>(secondBody, headers);
                            ResponseEntity<Map> secondResponse = restTemplate.postForEntity(GROQ_URL, secondEntity, Map.class);
                            Map<String, Object> secondBodyObj = secondResponse.getBody();

                            if (secondBodyObj != null && secondBodyObj.containsKey("choices")) {
                                List<Map<String, Object>> secondChoices = (List<Map<String, Object>>) secondBodyObj.get("choices");
                                if (!secondChoices.isEmpty()) {
                                    Map<String, Object> secondMsg = (Map<String, Object>) secondChoices.get(0).get("message");
                                    return (String) secondMsg.get("content");
                                }
                            }
                        }
                    }

                    if (messageObj != null && messageObj.containsKey("content")) {
                        return (String) messageObj.get("content");
                    }
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

    private String callGroqApi(String model, String systemInstruction, List<MessageDto> history,
                                String userContent, double temperature, int maxTokens) {
        return callGroqApiWithTools(model, systemInstruction, history, userContent, temperature, maxTokens, null);
    }
}

