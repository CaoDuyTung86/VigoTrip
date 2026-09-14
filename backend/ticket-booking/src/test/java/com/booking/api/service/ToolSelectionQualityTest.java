package com.booking.api.service;

import com.booking.api.ai.llm.LlmBudgetGuard;
import com.booking.api.ai.llm.LlmProperties;
import com.booking.api.ai.llm.LlmProvider;
import com.booking.api.ai.llm.LlmProviderException;
import com.booking.api.ai.llm.LlmRouter;
import com.booking.api.ai.llm.LlmTask;
import com.booking.api.ai.llm.OpenAiCompatibleProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Đo chất lượng CHỌN TOOL trên bộ câu hỏi vàng ({@code tool-eval.yml}).
 *
 * <p>{@code RagRetrievalQualityTest} đo một quyết định: tìm đúng đoạn tri thức chưa. Bộ này đo
 * quyết định còn lại, và là quyết định đắt hơn — mỗi lần chọn sai một tool là một truy vấn thật
 * vào cơ sở dữ liệu, hoặc một câu trả lời bịa vì không tra gì cả.
 *
 * <p><b>HAI CHẾ ĐỘ CHẠY.</b>
 *
 * <p>1. Mặc định (offline, luôn chạy trong CI): chưa gọi model, chỉ đối chiếu bộ câu hỏi vàng với
 * ĐỊNH NGHĨA TOOL THẬT và với khối hướng dẫn tool thật trong system prompt. Không gọi mạng, không
 * cần API key. Đây là chốt chặn chống thoái lui: đổi tên tool, bỏ một tham số, thêm tool thứ bảy
 * mà quên viết ca đo cho nó — build đỏ ngay.
 *
 * <p>2. Chế độ live (thủ công): đặt {@code TOOL_EVAL_LIVE=1} cùng {@code GEMINI_API_KEY} và/hoặc
 * {@code GROQ_API_KEY} để đo thật. Có gọi API nên KHÔNG chạy trong CI:
 *
 * <pre>
 *   TOOL_EVAL_LIVE=1 GEMINI_API_KEY=... GROQ_API_KEY=... ./mvnw test -Dtest=ToolSelectionQualityTest
 * </pre>
 *
 * <p><b>Đường đi được đo là đường thật.</b> Bộ đo không tự dựng lại một vòng function calling của
 * riêng nó: nó gọi {@link AIService#getChatResponse} với đúng {@link LlmRouter} thu hẹp về một nhà
 * cung cấp, nên định nghĩa tool, trần số vòng, trần số lần chạy tool và luật "lượt cuối không kèm
 * tool" đều là bản đang chạy trên production.
 *
 * <p><b>Prompt thì KHÔNG phải bản đầy đủ, và đây là giới hạn cần nói rõ.</b> Bộ đo gửi: vai trò,
 * thời gian hiện tại, danh tính khách đã đăng nhập, {@link ChatService#toolUsageGuide} và dòng
 * ngôn ngữ. Prompt thật còn có tri thức RAG đã truy hồi và danh sách mã giảm giá đã cá nhân hóa —
 * hai thứ đó lấy từ cơ sở dữ liệu, mà một cây thước phụ thuộc nội dung cơ sở dữ liệu thì hôm nay
 * đo một kiểu, mai đo một kiểu. Chúng cũng đẩy theo chiều dễ đoán: có sẵn tri thức để trả lời thì
 * model gọi tool ÍT hơn. Vậy nên coi "gọi thừa" ở đây là chặn trên chứ không phải con số vận hành.
 */
class ToolSelectionQualityTest {

    /**
     * Ngưỡng tối thiểu cho nhà cung cấp chính, tách theo NGÔN NGỮ CÂU HỎI.
     *
     * <p>Tách theo ngôn ngữ vì cùng một bộ tool nhưng mô tả tool viết bằng tiếng Việt: câu hỏi
     * tiếng Nhật và tiếng Trung phải bắc qua một nhịp dịch nữa mới tới được tên tool. Gộp một
     * ngưỡng chung thì hai mươi ca tiếng Việt sẽ kéo năm ca tiếng Nhật qua vạch.
     *
     * <p>Thêm ngôn ngữ vào {@code tool-eval.yml} thì phải thêm ngưỡng ở đây, nếu không test fail
     * ngay — cố ý, để không ai lỡ thêm ca đo mà quên chốt chặn.
     *
     * <p>Lần đo ngày 13/09/2026 cho 100% ở cả bốn ngôn ngữ (bảng ở {@code docs/CHATBOT_AI.md}
     * mục 6.8), nhưng ngưỡng KHÔNG chốt ở 100%: đo ở nhiệt độ 0.7 của production nên mỗi lần
     * chạy là một lần lấy mẫu, và lần đo trước đó đã có đúng một ca lệch tham số mà chạy lại
     * không lặp lại. Ngưỡng đặt sát mép thì đỏ vì dao động chứ không vì hệ thống tệ đi.
     */
    private static final Map<String, Double> MIN_EXACT_SET = Map.of(
            "vi", 0.85, "en", 0.85, "ja", 0.80, "zh", 0.80);
    private static final Map<String, Double> MIN_MICRO_F1 = Map.of(
            "vi", 0.90, "en", 0.90, "ja", 0.85, "zh", 0.85);

    /**
     * Trần cho tỉ lệ gọi tool ở những câu lẽ ra không cần tra gì.
     *
     * <p>Chỉ áp cho ngôn ngữ có từ {@link #MIN_NO_TOOL_CASES} ca "không cần tool" trở lên. Tiếng
     * Nhật và tiếng Trung mỗi thứ hiện chỉ có một ca như vậy, nên mọi con số đo được ở đó chỉ có
     * thể là 0% hoặc 100% — một cây thước hai vạch thì chốt gì cũng vô nghĩa. Dòng gộp có đủ ca
     * và được chốt riêng.
     */
    private static final Map<String, Double> MAX_FALSE_CALL = Map.of(
            "vi", 0.25, "en", 0.50, "ja", 1.00, "zh", 1.00);
    private static final double MAX_FALSE_CALL_ALL_LANGS = 0.20;
    private static final int MIN_NO_TOOL_CASES = 4;

    /** Ngưỡng cho tỉ lệ tham số khớp, chốt trên dòng gộp vì nhiều ca không khai tham số nào. */
    private static final double MIN_ARG_ACCURACY = 0.85;

    /** Khóa của dòng chấm gộp mọi ngôn ngữ trong bảng kết quả. */
    private static final String ALL_LANGS = "gộp";

    /** Múi giờ dùng để quy ${today}/${tomorrow} ra ngày thật — cùng múi giờ prompt đang nói. */
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Danh sách mã điểm nhồi vào hướng dẫn tool. Cố định để bộ đo không phụ thuộc cơ sở dữ liệu. */
    private static final String EVAL_LOCATIONS = "HAN, SGN, DAD, HPH, HUE, VIN, SAP, QNH, NTR, DLT, PQC, VCL";

    private static final String EVAL_USER = "khach@vigotrip.test";

    // ------------------------------------------------------------------ mô hình dữ liệu

    /**
     * @param expect tool BẮT BUỘC phải gọi; rỗng nghĩa là câu này không được gọi tool nào
     * @param allow  tool gọi thêm thì không tính đúng cũng không tính sai
     * @param args   tham số phải khớp, theo từng tool; giá trị có thể liệt kê nhiều cách viết
     *               được chấp nhận, cách nhau bằng dấu |
     * @param forbid tham số tuyệt đối không được xuất hiện
     */
    private record EvalCase(String utterance, Set<String> expect, Set<String> allow,
                            Map<String, Map<String, String>> args,
                            Map<String, Map<String, String>> forbid,
                            String lang, String note) {
    }

    private record Call(String tool, Map<String, Object> args) {
    }

    /**
     * Kết quả chạy một ca.
     *
     * @param providerCalls số lần gọi tới nhà cung cấp. Đây là phần hóa đơn của ca này, và là lý
     *                      do "gọi thừa" không chỉ là chuyện sạch sẽ: mỗi tool xin thêm là thêm
     *                      một vòng gọi model nữa.
     */
    private record Outcome(EvalCase evalCase, List<Call> calls, int providerCalls) {
    }

    /**
     * Tập chỉ số của một cấu hình.
     *
     * <p>Khác với truy hồi có xếp hạng, chọn tool là bài phân loại NHIỀU NHÃN không xếp hạng, nên
     * precision/recall/F1 dùng được đúng định nghĩa nguyên bản, không cần @k.
     *
     * @param exactSet     tỉ lệ ca mà TẬP tool gọi ra khớp hoàn toàn: không thiếu, không thừa.
     *                     Đây là chỉ số gần nhất với "accuracy" và là chỉ số khắt khe nhất —
     *                     một ca cần hai tool mà gọi đúng một thì tính trượt.
     * @param microF1      gộp mọi lời gọi của mọi ca rồi mới tính. Ca nhiều tool vì thế nặng hơn.
     * @param macroF1      trung bình F1 của từng tool, mỗi tool một phiếu ngang nhau. Đọc kèm
     *                     microF1: một tool ít gặp mà sai hẳn sẽ lộ ở đây chứ không lộ ở micro.
     * @param falseCall    tỉ lệ ca KHÔNG cần tool mà vẫn gọi tool. -1 khi cấu hình không có ca nào.
     * @param noToolCases  số ca "không cần tool" — mẫu số của falseCall, in kèm vì với năm ca thì
     *                     một ca lệch đã là 20% và con số ấy dễ bị đọc quá nặng.
     * @param missed       tỉ lệ ca thiếu ít nhất một tool bắt buộc — phần dễ thành câu trả lời bịa.
     * @param argAccuracy  tỉ lệ tham số khớp trên tổng tham số có khai. Tool không được gọi thì
     *                     mọi tham số của nó tính là trượt.
     * @param forbidHits   số lần truyền đúng giá trị bị cấm. Phải bằng 0; khác 0 là lỗi âm thầm
     *                     kiểu Quy Nhơn=QNH: gọi đúng tool, tra đúng cơ sở dữ liệu, sai tỉnh.
     * @param hardFailures số ca không nhận được câu trả lời nào vì nhà cung cấp hỏng. Khác 0 thì
     *                     mọi con số còn lại của cấu hình đó KHÔNG dùng được.
     */
    private record Metrics(String name, int cases,
                           double exactSet, double microP, double microR, double microF1,
                           double macroF1, double falseCall, int noToolCases, int falseCalls,
                           double missed, double argAccuracy,
                           int forbidHits, double avgProviderCalls, double avgToolRuns,
                           int hardFailures, List<String> details) {
    }

    private record PerTool(String tool, int support, int tp, int fp, int fn) {

        double precision() {
            return tp + fp == 0 ? 1.0 : (double) tp / (tp + fp);
        }

        double recall() {
            return tp + fn == 0 ? 1.0 : (double) tp / (tp + fn);
        }

        double f1() {
            double p = precision();
            double r = recall();
            return p + r == 0 ? 0.0 : 2 * p * r / (p + r);
        }
    }

    // ------------------------------------------------------------------ nạp dữ liệu

    private static String lang(Object raw) {
        String value = raw == null ? "" : String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        return value.isBlank() ? "vi" : value;
    }

    @SuppressWarnings("unchecked")
    private static Set<String> tools(Object raw) {
        if (raw == null) {
            return Set.of();
        }
        return new LinkedHashSet<>((List<String>) raw);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Map<String, String>> argMap(Object raw) {
        if (raw == null) {
            return Map.of();
        }
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        ((Map<String, Object>) raw).forEach((tool, spec) -> {
            Map<String, String> pairs = new LinkedHashMap<>();
            ((Map<String, Object>) spec).forEach((key, value) -> pairs.put(key, String.valueOf(value)));
            result.put(tool, pairs);
        });
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<EvalCase> loadEvalCases() throws IOException {
        List<EvalCase> cases = new ArrayList<>();
        try (InputStream in = new ClassPathResource("tool-eval.yml").getInputStream()) {
            for (Object entry : (List<Object>) new Yaml().load(in)) {
                Map<String, Object> map = (Map<String, Object>) entry;
                cases.add(new EvalCase(
                        String.valueOf(map.get("utterance")),
                        tools(map.get("expect")),
                        tools(map.get("allow")),
                        argMap(map.get("args")),
                        argMap(map.get("forbid")),
                        lang(map.get("lang")),
                        map.get("note") == null ? "" : String.valueOf(map.get("note")).trim()));
            }
        }
        return cases;
    }

    // ------------------------------------------------------------------ hạ tầng gọi AIService

    /** Nhà cung cấp giả dùng để lấy ĐỊNH NGHĨA TOOL THẬT mà không cần gọi mạng. */
    private static final class CapturingProvider implements LlmProvider {

        private List<Map<String, Object>> captured;

        @Override
        public String name() {
            return "capture";
        }

        @Override
        public String model() {
            return "capture";
        }

        @Override
        public int maxTokens() {
            return 800;
        }

        @Override
        public double temperature() {
            return 0.0;
        }

        @Override
        public Map<String, Object> chatCompletion(List<Map<String, Object>> messages,
                                                  List<Map<String, Object>> tools,
                                                  double temperature, int maxTokens) {
            if (captured == null && tools != null) {
                captured = tools;
            }
            return Map.of("role", "assistant", "content", "xong");
        }

        @Override
        public void streamCompletion(List<Map<String, Object>> messages, double temperature,
                                     int maxTokens, Consumer<String> chunkConsumer) {
            chunkConsumer.accept("xong");
        }
    }

    /**
     * Bọc quanh nhà cung cấp thật: giãn nhịp gọi, thử lại khi dính 429, và ĐẾM số lời gọi hỏng hẳn.
     *
     * <p>Giãn nhịp là bắt buộc chứ không phải cho lịch sự — bài học lấy nguyên từ bộ đo RAG. Khi
     * một lời gọi hỏng, {@link AIService} bắt lấy và trả về câu xin lỗi, tức là ca đó được chấm
     * thành "không gọi tool nào". Trên bảng điểm nó trông y như một ca model bỏ tra, mà thực chất
     * là ta không hỏi được. Không đếm thì không có cách nào phân biệt.
     */
    private static final class ThrottledProvider implements LlmProvider {

        private static final long MIN_INTERVAL_MS = 1_500;
        private static final long RETRY_AFTER_429_MS = 20_000;
        private static final int MAX_RETRIES = 3;

        private final LlmProvider delegate;
        private final double temperature;

        private int calls;
        private int rateLimitRetries;
        private int hardFailures;
        private long lastCallAt;

        ThrottledProvider(LlmProvider delegate, double temperature) {
            this.delegate = delegate;
            this.temperature = temperature;
        }

        private static void sleep(long ms) {
            try {
                Thread.sleep(ms);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Bị ngắt khi đang chờ throttle", e);
            }
        }

        private void throttle() {
            long waitMs = MIN_INTERVAL_MS - (System.currentTimeMillis() - lastCallAt);
            if (waitMs > 0) {
                sleep(waitMs);
            }
            lastCallAt = System.currentTimeMillis();
        }

        @Override
        public String name() {
            return delegate.name();
        }

        @Override
        public String model() {
            return delegate.model();
        }

        @Override
        public int maxTokens() {
            return delegate.maxTokens();
        }

        @Override
        public double temperature() {
            return temperature;
        }

        @Override
        public Map<String, Object> chatCompletion(List<Map<String, Object>> messages,
                                                  List<Map<String, Object>> tools,
                                                  double ignoredTemperature, int maxTokens) {
            RuntimeException last = null;
            for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                throttle();
                calls++;
                try {
                    return delegate.chatCompletion(messages, tools, temperature, maxTokens);
                } catch (LlmProviderException e) {
                    boolean rateLimited = e.getStatusCode() != null && e.getStatusCode() == 429;
                    if (!rateLimited) {
                        hardFailures++;
                        throw e;
                    }
                    last = e;
                    if (attempt == MAX_RETRIES) {
                        break;
                    }
                    rateLimitRetries++;
                    long waitMs = RETRY_AFTER_429_MS * (attempt + 1L);
                    System.out.printf("[Live] %s dính 429 (lần %d/%d), chờ %ds rồi thử lại...%n",
                            name(), attempt + 1, MAX_RETRIES, waitMs / 1000);
                    sleep(waitMs);
                    lastCallAt = System.currentTimeMillis();
                }
            }
            hardFailures++;
            throw last;
        }

        @Override
        public void streamCompletion(List<Map<String, Object>> messages, double ignoredTemperature,
                                     int maxTokens, Consumer<String> chunkConsumer) {
            throw new UnsupportedOperationException("Bộ đo chọn tool không dùng nhánh stream");
        }
    }

    /** AIService thật, nhưng router thu hẹp về đúng một nhà cung cấp để không có failover xen vào. */
    private AIService aiServiceOn(LlmProvider provider) {
        LlmRouter router = mock(LlmRouter.class);
        when(router.execute(any(LlmTask.class), any())).thenAnswer(invocation -> {
            Function<LlmProvider, Object> action = invocation.getArgument(1);
            return action.apply(provider);
        });

        LlmBudgetGuard budgetGuard = mock(LlmBudgetGuard.class);
        when(budgetGuard.tryConsume()).thenReturn(true);

        return new AIService(router, new LlmProperties(), budgetGuard);
    }

    /**
     * Lấy định nghĩa tool THẬT bằng cách chạy đúng vòng function calling rồi bắt lại tham số
     * {@code tools} mà nó gửi đi.
     *
     * <p>Cố ý không thò tay vào {@code buildToolsDefinition}: đọc lại đúng thứ đã đi trên đường
     * dây thì không có chỗ nào cho một bản sao lệch pha trú.
     */
    private List<Map<String, Object>> realToolDefinitions() {
        CapturingProvider provider = new CapturingProvider();
        aiServiceOn(provider).getChatResponse("system", List.of(), "câu hỏi bất kỳ", (name, args) -> "[]");
        assertThat(provider.captured).as("không bắt được định nghĩa tool nào").isNotNull();
        return provider.captured;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> functionOf(Map<String, Object> toolDefinition) {
        return (Map<String, Object>) toolDefinition.get("function");
    }

    @SuppressWarnings("unchecked")
    private static Set<String> parameterNames(Map<String, Object> toolDefinition) {
        Map<String, Object> parameters = (Map<String, Object>) functionOf(toolDefinition).get("parameters");
        if (parameters == null) {
            return Set.of();
        }
        Map<String, Object> properties = (Map<String, Object>) parameters.get("properties");
        return properties == null ? Set.of() : properties.keySet();
    }

    private static Map<String, Map<String, Object>> catalogByName(List<Map<String, Object>> definitions) {
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (Map<String, Object> definition : definitions) {
            byName.put(String.valueOf(functionOf(definition).get("name")), definition);
        }
        return byName;
    }

    // ------------------------------------------------------------------ kết quả tool giả lập

    /**
     * Kết quả giả cho mỗi tool.
     *
     * <p>Phải có nội dung thật chứ không được trả rỗng: ca nối chuỗi chỉ chạy được nếu kết quả
     * bước một thực sự cho biết bước hai phải tra ở đâu. Trả {@code []} thì model không còn gì để
     * nối, và ca "vé sắp đi của tôi tới đâu, chỗ đó thời tiết thế nào" sẽ bị chấm trượt vì lỗi của
     * bộ đo chứ không phải lỗi của model.
     */
    private static String stubResult(String tool) {
        return switch (tool) {
            case "search_trips" -> "[{\"tripId\":101,\"route\":\"HAN-DAD\",\"provider\":\"VigoAir\","
                    + "\"vehicleType\":\"PLANE\",\"departAt\":\"07:30\",\"price\":1290000}]";
            case "get_user_bookings" -> "[{\"bookingId\":2,\"route\":\"HAN-DAD\","
                    + "\"destination\":\"Đà Nẵng\",\"departAt\":\"07:30 14/09/2026\",\"status\":\"PAID\"}]";
            case "get_booking_by_id" -> "{\"bookingId\":2,\"route\":\"HAN-DAD\",\"status\":\"PAID\","
                    + "\"total\":1290000}";
            case "check_voucher" -> "{\"code\":\"SUMMER2026\",\"applicable\":true,\"discount\":45000}";
            case "get_addon_services" -> "[{\"category\":\"MEAL\",\"name\":\"Cơm gà xối mỡ\",\"price\":85000},"
                    + "{\"category\":\"BAGGAGE\",\"name\":\"Gói 20kg ký gửi\",\"price\":250000}]";
            case "get_weather_forecast" -> "{\"place\":\"Đà Nẵng\",\"tempC\":28,\"condition\":\"mưa rào\"}"
                    + " Kết quả này CHỈ mô tả thời tiết, không được dùng để suy ra chuyến đi có hoãn hay huỷ.";
            case "save_voucher" -> "ĐÃ CHUẨN BỊ NÚT XÁC NHẬN lưu mã. MÃ CHƯA ĐƯỢC LƯU: mã chỉ được lưu khi "
                    + "khách bấm nút xác nhận hiện dưới câu trả lời. TUYỆT ĐỐI KHÔNG nói là đã lưu.";
            case "update_mail_preferences" -> "ĐÃ CHUẨN BỊ NÚT XÁC NHẬN đổi cài đặt thư. CÀI ĐẶT CHƯA ĐỔI: cài "
                    + "đặt chỉ đổi khi khách bấm nút xác nhận hiện dưới câu trả lời. TUYỆT ĐỐI KHÔNG nói là đã đổi.";
            default -> "[]";
        };
    }

    // ------------------------------------------------------------------ chấm điểm

    /** Thay ${today}, ${tomorrow}, ${today+N} bằng ngày thật theo giờ Việt Nam. */
    private static String resolvePlaceholders(String expected) {
        LocalDate today = LocalDate.now(VN);
        String value = expected
                .replace("${today}", today.toString())
                .replace("${tomorrow}", today.plusDays(1).toString());
        while (value.contains("${today+")) {
            int start = value.indexOf("${today+");
            int end = value.indexOf('}', start);
            int days = Integer.parseInt(value.substring(start + 8, end));
            value = value.substring(0, start) + today.plusDays(days) + value.substring(end + 1);
        }
        return value;
    }

    /**
     * So một tham số model truyền lên với một giá trị mong đợi.
     *
     * <p>Chấp nhận nhiều cách viết cách nhau bằng {@code |}: mô tả tool cho phép cả tên nơi lẫn mã
     * điểm, nên phạt model vì chọn cách viết còn lại là chấm sai chứ không phải chấm khắt khe. Khi
     * giá trị mong đợi chỉ gồm chữ số thì bỏ mọi dấu phân cách ở giá trị thật trước khi so —
     * "300.000" và "300000" là cùng một số tiền.
     */
    private static boolean argMatches(Object actual, String expectedRaw) {
        if (actual == null) {
            return false;
        }
        String actualText = String.valueOf(actual).trim();
        for (String alternative : resolvePlaceholders(expectedRaw).split("\\|")) {
            String expected = alternative.trim();
            if (expected.isEmpty()) {
                continue;
            }
            if (actualText.equalsIgnoreCase(expected)) {
                return true;
            }
            if (expected.chars().allMatch(Character::isDigit)
                    && actualText.replaceAll("[^0-9]", "").equals(expected)) {
                return true;
            }
        }
        return false;
    }

    private Metrics evaluate(String name, List<Outcome> outcomes, Map<String, PerTool> perTool,
                             int hardFailures) {
        int exact = 0;
        int missedCases = 0;
        int noToolCases = 0;
        int falseCalls = 0;
        int tpSum = 0;
        int fpSum = 0;
        int fnSum = 0;
        int argMatched = 0;
        int argTotal = 0;
        int forbidHits = 0;
        int providerCalls = 0;
        int toolRuns = 0;
        List<String> details = new ArrayList<>();

        for (Outcome outcome : outcomes) {
            EvalCase evalCase = outcome.evalCase();
            Set<String> called = new LinkedHashSet<>();
            outcome.calls().forEach(call -> called.add(call.tool()));

            Set<String> missing = new LinkedHashSet<>(evalCase.expect());
            missing.removeAll(called);

            Set<String> extra = new LinkedHashSet<>(called);
            extra.removeAll(evalCase.expect());
            extra.removeAll(evalCase.allow());

            int tp = (int) called.stream().filter(evalCase.expect()::contains).count();
            tpSum += tp;
            fpSum += extra.size();
            fnSum += missing.size();

            for (String tool : evalCase.expect()) {
                PerTool stat = perTool.computeIfAbsent(tool, t -> new PerTool(t, 0, 0, 0, 0));
                perTool.put(tool, new PerTool(tool, stat.support() + 1,
                        stat.tp() + (called.contains(tool) ? 1 : 0), stat.fp(),
                        stat.fn() + (called.contains(tool) ? 0 : 1)));
            }
            for (String tool : extra) {
                PerTool stat = perTool.computeIfAbsent(tool, t -> new PerTool(t, 0, 0, 0, 0));
                perTool.put(tool, new PerTool(tool, stat.support(), stat.tp(), stat.fp() + 1, stat.fn()));
            }

            if (evalCase.expect().isEmpty()) {
                noToolCases++;
                if (!extra.isEmpty()) {
                    falseCalls++;
                }
            }
            if (!missing.isEmpty()) {
                missedCases++;
            }
            if (missing.isEmpty() && extra.isEmpty()) {
                exact++;
            }

            // Tham số: chỉ soi lời gọi ĐẦU TIÊN tới mỗi tool. Model gọi lại cùng tool với tham số
            // khác là chuyện bình thường khi nó tự sửa, nhưng lời gọi đầu mới cho biết nó hiểu câu
            // hỏi thế nào.
            List<String> argProblems = new ArrayList<>();
            for (Map.Entry<String, Map<String, String>> entry : evalCase.args().entrySet()) {
                Call call = outcome.calls().stream()
                        .filter(c -> c.tool().equals(entry.getKey())).findFirst().orElse(null);
                for (Map.Entry<String, String> pair : entry.getValue().entrySet()) {
                    argTotal++;
                    if (call == null) {
                        continue;
                    }
                    Object actual = call.args().get(pair.getKey());
                    if (argMatches(actual, pair.getValue())) {
                        argMatched++;
                    } else {
                        argProblems.add(String.format("%s.%s = %s (mong đợi %s)",
                                entry.getKey(), pair.getKey(), actual, pair.getValue()));
                    }
                }
            }

            List<String> forbidProblems = new ArrayList<>();
            for (Map.Entry<String, Map<String, String>> entry : evalCase.forbid().entrySet()) {
                for (Call call : outcome.calls()) {
                    if (!call.tool().equals(entry.getKey())) {
                        continue;
                    }
                    for (Map.Entry<String, String> pair : entry.getValue().entrySet()) {
                        if (argMatches(call.args().get(pair.getKey()), pair.getValue())) {
                            forbidHits++;
                            forbidProblems.add(entry.getKey() + "." + pair.getKey()
                                    + " = " + pair.getValue() + " (bị cấm)");
                        }
                    }
                }
            }

            providerCalls += outcome.providerCalls();
            toolRuns += outcome.calls().size();

            if (!missing.isEmpty() || !extra.isEmpty() || !argProblems.isEmpty()
                    || !forbidProblems.isEmpty()) {
                StringBuilder line = new StringBuilder();
                line.append(String.format("  \"%s\"%n    gọi %s", evalCase.utterance(),
                        called.isEmpty() ? "(không tool nào)" : called));
                if (!missing.isEmpty()) {
                    line.append(", THIẾU ").append(missing);
                }
                if (!extra.isEmpty()) {
                    line.append(", THỪA ").append(extra);
                }
                if (!argProblems.isEmpty()) {
                    line.append(String.format("%n    tham số lệch: %s", String.join("; ", argProblems)));
                }
                if (!forbidProblems.isEmpty()) {
                    line.append(String.format("%n    THAM SỐ BỊ CẤM: %s", String.join("; ", forbidProblems)));
                }
                if (!evalCase.note().isBlank()) {
                    line.append(String.format("%n    ghi chú: %s", evalCase.note()));
                }
                details.add(line.toString());
            }
        }

        int n = outcomes.size();
        double microP = tpSum + fpSum == 0 ? 1.0 : (double) tpSum / (tpSum + fpSum);
        double microR = tpSum + fnSum == 0 ? 1.0 : (double) tpSum / (tpSum + fnSum);
        double microF1 = microP + microR == 0 ? 0.0 : 2 * microP * microR / (microP + microR);
        double macroF1 = perTool.isEmpty() ? 0.0
                : perTool.values().stream().mapToDouble(PerTool::f1).average().orElse(0.0);

        return new Metrics(name, n,
                (double) exact / n, microP, microR, microF1, macroF1,
                noToolCases == 0 ? -1 : (double) falseCalls / noToolCases,
                noToolCases, falseCalls,
                (double) missedCases / n,
                argTotal == 0 ? 1.0 : (double) argMatched / argTotal,
                forbidHits, (double) providerCalls / n, (double) toolRuns / n,
                hardFailures, details);
    }

    private Map<String, Metrics> evaluateByLang(String baseName, List<Outcome> outcomes, int hardFailures) {
        Map<String, Metrics> byLang = new LinkedHashMap<>();
        List<String> langs = outcomes.stream().map(o -> o.evalCase().lang()).distinct().sorted().toList();

        for (String lang : langs) {
            List<Outcome> subset = outcomes.stream()
                    .filter(o -> o.evalCase().lang().equals(lang)).toList();
            byLang.put(lang, evaluate(baseName + " · " + lang, subset, new LinkedHashMap<>(), 0));
        }
        if (langs.size() > 1) {
            byLang.put(ALL_LANGS, evaluate(baseName + " · " + ALL_LANGS, outcomes,
                    new LinkedHashMap<>(), hardFailures));
        }
        return byLang;
    }

    // ------------------------------------------------------------------ in bảng

    private void printMainTable(List<Metrics> results) {
        System.out.println();
        System.out.println("==================== CHẤT LƯỢNG CHỌN TOOL ====================");
        System.out.printf("%-24s %4s %8s %7s %7s %7s %7s %11s %7s %7s%n",
                "Cấu hình", "Câu", "Khớp bộ", "P", "R", "F1", "macroF1", "Gọi thừa", "Bỏ tra", "Args");
        System.out.println("---------------------------------------------------------------"
                + "---------------------------");
        for (Metrics m : results) {
            System.out.printf("%-24s %4d %7.1f%% %7.3f %7.3f %7.3f %7.3f %11s %6.1f%% %6.1f%%%n",
                    m.name(), m.cases(), m.exactSet() * 100, m.microP(), m.microR(), m.microF1(),
                    m.macroF1(),
                    m.falseCall() < 0 ? "—"
                            : String.format("%d/%d", m.falseCalls(), m.noToolCases()),
                    m.missed() * 100, m.argAccuracy() * 100);
        }
        System.out.println("---------------------------------------------------------------"
                + "---------------------------");
        System.out.println("Khớp bộ  = tỉ lệ ca gọi đúng TẬP tool: không thiếu, không thừa");
        System.out.println("P/R/F1   = precision/recall/F1 vi mô, tính trên từng lời gọi tool");
        System.out.println("macroF1  = trung bình F1 của từng tool, mỗi tool một phiếu ngang nhau");
        System.out.println("Gọi thừa = số ca lẽ ra không cần tool mà vẫn gọi / tổng số ca như vậy");
        System.out.println("Bỏ tra   = tỉ lệ ca thiếu ít nhất một tool bắt buộc");
        System.out.println("Args     = tỉ lệ tham số khớp trên tổng tham số có khai trong tool-eval.yml");
        System.out.println("===============================================================");
    }

    private void printPerToolTable(String configName, Map<String, PerTool> perTool) {
        System.out.printf("%n--- [%s] từng tool ---%n", configName);
        System.out.printf("%-22s %4s %4s %4s %4s %7s %7s %7s%n",
                "Tool", "Cần", "TP", "FP", "FN", "P", "R", "F1");
        perTool.values().stream()
                .sorted((a, b) -> Integer.compare(b.support(), a.support()))
                .forEach(t -> System.out.printf("%-22s %4d %4d %4d %4d %7.3f %7.3f %7.3f%n",
                        t.tool(), t.support(), t.tp(), t.fp(), t.fn(),
                        t.precision(), t.recall(), t.f1()));
    }

    private void printCost(String configName, Metrics gop) {
        System.out.printf("%n--- [%s] chi phí một lượt ---%n", configName);
        System.out.printf("Lời gọi model trung bình mỗi câu: %.2f%n", gop.avgProviderCalls());
        System.out.printf("Lần chạy tool trung bình mỗi câu: %.2f%n", gop.avgToolRuns());
    }

    private void printDetails(List<Metrics> results) {
        for (Metrics m : results) {
            if (!m.details().isEmpty()) {
                System.out.printf("%n[%s] %d ca có vấn đề:%n", m.name(), m.details().size());
                m.details().forEach(System.out::println);
            }
        }
        System.out.println();
    }

    // ------------------------------------------------------------------ chế độ live

    private boolean liveModeEnabled() {
        return "1".equals(System.getenv("TOOL_EVAL_LIVE")) && !liveProviders().isEmpty();
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    /**
     * Nhà cung cấp nào có khóa thì nhà đó được đo. Cấu hình lấy đúng base URL và model mặc định
     * của {@code application.yml} để số đo nói về hệ thống thật chứ về một cấu hình chỉ có ở test.
     *
     * <p>Nhà ĐẦU TIÊN trong danh sách là nhà bị chốt ngưỡng; những nhà sau chỉ in ra để so.
     */
    private List<LlmProperties.Provider> liveProviders() {
        List<LlmProperties.Provider> providers = new ArrayList<>();

        String gemini = System.getenv("GEMINI_API_KEY");
        if (gemini != null && !gemini.isBlank()) {
            LlmProperties.Provider config = new LlmProperties.Provider();
            config.setName("gemini");
            config.setBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
            config.setApiKey(gemini);
            config.setModel(env("GEMINI_CHAT_MODEL", "gemini-flash-lite-latest"));
            config.setMaxTokens(800);
            providers.add(config);
        }

        String groq = System.getenv("GROQ_API_KEY");
        if (groq != null && !groq.isBlank()) {
            LlmProperties.Provider config = new LlmProperties.Provider();
            config.setName("groq");
            config.setBaseUrl("https://api.groq.com/openai/v1");
            config.setApiKey(groq);
            config.setModel(env("GROQ_CHAT_MODEL", "openai/gpt-oss-120b"));
            config.setMaxTokens(800);
            providers.add(config);
        }
        return providers;
    }

    /**
     * Nhiệt độ dùng khi đo. Mặc định lấy đúng 0.7 của production: hạ về 0 cho ra bảng điểm đẹp
     * hơn và ổn định hơn, nhưng đó không phải con số khách hàng đang gặp.
     */
    private double evalTemperature() {
        return Double.parseDouble(env("TOOL_EVAL_TEMPERATURE", "0.7"));
    }

    private LlmProvider buildLiveProvider(LlmProperties.Provider config) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(60));
        return new OpenAiCompatibleProvider(config, new RestTemplate(factory),
                java.net.http.HttpClient.newHttpClient(), new ObjectMapper());
    }

    /**
     * Prompt gửi khi đo. Chỉ gồm những phần KHÔNG phụ thuộc cơ sở dữ liệu, cộng với khối hướng
     * dẫn tool thật lấy từ {@link ChatService#toolUsageGuide}. Giới hạn của lựa chọn này đã nói
     * trong javadoc của lớp.
     */
    private String systemPromptFor(String language) {
        String currentTime = LocalDateTime.now(VN)
                .format(DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy"));
        return "Bạn là Trợ lý VigoTrip — trợ lý hỗ trợ khách hàng của nền tảng bán vé VigoTrip. "
                + "Thời gian hiện tại: " + currentTime + ".\n"
                + "Email khách hàng hiện tại: " + EVAL_USER + ".\n\n"
                + ChatService.toolUsageGuide(EVAL_LOCATIONS)
                + "NGÔN NGỮ GIAO TIẾP HIỆN TẠI LÀ: " + language + ".";
    }

    private List<Outcome> runLive(LlmProvider provider, List<EvalCase> cases) {
        List<Outcome> outcomes = new ArrayList<>();
        AIService aiService = aiServiceOn(provider);

        for (EvalCase evalCase : cases) {
            List<Call> calls = new ArrayList<>();
            int before = provider instanceof ThrottledProvider t ? t.calls : 0;

            AIService.ToolHandler handler = (name, args) -> {
                calls.add(new Call(name, args == null ? Map.of() : new LinkedHashMap<>(args)));
                return stubResult(name);
            };

            try {
                aiService.getChatResponse(systemPromptFor(evalCase.lang()), List.of(),
                        evalCase.utterance(), handler);
            } catch (RuntimeException e) {
                System.out.printf("[Live] ✗ \"%s\" không chạy được: %s%n", evalCase.utterance(),
                        e.getMessage());
            }

            int after = provider instanceof ThrottledProvider t ? t.calls : 0;
            outcomes.add(new Outcome(evalCase, calls, Math.max(1, after - before)));
        }
        return outcomes;
    }

    // ------------------------------------------------------------------ test offline

    @Test
    @DisplayName("Bộ câu hỏi vàng khớp với định nghĩa tool thật, và phủ hết mọi tool")
    void boCauHoiVangKhopVoiDinhNghiaToolThat() throws IOException {
        List<EvalCase> cases = loadEvalCases();
        Map<String, Map<String, Object>> catalog = catalogByName(realToolDefinitions());

        assertThat(cases).as("bộ câu hỏi vàng không được rỗng").isNotEmpty();
        assertThat(catalog).as("không đọc được tool nào từ AIService").isNotEmpty();

        assertThat(cases.stream().map(EvalCase::utterance).distinct().count())
                .as("có câu hỏi bị lặp trong tool-eval.yml").isEqualTo(cases.size());

        for (EvalCase evalCase : cases) {
            assertThat(evalCase.utterance()).as("có ca đo thiếu câu hỏi").isNotBlank();

            Set<String> named = new LinkedHashSet<>(evalCase.expect());
            named.addAll(evalCase.allow());
            named.addAll(evalCase.args().keySet());
            named.addAll(evalCase.forbid().keySet());
            for (String tool : named) {
                assertThat(catalog)
                        .as("ca \"%s\" nhắc tới tool \"%s\" không còn tồn tại — tool vừa bị đổi tên "
                                + "hay bỏ đi thì phải sửa tool-eval.yml theo", evalCase.utterance(), tool)
                        .containsKey(tool);
            }

            List<Map<String, Map<String, String>>> specs = List.of(evalCase.args(), evalCase.forbid());
            for (Map<String, Map<String, String>> spec : specs) {
                for (Map.Entry<String, Map<String, String>> entry : spec.entrySet()) {
                    Set<String> schema = parameterNames(catalog.get(entry.getKey()));
                    for (String key : entry.getValue().keySet()) {
                        assertThat(schema)
                                .as("ca \"%s\" chấm tham số \"%s\" mà schema của %s không khai — "
                                        + "tham số vừa bị đổi tên hoặc bỏ đi",
                                        evalCase.utterance(), key, entry.getKey())
                                .contains(key);
                    }
                }
            }
        }

        // Thêm tool thứ bảy mà không viết ca đo cho nó thì nó không bao giờ được đo, và cái không
        // được đo là cái âm thầm hỏng. Fail ở đây là cố ý.
        for (String tool : catalog.keySet()) {
            assertThat(cases.stream().anyMatch(c -> c.expect().contains(tool)))
                    .as("tool \"%s\" chưa có ca đo nào trong tool-eval.yml", tool)
                    .isTrue();
        }

        // Không có ca "không cần tool" thì bộ đo chỉ biết khen model gọi nhiều, không biết phạt
        // model gọi thừa — mà gọi thừa là một vòng gọi model cộng một truy vấn thật.
        assertThat(cases.stream().filter(c -> c.expect().isEmpty()).count())
                .as("cần ít nhất 3 ca không được gọi tool nào để đo được việc gọi thừa")
                .isGreaterThanOrEqualTo(3);

        for (String lang : cases.stream().map(EvalCase::lang).distinct().toList()) {
            assertThat(MIN_EXACT_SET)
                    .as("tool-eval.yml có câu tiếng \"%s\" nhưng chưa khai ngưỡng cho ngôn ngữ này",
                            lang)
                    .containsKey(lang);
            assertThat(MIN_MICRO_F1).containsKey(lang);
            assertThat(MAX_FALSE_CALL).containsKey(lang);
        }
    }

    @Test
    @DisplayName("Hai tool sinh ra để chặn bịa đặt vẫn giữ câu BẮT BUỘC trong mô tả")
    void haiToolChanBiaDatVanGiuCauBatBuoc() {
        Map<String, Map<String, Object>> catalog = catalogByName(realToolDefinitions());

        // get_addon_services và get_weather_forecast tồn tại vì thiếu chúng thì model bịa ra thực
        // đơn kèm giá, và bịa ra thời tiết. Với hai tool đó, "gọi khi cần" là chưa đủ mạnh: mô tả
        // phải nói BẮT BUỘC gọi trước khi nói bất cứ điều gì về chủ đề ấy. Câu này bị làm nhẹ đi
        // thì bảng điểm sẽ tụt, nhưng tụt muộn — sau cả một lần chạy live tốn tiền.
        for (String tool : List.of("get_addon_services", "get_weather_forecast")) {
            String description = String.valueOf(functionOf(catalog.get(tool)).get("description"));
            assertThat(description)
                    .as("mô tả của %s không còn câu BẮT BUỘC — đó là thứ duy nhất chặn model tự "
                            + "trả lời từ trí nhớ thay vì tra", tool)
                    .contains("BẮT BUỘC");
        }
    }

    @Test
    @DisplayName("Hướng dẫn trong system prompt nhắc tên đủ mọi tool")
    void huongDanTrongPromptNhacDuTenTool() {
        String guide = ChatService.toolUsageGuide(EVAL_LOCATIONS);

        // Định nghĩa tool đi trong trường `tools` của request, hướng dẫn đi trong system prompt.
        // Thêm tool mà quên nhắc trong prompt thì model vẫn "thấy" nó, nhưng mất phần chỉ dẫn khi
        // nào nên gọi — đúng chỗ mà kỷ luật gọi tool rơi xuống.
        for (String tool : catalogByName(realToolDefinitions()).keySet()) {
            assertThat(guide)
                    .as("khối HƯỚNG DẪN DÙNG CÔNG CỤ chưa nhắc tới tool \"%s\"", tool)
                    .contains(tool);
        }
        assertThat(guide).as("hướng dẫn phải nhồi được danh sách mã điểm đang hoạt động")
                .contains(EVAL_LOCATIONS);
    }

    // ------------------------------------------------------------------ test live

    @Test
    @DisplayName("Chất lượng chọn tool đạt ngưỡng, và in bảng chỉ số đầy đủ")
    void doChatLuongChonTool() throws IOException {
        if (!liveModeEnabled()) {
            System.out.println();
            System.out.println("[Bỏ qua bộ đo chọn tool] Đặt TOOL_EVAL_LIVE=1 cùng GEMINI_API_KEY "
                    + "và/hoặc GROQ_API_KEY để đo thật.");
        }
        assumeTrue(liveModeEnabled(), "cần TOOL_EVAL_LIVE=1 và ít nhất một API key");

        List<EvalCase> cases = loadEvalCases();
        List<LlmProperties.Provider> configs = liveProviders();
        double temperature = evalTemperature();

        System.out.printf("%n[Live] %d ca đo, %d nhà cung cấp, nhiệt độ %.2f%n",
                cases.size(), configs.size(), temperature);

        List<Metrics> allResults = new ArrayList<>();
        Map<String, Metrics> primaryByLang = null;
        Map<String, Integer> hardFailuresByProvider = new LinkedHashMap<>();

        for (LlmProperties.Provider config : configs) {
            ThrottledProvider provider = new ThrottledProvider(buildLiveProvider(config), temperature);
            String name = config.getName() + " (" + config.getModel() + ")";
            System.out.printf("%n[Live] Đang đo %s...%n", name);

            List<Outcome> outcomes = runLive(provider, cases);
            Map<String, Metrics> byLang = evaluateByLang(config.getName(), outcomes,
                    provider.hardFailures);

            Map<String, PerTool> perTool = new LinkedHashMap<>();
            Metrics gop = evaluate(config.getName() + " · " + ALL_LANGS, outcomes, perTool,
                    provider.hardFailures);

            allResults.addAll(byLang.values());
            printPerToolTable(name, perTool);
            printCost(name, gop);

            System.out.printf("Lời gọi model: %d, số lần phải thử lại vì 429: %d, hỏng hẳn: %d%n",
                    provider.calls, provider.rateLimitRetries, provider.hardFailures);

            hardFailuresByProvider.put(config.getName(), provider.hardFailures);
            if (primaryByLang == null) {
                primaryByLang = byLang;
            }
        }

        // In TRƯỚC rồi mới chốt. Nhà cung cấp thứ hai cạn hạn mức là chuyện thường gặp, và nếu
        // chốt ngay trong vòng lặp thì cả bảng của nhà thứ nhất — vốn đã đo xong sạch sẽ — biến
        // mất theo. Một lần chạy tốn vài phút gọi API thì không được phép mất số vì thứ tự in.
        printMainTable(allResults);
        printDetails(allResults);

        // Cùng bài học với bộ đo RAG: AIService bắt lỗi nhà cung cấp rồi trả câu xin lỗi, nên một
        // ca hỏng vì rate limit trông y hệt một ca model bỏ tra. Thà fail còn hơn in ra một con số
        // không biết là của cái gì.
        hardFailuresByProvider.forEach((providerName, failures) ->
                assertThat(failures)
                        .as("có %d lời gọi tới %s hỏng hẳn — những ca đó bị chấm thành 'không gọi "
                                + "tool nào' nên bảng của nhà cung cấp này KHÔNG dùng được. Chờ hết "
                                + "hạn mức rồi chạy lại.", failures, providerName)
                        .isZero());

        assertMeetsThresholds(primaryByLang);
    }

    /**
     * Chốt chặn cho nhà cung cấp chính: từng ngôn ngữ phải tự đạt ngưỡng của nó.
     *
     * <p>Chất lượng chọn tool chốt theo TỪNG ngôn ngữ, vì hai mươi ca tiếng Việt có thể kéo năm
     * ca tiếng Nhật qua vạch. Hai chỉ số có mẫu số nhỏ — tỉ lệ gọi thừa và tỉ lệ khớp tham số —
     * thì chốt ở DÒNG GỘP, nơi mẫu số đủ lớn để con số nói được điều gì.
     */
    private void assertMeetsThresholds(Map<String, Metrics> byLang) {
        for (Map.Entry<String, Metrics> entry : byLang.entrySet()) {
            String lang = entry.getKey();
            Metrics m = entry.getValue();

            if (ALL_LANGS.equals(lang)) {
                assertThat(m.falseCall())
                        .as("\"%s\" gọi tool ở %d trong %d câu lẽ ra không cần tra — mỗi lần như "
                                + "vậy là một vòng gọi model cộng một truy vấn thật",
                                m.name(), m.falseCalls(), m.noToolCases())
                        .isLessThanOrEqualTo(MAX_FALSE_CALL_ALL_LANGS);
                assertThat(m.argAccuracy())
                        .as("tỉ lệ tham số khớp của \"%s\" tụt dưới ngưỡng — gọi đúng tool nhưng "
                                + "truyền sai thì vẫn tra ra kết quả của câu hỏi khác", m.name())
                        .isGreaterThanOrEqualTo(MIN_ARG_ACCURACY);
                continue;
            }

            assertThat(m.forbidHits())
                    .as("cấu hình \"%s\" truyền %d lần tham số bị cấm — gọi đúng tool nhưng tra sai "
                            + "chỗ, kiểu lỗi không ném ra ngoại lệ nào", m.name(), m.forbidHits())
                    .isZero();
            assertThat(m.exactSet())
                    .as("tỉ lệ khớp bộ tool của \"%s\" tụt dưới ngưỡng — kiểm tra thay đổi ở mô tả "
                            + "tool, khối hướng dẫn trong prompt, hoặc model vừa bị đổi", m.name())
                    .isGreaterThanOrEqualTo(MIN_EXACT_SET.get(lang));
            assertThat(m.microF1())
                    .as("F1 vi mô của \"%s\" tụt dưới ngưỡng", m.name())
                    .isGreaterThanOrEqualTo(MIN_MICRO_F1.get(lang));
            // Mẫu số dưới 4 ca thì bỏ qua: với một ca, con số chỉ có thể là 0% hoặc 100%, và một
            // ngưỡng đặt trên cây thước hai vạch thì chỉ tạo ra tiếng ồn.
            if (m.noToolCases() >= MIN_NO_TOOL_CASES) {
                assertThat(m.falseCall())
                        .as("\"%s\" gọi tool ở %d trong %d câu lẽ ra không cần tra", m.name(),
                                m.falseCalls(), m.noToolCases())
                        .isLessThanOrEqualTo(MAX_FALSE_CALL.get(lang));
            }
        }
    }
}
