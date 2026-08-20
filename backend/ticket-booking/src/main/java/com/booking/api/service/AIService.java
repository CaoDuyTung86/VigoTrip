package com.booking.api.service;

import com.booking.api.ai.llm.LlmBudgetGuard;
import com.booking.api.ai.llm.LlmProperties;
import com.booking.api.ai.llm.LlmProvider;
import com.booking.api.ai.llm.LlmRouter;
import com.booking.api.ai.llm.LlmTask;
import com.booking.api.ai.llm.LlmUnavailableException;
import com.booking.api.dto.MessageDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Façade cho tầng AI.
 *
 * Chữ ký public được giữ nguyên có chủ ý (getAIAnalysis, getChatResponse,
 * streamChatResponse, checkHealth, ToolHandler) để AnalyticsService và ChatService
 * không phải đổi gì. Phần ruột — chọn nhà cung cấp, retry, circuit breaker, metric —
 * đã chuyển hết sang LlmRouter.
 *
 * Vòng lặp function calling nằm ở đây chứ không nằm trong nhà cung cấp: nó là logic
 * điều phối không phụ thuộc nhà cung cấp, và đặt ở đây thì LlmRouter có thể chạy lại
 * trọn vẹn cả vòng lặp trên nhà cung cấp khác khi cần failover.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private final LlmRouter llmRouter;
    private final LlmProperties llmProperties;
    private final LlmBudgetGuard budgetGuard;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Độ trễ giả lập giữa các từ khi "gõ chữ" lại một câu trả lời đã hoàn chỉnh. */
    private static final long TYPEWRITER_DELAY_MS = 15;

    public interface ToolHandler {
        String executeTool(String functionName, Map<String, Object> arguments);
    }

    // ---------------------------------------------------------------- public API

    /**
     * Budget đếm theo REQUEST của người dùng, không theo số lời gọi HTTP.
     * Một lượt chat có function calling thực tế tốn 2 lời gọi tới nhà cung cấp.
     */
    public String getAIAnalysis(String systemInstruction, String dataToAnalyze) {
        if (!budgetGuard.tryConsume()) {
            return budgetGuard.exhaustedMessage();
        }
        try {
            return llmRouter.execute(LlmTask.ANALYSIS, provider -> {
                List<Map<String, Object>> messages = new ArrayList<>();
                messages.add(message("system", systemInstruction));
                messages.add(message("user", dataToAnalyze));
                Map<String, Object> reply = provider.chatCompletion(
                        messages, null, provider.temperature(), provider.maxTokens());
                return textOf(reply);
            });
        } catch (LlmUnavailableException e) {
            log.error("Phân tích AI thất bại: {}", e.getMessage());
            return "Máy chủ AI đang bận, vui lòng thử lại sau ít phút.";
        }
    }

    public String getChatResponse(String systemInstruction, List<MessageDto> history, String userMessage,
                                  ToolHandler toolHandler) {
        if (!budgetGuard.tryConsume()) {
            return budgetGuard.exhaustedMessage();
        }
        try {
            return llmRouter.execute(LlmTask.CHAT,
                    provider -> runToolLoop(provider, systemInstruction, history, userMessage, toolHandler));
        } catch (LlmUnavailableException e) {
            log.error("Chat AI thất bại: {}", e.getMessage());
            return friendlyError(e);
        }
    }

    public void streamChatResponse(String systemInstruction, List<MessageDto> history, String userMessage,
                                   ToolHandler toolHandler, Consumer<String> chunkConsumer) {
        if (!budgetGuard.tryConsume()) {
            chunkConsumer.accept(budgetGuard.exhaustedMessage());
            return;
        }
        try {
            llmRouter.execute(LlmTask.CHAT, provider -> {
                streamOnce(provider, systemInstruction, history, userMessage, toolHandler, chunkConsumer);
                return null;
            });
        } catch (LlmUnavailableException e) {
            log.error("Stream chat AI thất bại: {}", e.getMessage());
            chunkConsumer.accept(friendlyError(e));
        }
    }

    public Map<String, Object> checkHealth() {
        List<LlmProvider> chatProviders = llmRouter.providersFor(LlmTask.CHAT);
        if (chatProviders.isEmpty()) {
            return Map.of("status", "OFFLINE", "ready", false,
                    "message", "Chưa cấu hình nhà cung cấp AI nào");
        }
        List<String> names = chatProviders.stream().map(LlmProvider::name).toList();
        return Map.of(
                "status", "ONLINE",
                "ready", true,
                "message", "AI Server is ready",
                "providers", names);
    }

    // ------------------------------------------------------------ tool calling

    /**
     * Vòng function calling hai bước: gọi model kèm định nghĩa tool; nếu model xin gọi
     * tool thì chạy tool, nhét kết quả vào hội thoại rồi gọi model lần hai để lấy câu
     * trả lời cuối.
     */
    private String runToolLoop(LlmProvider provider, String systemInstruction, List<MessageDto> history,
                               String userMessage, ToolHandler toolHandler) {
        List<Map<String, Object>> messages = buildMessages(systemInstruction, history, userMessage);
        List<Map<String, Object>> tools = toolHandler != null ? buildToolsDefinition() : null;

        Map<String, Object> reply = provider.chatCompletion(
                messages, tools, provider.temperature(), provider.maxTokens());

        List<Map<String, Object>> toolCalls = toolCallsOf(reply);
        if (toolCalls.isEmpty() || toolHandler == null) {
            return textOf(reply);
        }

        appendToolResults(messages, reply, toolCalls, toolHandler);

        Map<String, Object> second = provider.chatCompletion(
                messages, null, provider.temperature(), provider.maxTokens());
        return textOf(second);
    }

    private void streamOnce(LlmProvider provider, String systemInstruction, List<MessageDto> history,
                            String userMessage, ToolHandler toolHandler, Consumer<String> chunkConsumer) {
        List<Map<String, Object>> messages = buildMessages(systemInstruction, history, userMessage);
        List<Map<String, Object>> tools = toolHandler != null ? buildToolsDefinition() : null;

        // Bước dò tool chạy KHÔNG stream: gom tool_calls từ các delta của stream phức
        // tạp hơn nhiều mà không được lợi gì, vì đằng nào cũng phải chờ tool chạy xong.
        Map<String, Object> reply = provider.chatCompletion(
                messages, tools, provider.temperature(), provider.maxTokens());

        List<Map<String, Object>> toolCalls = toolCallsOf(reply);
        if (toolCalls.isEmpty() || toolHandler == null) {
            // Đã có sẵn câu trả lời đầy đủ — phát lại theo kiểu gõ chữ để giữ trải
            // nghiệm streaming ở phía người dùng.
            typewrite(textOf(reply), chunkConsumer);
            return;
        }

        appendToolResults(messages, reply, toolCalls, toolHandler);
        provider.streamCompletion(messages, provider.temperature(), provider.maxTokens(), chunkConsumer);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> toolCallsOf(Map<String, Object> message) {
        if (message == null || !message.containsKey("tool_calls")) {
            return List.of();
        }
        List<Map<String, Object>> calls = (List<Map<String, Object>>) message.get("tool_calls");
        return calls != null ? calls : List.of();
    }

    @SuppressWarnings("unchecked")
    private void appendToolResults(List<Map<String, Object>> messages, Map<String, Object> assistantMessage,
                                   List<Map<String, Object>> toolCalls, ToolHandler toolHandler) {
        log.info("AI yêu cầu {} tool call", toolCalls.size());
        messages.add(assistantMessage);

        for (Map<String, Object> toolCall : toolCalls) {
            String callId = (String) toolCall.get("id");
            Map<String, Object> fnObj = (Map<String, Object>) toolCall.get("function");
            String fnName = (String) fnObj.get("name");
            String argsJson = String.valueOf(fnObj.get("arguments"));

            Map<String, Object> argsMap = new HashMap<>();
            if (argsJson != null && !argsJson.isBlank() && !"null".equals(argsJson)) {
                try {
                    argsMap = objectMapper.readValue(argsJson, Map.class);
                } catch (Exception parseEx) {
                    log.error("Không parse được JSON tham số của tool {}", fnName, parseEx);
                }
            }

            String toolResult = toolHandler.executeTool(fnName, argsMap);

            Map<String, Object> toolMsg = new HashMap<>();
            toolMsg.put("role", "tool");
            toolMsg.put("tool_call_id", callId);
            toolMsg.put("content", toolResult != null ? toolResult : "[]");
            messages.add(toolMsg);
        }
    }

    private void typewrite(String fullText, Consumer<String> chunkConsumer) {
        if (fullText == null) {
            return;
        }
        for (String word : fullText.split("(?<=\\s)|(?=\\s)")) {
            chunkConsumer.accept(word);
            try {
                Thread.sleep(TYPEWRITER_DELAY_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    // ---------------------------------------------------------------- helpers

    private Map<String, Object> message(String role, String content) {
        Map<String, Object> map = new HashMap<>();
        map.put("role", role);
        map.put("content", content);
        return map;
    }

    private List<Map<String, Object>> buildMessages(String systemInstruction, List<MessageDto> history,
                                                    String userMessage) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(message("system", systemInstruction));

        if (history != null && !history.isEmpty()) {
            int maxPairs = llmProperties.getHistory().getMaxPairs();
            int maxLength = llmProperties.getHistory().getMaxContentLength();
            int startIndex = Math.max(0, history.size() - maxPairs * 2);

            for (MessageDto msg : history.subList(startIndex, history.size())) {
                if (msg.getRole() == null || msg.getContent() == null) {
                    continue;
                }
                String content = msg.getContent();
                if (content.length() > maxLength) {
                    content = content.substring(0, maxLength) + "...";
                }
                messages.add(message(msg.getRole(), content));
            }
        }

        messages.add(message("user", userMessage));
        return messages;
    }

    private String textOf(Map<String, Object> message) {
        if (message == null) {
            return "Xin lỗi, AI không thể xử lý yêu cầu lúc này.";
        }
        Object content = message.get("content");
        if (content instanceof String s && !s.isBlank()) {
            return s;
        }
        return "Xin lỗi, AI không thể xử lý yêu cầu lúc này.";
    }

    private String friendlyError(LlmUnavailableException e) {
        String msg = e.getMessage() != null ? e.getMessage() : "";
        if (msg.contains("Chưa cấu hình")) {
            return "Hệ thống AI chưa được cấu hình. Vui lòng kiểm tra API Key.";
        }
        return "Máy chủ AI đang bận, vui lòng thử lại sau ít phút.";
    }

    // --------------------------------------------------------- tool definitions

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

        searchTripsFn.put("parameters", Map.of(
            "type", "object",
            "properties", props
        ));
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
}
