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
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    /**
     * Đúng tập mã mà prompt nói là "đang hoạt động", tách sẵn để chấm.
     *
     * <p>Thêm ngày 16/09 sau khi thăm dò ca Quy Nhơn (xem experiments.md mục 16/09 (c)). Ca đó
     * chỉ cấm đúng một giá trị là QNH, nên bộ đo chấm ĐẠT cho 12/12 lần model truyền
     * {@code destination=UIH} — mã IATA thật của sân bay Phù Cát, đúng ngoài đời nhưng không có
     * trong hệ thống. Tức là hành vi xảy ra gần như mọi lần thì lọt lưới, còn biến thể hiếm mới
     * bị bắt. Cấm theo từng giá trị không đủ; phải chấm theo LUẬT.
     *
     * <p>Luật: {@code search_trips} chỉ được nhận mã nằm trong danh sách prompt vừa đưa cho nó.
     * Mã lạ không ném ra ngoại lệ nào — truy vấn chỉ không khớp tuyến nào rồi trả rỗng, và mã đó
     * còn đọng lại trong sessionCache làm điểm đến mặc định cho các lượt sau. Không đếm thì không
     * có cách nào thấy.
     */
    private static final Set<String> ACTIVE_CODES = Arrays.stream(EVAL_LOCATIONS.split(","))
            .map(String::trim).filter(c -> !c.isEmpty()).collect(Collectors.toUnmodifiableSet());

    /** Tham số của search_trips mang mã điểm; các tool khác nhận tên nơi nên không chấm ở đây. */
    private static final Set<String> LOCATION_ARGS = Set.of("origin", "destination");

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
     * @param maLaHits     số lần truyền mã điểm KHÔNG có trong danh sách đang hoạt động. Cùng họ
     *                     với forbidHits nhưng chấm theo luật thay vì theo từng giá trị liệt kê
     *                     sẵn, nên bắt được cả mã đúng ngoài đời mà hệ thống không có — xem
     *                     {@link #ACTIVE_CODES}.
     * @param hardFailures số ca không nhận được câu trả lời nào vì nhà cung cấp hỏng. Khác 0 thì
     *                     mọi con số còn lại của cấu hình đó KHÔNG dùng được.
     */
    private record Metrics(String name, int cases,
                           double exactSet, double microP, double microR, double microF1,
                           double macroF1, double falseCall, int noToolCases, int falseCalls,
                           double missed, double argAccuracy,
                           int forbidHits, int maLaHits,
                           double avgProviderCalls, double avgToolRuns,
                           int hardFailures, List<String> details) {
    }

    /**
     * Độ tản của một cấu hình qua N mẻ.
     *
     * <p>Có vì ngày 16/09 chạy ba mẻ trên cùng bộ 53 ca và thấy chênh lệch giữa hai mẻ của CÙNG
     * một model (qwen: 98.1% rồi 92.5% khớp bộ) lớn hơn chênh lệch giữa hai model. Một con số
     * trung bình đứng trơ trọi che mất chuyện đó, nên trung bình phải đi kèm khoảng.
     */
    private record Spread(String name, int runs, double exactMin, double exactMax,
                          double argMin, double argMax, int forbidTotal, int maLaTotal) {

        static Spread cua(String name, List<Metrics> cacMe) {
            return new Spread(name, cacMe.size(),
                    cacMe.stream().mapToDouble(Metrics::exactSet).min().orElse(0),
                    cacMe.stream().mapToDouble(Metrics::exactSet).max().orElse(0),
                    cacMe.stream().mapToDouble(Metrics::argAccuracy).min().orElse(0),
                    cacMe.stream().mapToDouble(Metrics::argAccuracy).max().orElse(0),
                    cacMe.stream().mapToInt(Metrics::forbidHits).sum(),
                    cacMe.stream().mapToInt(Metrics::maLaHits).sum());
        }
    }

    /**
     * Gộp N mẻ của cùng một cấu hình thành một bản ghi để chấm ngưỡng.
     *
     * <p>Tỉ lệ thì lấy TRUNG BÌNH: câu hỏi "model này thường đúng bao nhiêu phần trăm" chỉ có
     * nghĩa khi hỏi trên nhiều mẻ. Còn các bộ đếm không khoan nhượng — tham số bị cấm, mã điểm
     * lạ — thì lấy TỔNG, vì câu hỏi ở đó không phải "thường xuyên đến đâu" mà là "có xảy ra
     * không". Một lần tra sai tỉnh là một lần khách bị trả lời sai.
     */
    private static Metrics gopCacMe(String name, List<Metrics> cacMe, int hardFailures) {
        Metrics dau = cacMe.get(0);
        java.util.function.ToDoubleFunction<java.util.function.ToDoubleFunction<Metrics>> tb =
                f -> cacMe.stream().mapToDouble(f).average().orElse(0);

        Map<String, Integer> demChiTiet = new LinkedHashMap<>();
        cacMe.forEach(m -> m.details().forEach(d -> demChiTiet.merge(d, 1, Integer::sum)));
        List<String> details = demChiTiet.entrySet().stream()
                .map(e -> cacMe.size() == 1 || e.getValue() == cacMe.size()
                        ? e.getKey()
                        : String.format("  [%d/%d mẻ]%n%s", e.getValue(), cacMe.size(), e.getKey()))
                .toList();

        return new Metrics(name, dau.cases(),
                tb.applyAsDouble(Metrics::exactSet), tb.applyAsDouble(Metrics::microP),
                tb.applyAsDouble(Metrics::microR), tb.applyAsDouble(Metrics::microF1),
                tb.applyAsDouble(Metrics::macroF1), tb.applyAsDouble(Metrics::falseCall),
                dau.noToolCases(), cacMe.stream().mapToInt(Metrics::falseCalls).sum(),
                tb.applyAsDouble(Metrics::missed), tb.applyAsDouble(Metrics::argAccuracy),
                cacMe.stream().mapToInt(Metrics::forbidHits).sum(),
                cacMe.stream().mapToInt(Metrics::maLaHits).sum(),
                tb.applyAsDouble(Metrics::avgProviderCalls), tb.applyAsDouble(Metrics::avgToolRuns),
                hardFailures, details);
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

        /**
         * Nhịp tối thiểu giữa hai lời gọi, đặt theo hạn mức CHẶT nhất trong các nhà cung cấp
         * được đo — hiện là Gemini Flash-Lite free tier, 15 lượt/phút, tức 4 giây một lượt.
         *
         * <p>Trước đây để 1.500 ms (40 lượt/phút) cho "nhanh", và nó phản tác dụng: gần như lượt
         * nào cũng ăn 429, mỗi lần 429 lại nằm chờ RETRY_AFTER_429_MS = 20 giây. Đo ngày 16/09
         * thì một lượt chạy 53 ca mất gần một tiếng mà vẫn chưa xong nhà cung cấp đầu tiên. Đi
         * đúng nhịp 4 giây thì cùng bấy nhiêu ca gọn trong khoảng mười phút. Bài học: với endpoint
         * có hạn mức, throttle nhanh hơn hạn mức KHÔNG phải là chạy nhanh hơn.
         *
         * <p>Chỉ áp cho nhà cung cấp TỪ XA. Model chạy trên máy mình không có hạn mức nào để mà
         * tôn trọng, và từ khi bộ đo chạy nhiều mẻ thì bốn giây một lượt nhân 53 ca nhân N mẻ là
         * khoản chờ vô nghĩa duy nhất đủ lớn để làm người ta ngại chạy lại.
         */
        private static final long MIN_INTERVAL_MS = 4_000;
        private static final long RETRY_AFTER_429_MS = 20_000;
        private static final int MAX_RETRIES = 3;

        private final LlmProvider delegate;
        private final double temperature;
        private final long minIntervalMs;

        private int calls;
        private int rateLimitRetries;
        private int hardFailures;
        private long lastCallAt;

        ThrottledProvider(LlmProvider delegate, double temperature, boolean local) {
            this.delegate = delegate;
            this.temperature = temperature;
            this.minIntervalMs = local ? 0 : MIN_INTERVAL_MS;
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
            if (minIntervalMs <= 0) {
                return;
            }
            long waitMs = minIntervalMs - (System.currentTimeMillis() - lastCallAt);
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
        int maLaHits = 0;
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

            List<String> maLaProblems = new ArrayList<>();
            for (Call call : outcome.calls()) {
                if (!"search_trips".equals(call.tool())) {
                    continue;
                }
                for (String key : LOCATION_ARGS) {
                    Object raw = call.args().get(key);
                    String code = raw == null ? "" : String.valueOf(raw).trim();
                    if (code.isEmpty() || "null".equals(code) || ACTIVE_CODES.contains(code)) {
                        continue;
                    }
                    maLaHits++;
                    maLaProblems.add(key + " = " + code);
                }
            }

            providerCalls += outcome.providerCalls();
            toolRuns += outcome.calls().size();

            if (!missing.isEmpty() || !extra.isEmpty() || !argProblems.isEmpty()
                    || !forbidProblems.isEmpty() || !maLaProblems.isEmpty()) {
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
                if (!maLaProblems.isEmpty()) {
                    line.append(String.format("%n    MÃ KHÔNG CÓ TRONG HỆ THỐNG: %s (đang hoạt động: %s)",
                            String.join("; ", maLaProblems), EVAL_LOCATIONS));
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
                forbidHits, maLaHits, (double) providerCalls / n, (double) toolRuns / n,
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
        System.out.printf("%-24s %4s %8s %7s %7s %7s %7s %11s %7s %7s %6s %6s%n",
                "Cấu hình", "Câu", "Khớp bộ", "P", "R", "F1", "macroF1", "Gọi thừa", "Bỏ tra",
                "Args", "Cấm", "Mã lạ");
        System.out.println("---------------------------------------------------------------"
                + "---------------------------");
        for (Metrics m : results) {
            System.out.printf("%-24s %4d %7.1f%% %7.3f %7.3f %7.3f %7.3f %11s %6.1f%% %6.1f%% %6d %6d%n",
                    m.name(), m.cases(), m.exactSet() * 100, m.microP(), m.microR(), m.microF1(),
                    m.macroF1(),
                    m.falseCall() < 0 ? "—"
                            : String.format("%d/%d", m.falseCalls(), m.noToolCases()),
                    m.missed() * 100, m.argAccuracy() * 100, m.forbidHits(), m.maLaHits());
        }
        System.out.println("---------------------------------------------------------------"
                + "---------------------------");
        System.out.println("Khớp bộ  = tỉ lệ ca gọi đúng TẬP tool: không thiếu, không thừa");
        System.out.println("P/R/F1   = precision/recall/F1 vi mô, tính trên từng lời gọi tool");
        System.out.println("macroF1  = trung bình F1 của từng tool, mỗi tool một phiếu ngang nhau");
        System.out.println("Gọi thừa = số ca lẽ ra không cần tool mà vẫn gọi / tổng số ca như vậy");
        System.out.println("Bỏ tra   = tỉ lệ ca thiếu ít nhất một tool bắt buộc");
        System.out.println("Args     = tỉ lệ tham số khớp trên tổng tham số có khai trong tool-eval.yml");
        System.out.println("Cấm      = số lần truyền đúng một giá trị bị cấm liệt kê trong ca đo");
        System.out.println("Mã lạ    = số lần search_trips nhận mã điểm không có trong hệ thống");
        System.out.println("===============================================================");
    }

    private void printSpreadTable(List<Spread> spreads, int runs) {
        System.out.println();
        System.out.printf("============ ĐỘ TẢN QUA %d MẺ ============%n", runs);
        System.out.printf("%-24s %16s %16s %6s %6s%n",
                "Cấu hình", "Khớp bộ", "Args", "Cấm", "Mã lạ");
        System.out.println("--------------------------------------------------------------------");
        for (Spread s : spreads) {
            System.out.printf("%-24s %6.1f%% – %6.1f%% %6.1f%% – %6.1f%% %6d %6d%n",
                    s.name(), s.exactMin() * 100, s.exactMax() * 100,
                    s.argMin() * 100, s.argMax() * 100, s.forbidTotal(), s.maLaTotal());
        }
        System.out.println("--------------------------------------------------------------------");
        System.out.println("Khoảng nhỏ nhất – lớn nhất qua các mẻ. Bảng chính ở trên là TRUNG BÌNH,");
        System.out.println("riêng Cấm và Mã lạ là TỔNG: ở đó câu hỏi là có xảy ra không, không phải");
        System.out.println("thường xuyên đến đâu. Khoảng của một model rộng hơn khoảng cách giữa hai");
        System.out.println("model thì KHÔNG xếp hạng được, dù trung bình có chênh nhau.");
        System.out.println("====================================================================");
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

        // Model tự host. Không có khoá thật để dò như hai nhà trên, nên lấy OLLAMA_MODEL làm
        // công tắc: đặt biến đó thì đo, không đặt thì thôi. Server phải đang chạy.
        String ollama = System.getenv("OLLAMA_MODEL");
        if (ollama != null && !ollama.isBlank()) {
            LlmProperties.Provider config = new LlmProperties.Provider();
            config.setName("ollama");
            config.setBaseUrl(env("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"));
            // Ollama không kiểm khoá, nhưng isConfigured() loại nhà cung cấp có khoá rỗng.
            config.setApiKey("ollama");
            config.setModel(ollama);
            config.setMaxTokens(800);
            // Tắt suy nghĩ, đúng cấu hình đã đo ở tuần 10 của vi-rag-eval. Để bật thì model
            // tiêu hết 800 token cho phần reasoning và không kịp trả tool_calls.
            config.setExtraBody(Map.of("reasoning_effort", "none"));
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

    /** Endpoint nằm trên chính máy này thì không có hạn mức để mà giãn nhịp. */
    private static boolean isLocal(LlmProperties.Provider config) {
        String url = config.getBaseUrl() == null ? "" : config.getBaseUrl();
        return url.contains("127.0.0.1") || url.contains("localhost") || url.contains("[::1]");
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
        // Khối hướng dẫn nay ghi mã kèm tên nơi ("Hà Nội=HAN") thay cho danh sách mã trần — xem
        // ChatService.placeCodesWithNames — nên không so nguyên chuỗi EVAL_LOCATIONS được nữa.
        // Thứ phải giữ là: mã nào đang hoạt động cũng có mặt trong prompt.
        for (String code : ACTIVE_CODES) {
            assertThat(guide).as("khối hướng dẫn chưa nhồi mã điểm \"%s\"", code).contains(code);
        }
    }

    @Test
    @DisplayName("Hướng dẫn vẫn cấm model tự nghĩ ra mã điểm")
    void huongDanVanCamTuNghiRaMaDiem() {
        String guide = ChatService.toolUsageGuide(EVAL_LOCATIONS);

        // Ca "tìm vé đi Quy Nhơn" (16/09): prompt liệt kê mã trần và không có luật nào cho nơi
        // ngoài bảng, nên model truyền UIH 12/12 lần ở temperature 0. Luật này là thứ duy nhất
        // chặn chuyện đó từ phía prompt; bỏ nó đi thì bảng điểm chỉ đỏ sau một lần chạy live tốn
        // tiền, nên chốt lại ở đây.
        assertThat(guide)
                .as("hướng dẫn không còn cấm dùng mã ngoài danh sách")
                .contains("CHỈ ĐƯỢC DÙNG MÃ CÓ TRONG DANH SÁCH");
        assertThat(guide)
                .as("hướng dẫn không còn nêu hai kiểu đoán mã đã xảy ra thật")
                .contains("UIH")
                .contains("Quảng Ninh");

        // Mỗi mã đi kèm tên nơi nó trỏ tới: đó là nửa còn lại của bản sửa, và cũng là nửa dễ bị
        // gỡ đi nhất khi ai đó thấy prompt dài.
        for (String tenNoi : List.of("Hà Nội", "Hạ Long")) {
            assertThat(guide)
                    .as("mã điểm trong hướng dẫn không còn kèm tên nơi (\"%s\")", tenNoi)
                    .contains(tenNoi);
        }
    }

    // ------------------------------------------------------------------ test thăm dò

    /**
     * Chạy ĐÚNG một ca nhiều lần và in tham số của từng lần.
     *
     * <p>Sinh ra từ một câu hỏi mà bảng điểm không trả lời được: mẻ đo ngày 16/09 thấy Gemini
     * truyền mã điểm Quảng Ninh cho câu hỏi về Quy Nhơn, nhưng mẻ ngay trước đó thì không. Bảng
     * điểm chạy một lượt nên không phân biệt được "lỗi có hệ thống" với "một lần xui ở
     * temperature 0.7" — mà hai thứ đó dẫn tới hai hành động khác hẳn nhau.
     *
     * <p>Tách khỏi {@link #doChatLuongChonTool} có chủ ý: nó KHÔNG có ngưỡng, không chấm điểm,
     * không được xen vào bảng. Việc của nó là in ra sự thật thô để người đọc tự kết luận.
     *
     * <pre>
     *   TOOL_EVAL_PROBE="Quy Nhơn" TOOL_EVAL_PROBE_N=12 TOOL_EVAL_TEMPERATURE=0      *   TOOL_EVAL_LIVE=1 mvnw -Dtest=ToolSelectionQualityTest test
     * </pre>
     */
    @Test
    @DisplayName("Thăm dò: chạy một ca nhiều lần, in tham số từng lần")
    void thamDoMotCa() throws IOException {
        String needle = env("TOOL_EVAL_PROBE", "");
        assumeTrue(liveModeEnabled() && !needle.isBlank(),
                "cần TOOL_EVAL_PROBE=<một phần câu hỏi> cùng TOOL_EVAL_LIVE=1");

        List<EvalCase> found = loadEvalCases().stream()
                .filter(c -> c.utterance().toLowerCase(Locale.ROOT)
                        .contains(needle.toLowerCase(Locale.ROOT)))
                .toList();
        assertThat(found).as("không ca nào trong tool-eval.yml chứa \"%s\"", needle).isNotEmpty();
        assertThat(found).as("\"%s\" khớp nhiều ca, thăm dò chỉ nhận một", needle).hasSize(1);

        EvalCase target = found.get(0);
        int repeat = Integer.parseInt(env("TOOL_EVAL_PROBE_N", "12"));
        double temperature = evalTemperature();
        List<EvalCase> lap = new ArrayList<>();
        for (int i = 0; i < repeat; i++) {
            lap.add(target);
        }

        System.out.printf("%n==================== THĂM DÒ ====================%n");
        System.out.printf("Ca      : \"%s\"%n", target.utterance());
        System.out.printf("Lặp     : %d lần, nhiệt độ %.2f%n", repeat, temperature);
        System.out.printf("Bị cấm  : %s%n", target.forbid());
        System.out.printf("Ghi chú : %s%n", target.note());

        for (LlmProperties.Provider config : liveProviders()) {
            ThrottledProvider provider = new ThrottledProvider(buildLiveProvider(config), temperature,
                    isLocal(config));
            System.out.printf("%n--- %s (%s) ---%n", config.getName(), config.getModel());

            List<Outcome> outcomes = runLive(provider, lap);
            int dinhCam = 0;
            for (int i = 0; i < outcomes.size(); i++) {
                List<Call> calls = outcomes.get(i).calls();
                boolean cam = false;
                for (Call call : calls) {
                    Map<String, String> banned = target.forbid().get(call.tool());
                    if (banned == null) {
                        continue;
                    }
                    for (Map.Entry<String, String> pair : banned.entrySet()) {
                        cam |= argMatches(call.args().get(pair.getKey()), pair.getValue());
                    }
                }
                dinhCam += cam ? 1 : 0;
                String moTa = calls.isEmpty() ? "(không gọi tool nào)"
                        : String.join("; ", calls.stream().map(c -> c.tool() + c.args()).toList());
                System.out.printf("  %2d %s  %s%n", i + 1, cam ? "BỊ CẤM" : "      ", moTa);
            }
            System.out.printf("  => truyền giá trị bị cấm %d/%d lần%n", dinhCam, outcomes.size());
        }
        System.out.println("=================================================");
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
        int runs = Math.max(1, Integer.parseInt(env("TOOL_EVAL_RUNS", "1")));

        System.out.printf("%n[Live] %d ca đo, %d nhà cung cấp, nhiệt độ %.2f, %d mẻ%n",
                cases.size(), configs.size(), temperature, runs);
        if (runs == 1) {
            System.out.println("[Live] Một mẻ ở nhiệt độ khác 0 chỉ là MỘT mẫu. Muốn so hai model "
                    + "thì đặt TOOL_EVAL_RUNS=5 — xem experiments.md mục 16/09 (e).");
        }

        List<Metrics> allResults = new ArrayList<>();
        List<Spread> spreads = new ArrayList<>();
        Map<String, Metrics> primaryByLang = null;
        Map<String, Integer> hardFailuresByProvider = new LinkedHashMap<>();

        for (LlmProperties.Provider config : configs) {
            ThrottledProvider provider = new ThrottledProvider(buildLiveProvider(config), temperature,
                    isLocal(config));
            String name = config.getName() + " (" + config.getModel() + ")";
            System.out.printf("%n[Live] Đang đo %s, %d mẻ...%n", name, runs);

            // Gom theo ngôn ngữ: mỗi ngôn ngữ một danh sách N bản ghi, mỗi bản ghi là một mẻ.
            Map<String, List<Metrics>> theoNgonNgu = new LinkedHashMap<>();
            for (int me = 1; me <= runs; me++) {
                List<Outcome> outcomes = runLive(provider, cases);
                Map<String, PerTool> perTool = new LinkedHashMap<>();
                Metrics gop = evaluate(config.getName() + " · " + ALL_LANGS, outcomes, perTool, 0);

                evaluateByLang(config.getName(), outcomes, 0)
                        .forEach((lang, m) -> theoNgonNgu
                                .computeIfAbsent(lang, k -> new ArrayList<>()).add(m));

                if (runs == 1) {
                    printPerToolTable(name, perTool);
                    printCost(name, gop);
                } else {
                    System.out.printf("  mẻ %d/%d: khớp bộ %.1f%%, Args %.1f%%, cấm %d, mã lạ %d%n",
                            me, runs, gop.exactSet() * 100, gop.argAccuracy() * 100,
                            gop.forbidHits(), gop.maLaHits());
                }
            }

            Map<String, Metrics> byLang = new LinkedHashMap<>();
            theoNgonNgu.forEach((lang, cacMe) -> {
                String nhan = config.getName() + " · " + lang;
                byLang.put(lang, gopCacMe(nhan, cacMe,
                        ALL_LANGS.equals(lang) ? provider.hardFailures : 0));
                if (runs > 1) {
                    spreads.add(Spread.cua(nhan, cacMe));
                }
            });

            allResults.addAll(byLang.values());
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
        if (!spreads.isEmpty()) {
            printSpreadTable(spreads, runs);
        }
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
            assertThat(m.maLaHits())
                    .as("cấu hình \"%s\" truyền %d lần mã điểm không có trong hệ thống — truy vấn "
                            + "trả rỗng, không có ngoại lệ, và mã đó còn đọng lại trong sessionCache "
                            + "làm điểm đến mặc định cho các lượt sau", m.name(), m.maLaHits())
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
