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

    private static final String AI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    // Model nhẹ hơn cho chatbot — free tier quota cao hơn, đủ mạnh cho function calling
    private static final String CHAT_MODEL = "gemini-flash-lite-latest";

    // Model cho phân tích doanh thu (Analytics).
    // Lưu ý: "gemini-flash-latest" thường xuyên trả 503 (overloaded) với payload báo cáo lớn
    // (test 4/4 lần fail), trong khi flash-lite ổn định 4/4 — dùng lite cho đến khi flash ổn định lại.
    private static final String ANALYSIS_MODEL = "gemini-flash-lite-latest";

    // Giới hạn an toàn — tiết kiệm token, tránh Rate Limit Gemini Free Tier
    private static final int MAX_HISTORY_PAIRS = 3;     // Chỉ lấy 3 lượt chat gần nhất
    private static final int MAX_CONTENT_LENGTH = 200;  // Tối đa 200 ký tự/tin nhắn trong history
    private static final int CHAT_MAX_TOKENS = 800;     // Đủ để AI trả lời đầy đủ sau khi dùng tools
    private static final int ANALYSIS_MAX_TOKENS = 4000;  // Đủ cho báo cáo BI tiếng Việt đầy đủ

    // Gemini hay trả 429/503 tạm thời ("high demand") — retry thay vì báo lỗi ngay
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 2000;

    private ResponseEntity<Map> postForEntityWithRetry(HttpEntity<Map<String, Object>> entity) throws InterruptedException {
        org.springframework.web.client.RestClientResponseException lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return restTemplate.postForEntity(AI_API_URL, entity, Map.class);
            } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
                lastException = e;
            } catch (org.springframework.web.client.HttpServerErrorException e) {
                // 5xx từ Gemini thường là quá tải tạm thời
                lastException = e;
            }
            if (attempt < MAX_RETRIES) {
                log.warn("Gemini API tạm lỗi ({}), thử lại lần {}/{}", lastException.getStatusCode(), attempt, MAX_RETRIES);
                Thread.sleep(RETRY_DELAY_MS * attempt);
            }
        }
        throw lastException;
    }

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
        searchTripsFn.put("description",
            "Tra cứu chuyến đi (vé máy bay, xe khách, tàu hỏa) theo điểm đi, điểm đến hoặc loại phương tiện. " +
            "QUAN TRỌNG: Điểm đi và điểm đến phải dùng MÃ sân bay/bến xe/ga tàu, KHÔNG dùng tên thành phố. " +
            "Bảng quy đổi: Hà Nội=HAN, TP.HCM/Sài Gòn/HCM=SGN, Đà Nẵng=DAD, Hải Phòng=HPH, Huế=HUE, " +
            "Vinh=VIN, Sapa=SAP, Quy Nhơn=QNH, Nha Trang=NTR, Đà Lạt=DLT. " +
            "Ví dụ: tuyến Hà Nội đi Sài Gòn thì origin='HAN', destination='SGN'.");

        Map<String, Object> props = new HashMap<>();
        props.put("origin", Map.of("type", "string", "description", "Mã điểm khởi hành (VD: HAN, SGN, DAD, HPH, HUE, VIN, SAP, QNH, NTR, DLT)"));
        props.put("destination", Map.of("type", "string", "description", "Mã điểm đến (VD: HAN, SGN, DAD, HPH, HUE, VIN, SAP, QNH, NTR, DLT)"));
        props.put("vehicleType", Map.of("type", "string", "description", "Loại phương tiện: 'BUS' (xe khách), 'PLANE' (máy bay), 'TRAIN' (tàu hỏa)"));
        props.put("departureDate", Map.of("type", "string", "description", "Ngày đi theo định dạng YYYY-MM-DD. NẾU KHÁCH KHÔNG CUNG CẤP NGÀY CỤ THỂ HOẶC NÓI TÌM VÉ BẤT KỲ, HÃY TRUYỀN GIÁ TRỊ RỖNG ''. NẾU KHÁCH HỎI 'NGÀY MAI' HÃY TRUYỀN NGÀY TƯƠNG ỨNG."));
        props.put("timeSlot", Map.of("type", "string", "description", "Khung giờ khởi hành: 'MORNING' (Sáng: 05:00-12:00), 'AFTERNOON' (Chiều: 12:00-18:00), 'EVENING' (Tối/Đêm: 18:00-23:59), 'EARLY_MORNING' (Sáng sớm: 00:00-05:00), hoặc giờ cụ thể (VD: '12:00'). NẾU KHÁCH KHÔNG NÓI GIỜ, TRUYỀN GIÁ TRỊ RỖNG ''."));

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

        // Tool 3: get_booking_by_id
        Map<String, Object> getBookingByIdFn = new HashMap<>();
        getBookingByIdFn.put("name", "get_booking_by_id");
        getBookingByIdFn.put("description", "Tra cứu chi tiết một đơn đặt vé/đơn hàng khi biết mã đơn hàng (ID).");
        getBookingByIdFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "bookingId", Map.of(
                    "type", "string",
                    "description", "Mã đơn hàng (ID). Tuyệt đối KHÔNG kèm dấu #, chỉ truyền phần số nguyên. Ví dụ: Nếu khách hỏi '#2', chỉ truyền '2'."
                )
            ),
            "required", List.of("bookingId")
        ));
        tools.add(Map.of("type", "function", "function", getBookingByIdFn));

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
            ResponseEntity<Map> response = postForEntityWithRetry(entity);
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
                            ResponseEntity<Map> secondResponse = postForEntityWithRetry(secondEntity);
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
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            log.error("Gemini server error: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "Máy chủ AI đang bận (quá tải tạm thời), vui lòng bấm thử lại sau ít phút.";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "Đã có lỗi xảy ra khi kết nối với máy chủ AI.";
        } catch (Exception e) {
            log.error("AI Service Error", e);
            return "Đã có lỗi xảy ra khi kết nối với máy chủ AI.";
        }
    }

    public void streamChatResponse(String systemInstruction, List<MessageDto> history, String userMessage, ToolHandler toolHandler, java.util.function.Consumer<String> chunkConsumer) {
        if (groqApiKey == null || groqApiKey.trim().isEmpty() || "YOUR_API_KEY_HERE".equals(groqApiKey)) {
            chunkConsumer.accept("Hệ thống AI chưa được cấu hình. Vui lòng kiểm tra API Key.");
            return;
        }

        List<Map<String, Object>> messages = new ArrayList<>();

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemInstruction);
        messages.add(systemMessage);

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

        Map<String, Object> userMessageObj = new HashMap<>();
        userMessageObj.put("role", "user");
        userMessageObj.put("content", userMessage);
        messages.add(userMessageObj);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("model", CHAT_MODEL);
        body.put("messages", messages);
        body.put("max_tokens", CHAT_MAX_TOKENS);
        body.put("temperature", 0.7);
        if (toolHandler != null) {
            body.put("tools", buildToolsDefinition());
            body.put("tool_choice", "auto");
        }

        try {
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = postForEntityWithRetry(entity);
            Map<String, Object> responseBody = response.getBody();

            if (responseBody != null && responseBody.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> choiceObj = choices.get(0);
                    Map<String, Object> messageObj = (Map<String, Object>) choiceObj.get("message");

                    if (messageObj != null && messageObj.containsKey("tool_calls") && toolHandler != null) {
                        List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) messageObj.get("tool_calls");
                        if (toolCalls != null && !toolCalls.isEmpty()) {
                            log.info("Groq AI requested {} tool calls during stream setup", toolCalls.size());
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

                            streamGroqApiCall(CHAT_MODEL, messages, 0.7, CHAT_MAX_TOKENS, chunkConsumer);
                            return;
                        }
                    }

                    if (messageObj != null && messageObj.containsKey("content")) {
                        String fullText = (String) messageObj.get("content");
                        if (fullText != null) {
                            String[] words = fullText.split("(?<=\\s)|(?=\\s)");
                            for (String word : words) {
                                chunkConsumer.accept(word);
                                try { Thread.sleep(15); } catch (InterruptedException ignored) {}
                            }
                            return;
                        }
                    }
                }
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Gemini API Error during setup: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 429) {
                chunkConsumer.accept("AI đang quá tải (Rate limit), vui lòng thử lại sau vài giây.");
            } else {
                chunkConsumer.accept("Lỗi kết nối AI (" + e.getStatusCode() + ").");
            }
            return;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            chunkConsumer.accept(" [Đã gián đoạn kết nối AI]");
            return;
        } catch (Exception e) {
            log.error("Error during setup for streaming AI response", e);
        }

        streamGroqApiCall(CHAT_MODEL, messages, 0.7, CHAT_MAX_TOKENS, chunkConsumer);
    }

    private void streamGroqApiCall(String model, List<Map<String, Object>> messages, double temperature, int maxTokens, java.util.function.Consumer<String> chunkConsumer) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("messages", messages);
            body.put("max_tokens", maxTokens);
            body.put("temperature", temperature);
            body.put("stream", true);

            String jsonBody = objectMapper.writeValueAsString(body);

            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(AI_API_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            java.net.http.HttpResponse<java.io.InputStream> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() == 429) {
                log.error("Gemini API Rate Limit 429 in stream");
                chunkConsumer.accept("AI đang quá tải (Rate limit), vui lòng thử lại sau vài giây.");
                return;
            }

            try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(response.body(), java.nio.charset.StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("data:")) {
                        String data = line.substring(5).trim();
                        if ("[DONE]".equals(data)) {
                            break;
                        }
                        try {
                            Map<String, Object> map = objectMapper.readValue(data, Map.class);
                            if (map.containsKey("choices")) {
                                List<Map<String, Object>> choices = (List<Map<String, Object>>) map.get("choices");
                                if (choices != null && !choices.isEmpty()) {
                                    Map<String, Object> choice = choices.get(0);
                                    Map<String, Object> delta = (Map<String, Object>) choice.get("delta");
                                    if (delta != null && delta.containsKey("content")) {
                                        String content = (String) delta.get("content");
                                        if (content != null && !content.isEmpty()) {
                                            chunkConsumer.accept(content);
                                        }
                                    }
                                }
                            }
                        } catch (Exception parseEx) {
                            // ignore partial line parse
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error streaming from Groq API", e);
            chunkConsumer.accept(" [Đã gián đoạn kết nối AI]");
        }
    }

    private String callGroqApi(String model, String systemInstruction, List<MessageDto> history,
                                String userContent, double temperature, int maxTokens) {
        return callGroqApiWithTools(model, systemInstruction, history, userContent, temperature, maxTokens, null);
    }

    public Map<String, Object> checkHealth() {
        if (groqApiKey == null || groqApiKey.trim().isEmpty() || "YOUR_API_KEY_HERE".equals(groqApiKey)) {
            return Map.of("status", "OFFLINE", "ready", false, "message", "Missing API Key");
        }
        return Map.of("status", "ONLINE", "ready", true, "message", "AI Server is ready");
    }
}


