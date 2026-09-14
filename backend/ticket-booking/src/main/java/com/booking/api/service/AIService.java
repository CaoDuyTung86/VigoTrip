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
     *
     * Một lượt chat có function calling tốn từ 2 tới {@code llm.tools.max-rounds} lời gọi tới
     * nhà cung cấp, tuỳ câu hỏi có phải tra nối tiếp hay không. Trần ngân sách vì thế đo số lượt
     * hỏi chứ không đo hoá đơn — đúng với cái tên {@code daily-request-cap}, và đủ dùng vì trần
     * số vòng đã chặn phần đuôi tệ nhất của một lượt.
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
     * Vòng function calling nhiều lượt.
     *
     * <p>Mỗi lượt: gọi model kèm định nghĩa tool; model xin gọi tool thì chạy tool, nhét kết quả
     * vào hội thoại rồi lặp lại. Model trả về chữ thay vì tool là lượt chat kết thúc.
     *
     * <p><b>Vì sao phải nhiều lượt.</b> Trước đây con số này đóng cứng ở hai: hỏi, chạy tool,
     * hỏi lần nữa để lấy câu trả lời. Hai lượt phục vụ được mọi câu hỏi mà thứ cần tra đã nằm sẵn
     * trong câu hỏi, nhưng chịu thua câu hỏi mà kết quả tra lần một mới cho biết lần hai phải tra
     * gì. "Vé sắp đi của tôi tới đâu, chỗ đó thời tiết thế nào" là một câu như vậy: phải đọc đơn
     * hàng xong mới biết hỏi thời tiết ở nơi nào. Với hai lượt, model chỉ có hai lối thoát và cả
     * hai đều tệ — hoặc bỏ nửa sau của câu hỏi, hoặc đoán bừa một thành phố.
     *
     * <p><b>Lượt cuối luôn gọi KHÔNG kèm định nghĩa tool.</b> Không có định nghĩa thì model không
     * xin gọi tool được, nên nó buộc phải trả lời bằng chữ. Nếu vẫn để tool ở lượt cuối, ta sẽ
     * nhận về một lời xin gọi tool mà mình đã hết lượt để phục vụ, và thứ gửi cho khách sẽ là một
     * câu trả lời rỗng.
     */
    private String runToolLoop(LlmProvider provider, String systemInstruction, List<MessageDto> history,
                               String userMessage, ToolHandler toolHandler) {
        List<Map<String, Object>> messages = buildMessages(systemInstruction, history, userMessage);
        if (toolHandler == null) {
            return textOf(provider.chatCompletion(
                    messages, null, provider.temperature(), provider.maxTokens()));
        }

        List<Map<String, Object>> tools = buildToolsDefinition();
        ToolTurn turn = new ToolTurn(toolHandler, llmProperties.getTools().getMaxCallsPerTurn());
        int maxRounds = roundLimit();

        for (int round = 1; round <= maxRounds; round++) {
            boolean lastRound = round == maxRounds;
            Map<String, Object> reply = provider.chatCompletion(
                    messages, lastRound ? null : tools, provider.temperature(), provider.maxTokens());

            List<Map<String, Object>> toolCalls = toolCallsOf(reply);
            if (lastRound || toolCalls.isEmpty()) {
                return textOf(reply);
            }
            appendToolResults(messages, reply, toolCalls, turn);
        }
        // Không tới được: lượt cuối đã trả về ở nhánh trên.
        return "Xin lỗi, AI không thể xử lý yêu cầu lúc này.";
    }

    /**
     * Bản stream của cùng vòng lặp trên.
     *
     * <p><b>Bước dò tool chạy KHÔNG stream.</b> Gom {@code tool_calls} từ các delta của một stream
     * phức tạp hơn nhiều mà không được lợi gì, vì đằng nào cũng phải chờ tool chạy xong mới có
     * câu trả lời.
     *
     * <p><b>Đánh đổi đã biết:</b> lượt nào có dùng tool sẽ nhận câu trả lời theo kiểu gõ chữ chứ
     * không phải stream thật. Muốn biết model còn xin tra thêm gì nữa không thì phải hỏi nó kèm
     * định nghĩa tool, mà hỏi kèm tool thì không stream được — hai thứ này loại trừ nhau. Chỉ
     * lượt cuối, lúc đã chắc chắn không còn tool nào, mới stream thật.
     */
    private void streamOnce(LlmProvider provider, String systemInstruction, List<MessageDto> history,
                            String userMessage, ToolHandler toolHandler, Consumer<String> chunkConsumer) {
        List<Map<String, Object>> messages = buildMessages(systemInstruction, history, userMessage);
        if (toolHandler == null) {
            provider.streamCompletion(messages, provider.temperature(), provider.maxTokens(), chunkConsumer);
            return;
        }

        List<Map<String, Object>> tools = buildToolsDefinition();
        ToolTurn turn = new ToolTurn(toolHandler, llmProperties.getTools().getMaxCallsPerTurn());
        int maxRounds = roundLimit();

        for (int round = 1; round <= maxRounds; round++) {
            if (round == maxRounds) {
                provider.streamCompletion(messages, provider.temperature(), provider.maxTokens(), chunkConsumer);
                return;
            }
            Map<String, Object> reply = provider.chatCompletion(
                    messages, tools, provider.temperature(), provider.maxTokens());

            List<Map<String, Object>> toolCalls = toolCallsOf(reply);
            if (toolCalls.isEmpty()) {
                // Đã có sẵn câu trả lời đầy đủ — phát lại theo kiểu gõ chữ để giữ trải nghiệm
                // streaming ở phía người dùng.
                typewrite(textOf(reply), chunkConsumer);
                return;
            }
            appendToolResults(messages, reply, toolCalls, turn);
        }
    }

    /**
     * Trần số lượt, tối thiểu là hai.
     *
     * Một lượt nghĩa là chưa bao giờ gửi định nghĩa tool đi, tức là tắt hẳn function calling
     * bằng một con số cấu hình — không phải điều ai đó định làm khi chỉnh trần này xuống.
     */
    private int roundLimit() {
        return Math.max(2, llmProperties.getTools().getMaxRounds());
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
                                   List<Map<String, Object>> toolCalls, ToolTurn turn) {
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

            String toolResult = turn.run(fnName, argsMap);

            Map<String, Object> toolMsg = new HashMap<>();
            toolMsg.put("role", "tool");
            toolMsg.put("tool_call_id", callId);
            toolMsg.put("content", toolResult != null ? toolResult : "[]");
            messages.add(toolMsg);
        }
    }

    /**
     * Sổ chi tiêu tool cho MỘT lượt chat.
     *
     * <p>Hai thứ nó giữ, và cả hai chỉ thành vấn đề khi vòng lặp có nhiều hơn hai lượt.
     *
     * <p><b>Trần số lần chạy.</b> Trần số vòng một mình không đủ, vì model được phép xin nhiều
     * tool trong CÙNG một vòng: hai vòng vẫn có thể thành mười lăm lượt truy vấn cơ sở dữ liệu
     * cho một câu hỏi. Chạm trần thì lời gọi sau nhận về một câu báo hết lượt chứ không phải một
     * lỗi — model đọc câu đó rồi trả lời bằng những gì đã tra được.
     *
     * <p><b>Nhớ lời gọi đã chạy.</b> Model rất hay xin lại đúng tool với đúng tham số nó vừa xin
     * ở vòng trước, nhất là khi kết quả lần đầu không có gì. Trả lại kết quả cũ vừa tiết kiệm
     * một lượt truy vấn, vừa cắt được vòng lặp quẩn: hỏi đi hỏi lại một câu và nhận về đúng một
     * đáp án thì model thôi hỏi, chứ nếu mỗi lần lại là một lời gọi thật thì nó có thể quẩn cho
     * tới khi hết trần.
     *
     * <p>Sổ này sống đúng một lượt chat rồi bỏ, nên không có chuyện kết quả của khách này rơi
     * sang lượt của khách khác.
     */
    private final class ToolTurn {

        private final ToolHandler handler;
        private final int maxCalls;
        private final Map<String, String> daChay = new HashMap<>();
        private int used;

        private ToolTurn(ToolHandler handler, int maxCalls) {
            this.handler = handler;
            this.maxCalls = Math.max(1, maxCalls);
        }

        private String run(String fnName, Map<String, Object> args) {
            String key = fnName + "|" + args;
            String cached = daChay.get(key);
            if (cached != null) {
                log.info("Tool {} đã chạy với đúng tham số này trong lượt hiện tại — dùng lại kết quả cũ", fnName);
                return cached;
            }
            if (used >= maxCalls) {
                log.warn("Lượt chat đã chạm trần {} lần chạy tool — từ chối {}", maxCalls, fnName);
                return "Đã dùng hết số lần tra cứu cho phép trong lượt này. Hãy trả lời khách bằng "
                        + "những gì đã tra được, và nói rõ phần nào chưa tra được.";
            }
            used++;
            String result = handler.executeTool(fnName, args);
            daChay.put(key, result != null ? result : "[]");
            return result;
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
            "Vinh=VIN, Sa Pa=SAP, Quảng Ninh/Hạ Long=QNH, Nha Trang=NTR, Đà Lạt=DLT, " +
            "Phú Quốc=PQC, Chu Lai=VCL. " +
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

        // Tool 4: check_voucher
        Map<String, Object> checkVoucherFn = new HashMap<>();
        checkVoucherFn.put("name", "check_voucher");
        checkVoucherFn.put("description",
            "Kiểm tra một mã giảm giá có áp dụng được cho đơn hàng của khách hàng hiện tại không và giảm bao nhiêu tiền. " +
            "Gọi khi khách hỏi một mã cụ thể có dùng được không, hoặc khi khách đã cho biết giá vé / tổng tiền đơn hàng. " +
            "Kết quả đã tính cả điều kiện đơn tối thiểu, hạn sử dụng, số lượt còn lại và việc khách đã dùng mã đó chưa.");
        checkVoucherFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "code", Map.of(
                    "type", "string",
                    "description", "Mã giảm giá cần kiểm tra, ví dụ 'SUMMER2026'."
                ),
                "orderAmount", Map.of(
                    "type", "string",
                    "description", "Tổng tiền đơn hàng của khách, tính bằng VND và CHỈ gồm chữ số (ví dụ '300000'). Nếu khách chưa nói giá trị đơn hàng thì truyền giá trị rỗng ''."
                )
            ),
            "required", List.of("code")
        ));
        tools.add(Map.of("type", "function", "function", checkVoucherFn));

        // Tool 5: get_addon_services
        // Đại diện cho bảng dich_vu_bo_sung. Thiếu tool này thì câu hỏi "gợi ý món ăn" không có
        // nguồn nào để bám, và model đặt ra thực đơn của riêng nó kèm giá tự nghĩ.
        Map<String, Object> addonServicesFn = new HashMap<>();
        addonServicesFn.put("name", "get_addon_services");
        addonServicesFn.put("description",
            "Lấy danh mục dịch vụ mua kèm khi đặt vé: suất ăn, gói hành lý ký gửi, bảo hiểm du lịch, xe đưa đón. " +
            "BẮT BUỘC gọi trước khi nói bất cứ điều gì về món ăn, suất ăn, đồ ăn trên chuyến, gói hành lý mua thêm, " +
            "bảo hiểm hay dịch vụ đưa đón, kể cả câu hỏi chung như 'gợi ý món ăn' hay 'có món gì ngon'. " +
            "Danh mục giống nhau cho cả ba loại phương tiện.");
        addonServicesFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "category", Map.of(
                    "type", "string",
                    "description", "Nhóm cần lấy: 'MEAL' (suất ăn), 'BAGGAGE' (hành lý), 'INSURANCE' (bảo hiểm), 'TRANSFER' (xe đưa đón). Muốn lấy toàn bộ danh mục thì truyền giá trị rỗng ''."
                )
            )
        ));
        tools.add(Map.of("type", "function", "function", addonServicesFn));

        // Tool 6: get_weather_forecast
        // Nhận TÊN nơi chứ không bắt model đổi sang mã trước: khách gõ "Đà Nẵng", và để model tự
        // đoán mã là để nó đoán sai. Việc đổi tên sang mã thuộc về PlaceCatalog, nơi có danh sách
        // thật, chứ không thuộc về trí nhớ của một mô hình ngôn ngữ.
        Map<String, Object> weatherFn = new HashMap<>();
        weatherFn.put("name", "get_weather_forecast");
        weatherFn.put("description",
            "Tra dự báo thời tiết thật tại một nơi, cho một hoặc nhiều ngày liên tiếp. " +
            "BẮT BUỘC gọi trước khi nói bất cứ điều gì về thời tiết, nhiệt độ, mưa nắng hay chuyện " +
            "nên mang áo mưa. Chỉ có dự báo trong vòng 7 ngày tới; xa hơn thế thì công cụ nói rõ là " +
            "chưa có, và phải nói thẳng với khách là chưa có chứ không được đoán thay. " +
            "Kết quả CHỈ MÔ TẢ THỜI TIẾT, không được dùng để suy ra chuyến đi có hoãn, huỷ hay trễ.");
        weatherFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "place", Map.of(
                    "type", "string",
                    "description", "Nơi cần xem thời tiết. Truyền thẳng tên khách nói, ví dụ Đà Nẵng, "
                            + "Sa Pa, Sài Gòn; mã điểm như DAD cũng được. KHÔNG tự đổi tên thành mã."
                ),
                "date", Map.of(
                    "type", "string",
                    "description", "Ngày bắt đầu theo định dạng YYYY-MM-DD. Khách không nói ngày thì truyền "
                            + "giá trị rỗng '' (hiểu là hôm nay). Khách nói 'ngày mai' hay 'cuối tuần này' thì "
                            + "tự quy ra ngày cụ thể dựa vào thời gian hiện tại đã cho ở đầu hướng dẫn."
                ),
                "days", Map.of(
                    "type", "integer",
                    "description", "Số ngày liên tiếp cần xem tính từ `date`, từ 1 đến 7, mặc định 1. "
                            + "Khách hỏi cả cuối tuần thì truyền 2, hỏi cả tuần tới thì truyền 7."
                )
            ),
            "required", List.of("place")
        ));
        tools.add(Map.of("type", "function", "function", weatherFn));

        // Tool 7: save_voucher — tool đầu tiên dẫn tới GHI dữ liệu, nhưng chính nó không ghi gì.
        // Nó chỉ tạo một đề xuất; khách bấm nút xác nhận thì một endpoint REST thường mới ghi. Nhờ vậy
        // LlmRouter chạy lại cả vòng lặp khi failover không thành lưu hai lần, và prompt injection cùng
        // lắm dựng được một nút mà người thật vẫn phải tự bấm. Xem ChatActionService.
        Map<String, Object> saveVoucherFn = new HashMap<>();
        saveVoucherFn.put("name", "save_voucher");
        saveVoucherFn.put("description",
            "Chuẩn bị nút xác nhận để khách LƯU một mã giảm giá vào tài khoản (mã đã lưu hiện sẵn ở bước thanh toán). " +
            "CHỈ gọi khi khách chủ động muốn lưu, giữ lại hoặc cất một mã cụ thể. " +
            "Công cụ KHÔNG tự lưu: mã chỉ được lưu khi khách bấm nút xác nhận hiện dưới câu trả lời. " +
            "KHÔNG gọi khi khách chỉ hỏi mã có dùng được không (dùng check_voucher) hay hỏi đang có mã nào.");
        saveVoucherFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "code", Map.of(
                    "type", "string",
                    "description", "Mã giảm giá khách muốn lưu, ví dụ 'WELCOME20'. Chỉ truyền mã khách đã nói ra "
                            + "hoặc mã vừa được giới thiệu trong hội thoại, không tự nghĩ ra mã."
                )
            ),
            "required", List.of("code")
        ));
        tools.add(Map.of("type", "function", "function", saveVoucherFn));

        // Tool 8: update_mail_preferences — cùng khuôn với save_voucher: chỉ đề xuất, khách bấm mới ghi.
        // Hai tham số đều là chuỗi, rỗng = khách không nhắc tới, như mọi tool khác. Một tham số boolean
        // không có chỗ cho "không nhắc tới": model mà điền nó thì câu "gửi thư bằng tiếng Anh" dựng ra
        // một nút tiện tay tắt luôn thư nhắc. Ca đo tiếng Anh trong tool-eval.yml có forbid chặn đúng lỗi đó.
        Map<String, Object> mailPreferencesFn = new HashMap<>();
        mailPreferencesFn.put("name", "update_mail_preferences");
        mailPreferencesFn.put("description",
            "Chuẩn bị nút xác nhận để khách ĐỔI cài đặt thư của tài khoản: bật/tắt thư nhắc trước giờ khởi hành, và ngôn ngữ nhận thư. " +
            "CHỈ gọi khi khách chủ động muốn đổi một trong hai cài đặt đó, ví dụ 'đừng gửi thư nhắc chuyến nữa' hay 'gửi email cho tôi bằng tiếng Anh'. " +
            "KHÔNG gọi khi khách chỉ viết bằng thứ tiếng khác hoặc muốn trợ lý trả lời bằng thứ tiếng khác. " +
            "Công cụ KHÔNG tự đổi: cài đặt chỉ đổi khi khách bấm nút xác nhận hiện dưới câu trả lời. " +
            "Không tắt được thư xác nhận vé, thư báo hoãn/huỷ chuyến hay thư hoàn tiền.");
        mailPreferencesFn.put("parameters", Map.of(
            "type", "object",
            "properties", Map.of(
                "tripReminders", Map.of(
                    "type", "string",
                    "description", "'on' để bật, 'off' để tắt thư nhắc trước giờ khởi hành. Khách không nhắc tới "
                            + "thư nhắc thì truyền giá trị rỗng ''."
                ),
                "language", Map.of(
                    "type", "string",
                    "description", "Ngôn ngữ nhận thư: 'vi' (tiếng Việt), 'en' (tiếng Anh), 'ja' (tiếng Nhật), "
                            + "'zh' (tiếng Trung). Khách không nhắc tới ngôn ngữ thì truyền giá trị rỗng ''."
                )
            )
        ));
        tools.add(Map.of("type", "function", "function", mailPreferencesFn));

        return tools;
    }
}
