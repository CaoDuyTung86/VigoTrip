package com.booking.api.service;

import com.booking.api.ai.llm.LlmProperties;
import com.booking.api.entity.User;
import com.booking.api.enums.ReportPeriod;
import com.booking.api.enums.ReportScope;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đo <b>groundedness</b> của AI BI: mọi con số trong lời văn AI viết ra có truy ngược
 * được về bản tóm tắt do SQL tính hay không.
 *
 * <h2>Vì sao là groundedness chứ không phải faithfulness</h2>
 *
 * Bên chatbot RAG, câu hỏi "câu trả lời có bịa không" phải chấm trên các <i>mệnh đề ngôn
 * ngữ tự nhiên</i> — nên cần LLM-as-a-judge hoặc chấm tay. Bên AI BI thì rủi ro tập trung
 * vào đúng một thứ đếm được: <b>con số</b>. Mọi con số AI được phép nói đều nằm sẵn trong
 * bản tóm tắt, nên phép đo này <b>tất định 100%</b>: bóc số bằng biểu thức chính quy rồi
 * kiểm tra thuộc tập hợp. Không có model nào chấm điểm model nào.
 *
 * <pre>
 * groundedness = |số trong câu trả lời ∩ số trong bản tóm tắt| / |số trong câu trả lời|
 * mục tiêu: 1.00
 * </pre>
 *
 * <h2>Hai chế độ chạy</h2>
 *
 * <ol>
 *   <li><b>Mặc định (offline, chạy được trong CI):</b> chấm một câu trả lời mẫu đã biết
 *       trước đáp án. Nó không đo model — nó khoá lại <i>chính bộ đo</i>: nếu ai sửa
 *       {@link #normalize} hay {@link #extractNumbers} làm hỏng cách nhận dạng số thì
 *       build đỏ. Không có bước này thì bộ đo hỏng âm thầm và mọi số sau đó vô nghĩa —
 *       đúng cái bẫy đã dính hai lần ở bộ đo RAG.</li>
 *   <li><b>Live (thủ công):</b> đặt {@code BI_EVAL_LIVE=1} và {@code GEMINI_API_KEY} để gọi
 *       model thật rồi chấm câu trả lời thật:
 *       <pre>BI_EVAL_LIVE=1 GEMINI_API_KEY=... ./mvnw test -Dtest=AiBiGroundednessTest</pre>
 *   </li>
 * </ol>
 *
 * <h2>Đọc kết quả thế nào</h2>
 *
 * Đừng chỉ nhìn con số tổng — <b>luôn đọc danh sách số không truy được</b>. Một con số lọt
 * vào đó có thể là ba thứ rất khác nhau:
 * <ul>
 *   <li>AI <b>bịa</b> — đây mới là lỗi thật;</li>
 *   <li>AI <b>làm tròn</b> ("1,5 triệu" thay cho 1.500.000) — không sai, nhưng vẫn là con số
 *       người đọc không đối chiếu thẳng được với báo cáo;</li>
 *   <li>số <b>thứ tự</b> do khung báo cáo sinh ra ("## 1.", "3 hành động") — vô hại.</li>
 * </ul>
 * Bộ đo cố tình <b>không</b> tự phân loại ba nhóm này: phân loại được thì đã không cần đo.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiBiGroundednessTest {

    /** Ngưỡng cho chế độ live. Đặt dưới 1.00 vì AI làm tròn là chuyện hợp lệ. */
    private static final double MIN_GROUNDEDNESS = 0.90;

    private static final String ADMIN_EMAIL = "admin@gmail.com";
    private static final List<Long> ALL_PROVIDERS = List.of(1L, 2L, 3L);

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ProviderRepository providerRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AIService aiService;

    @InjectMocks
    private AnalyticsService analyticsService;

    @Captor
    private ArgumentCaptor<String> systemCaptor;
    @Captor
    private ArgumentCaptor<String> reportCaptor;

    // ------------------------------------------------------------------ bóc số

    /**
     * Bắt mọi cụm chữ số kèm dấu phân cách nhóm hoặc dấu thập phân.
     * Không bắt số nằm dính trong định danh (ví dụ {@code HAN2}).
     */
    private static final Pattern NUMBER = Pattern.compile("(?<![\\p{L}\\d])(\\d[\\d.,]*\\d|\\d)(?![\\p{L}\\d])");

    /** Nhóm nghìn kiểu Việt Nam: 1.500.000 */
    private static final Pattern GROUPED_DOT = Pattern.compile("^\\d{1,3}(\\.\\d{3})+$");
    /** Nhóm nghìn kiểu Anh Mỹ: 1,500,000 */
    private static final Pattern GROUPED_COMMA = Pattern.compile("^\\d{1,3}(,\\d{3})+$");
    /** Thập phân, dấu chấm hoặc dấu phẩy: 50.0 hoặc 50,0 */
    private static final Pattern DECIMAL = Pattern.compile("^\\d+[.,]\\d+$");

    /**
     * Đưa một cụm số về dạng chuẩn để so sánh.
     *
     * Chỗ khó nằm ở chỗ dấu chấm mang hai nghĩa: {@code 1.500.000} là phân cách nghìn còn
     * {@code 50.0} là thập phân. Phân biệt bằng hình dạng chứ không đoán, rồi bỏ số 0 thừa
     * ở đuôi để {@code 50.0} và {@code 50} coi như một — nếu không thì AI viết "50%" trong
     * khi báo cáo ghi "+50.0%" sẽ bị chấm oan là bịa.
     *
     * @return dạng chuẩn, hoặc null nếu cụm đó không phải một con số hợp lệ
     */
    static String normalize(String raw) {
        String token = raw.trim();
        try {
            BigDecimal value;
            if (GROUPED_DOT.matcher(token).matches()) {
                value = new BigDecimal(token.replace(".", ""));
            } else if (GROUPED_COMMA.matcher(token).matches()) {
                value = new BigDecimal(token.replace(",", ""));
            } else if (DECIMAL.matcher(token).matches()) {
                value = new BigDecimal(token.replace(',', '.'));
            } else if (token.chars().allMatch(Character::isDigit)) {
                value = new BigDecimal(token);
            } else {
                return null;
            }
            return value.stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Mọi con số xuất hiện trong một đoạn văn bản, đã chuẩn hoá, giữ nguyên thứ tự. */
    static List<String> extractNumbers(String text) {
        List<String> result = new ArrayList<>();
        Matcher m = NUMBER.matcher(text);
        while (m.find()) {
            String normalized = normalize(m.group(1));
            if (normalized != null) {
                result.add(normalized);
            }
        }
        return result;
    }

    private record Score(double groundedness, int total, int grounded, List<String> ungrounded) {
    }

    private static Score score(String answer, String report) {
        Set<String> truth = new LinkedHashSet<>(extractNumbers(report));
        List<String> found = extractNumbers(answer);
        List<String> ungrounded = new ArrayList<>();
        int grounded = 0;
        for (String n : found) {
            if (truth.contains(n)) {
                grounded++;
            } else {
                ungrounded.add(n);
            }
        }
        double value = found.isEmpty() ? 1.0 : (double) grounded / found.size();
        return new Score(value, found.size(), grounded, ungrounded);
    }

    // ------------------------------------------------------------------ dữ liệu mẫu

    private static Object[] bookingRow(long id, LocalDateTime at, double amount) {
        return new Object[] { id, at, BigDecimal.valueOf(amount) };
    }

    /** Kỳ tháng 8/2026 có số liệu, tháng 7/2026 làm kỳ đối chiếu. */
    private void givenBusinessData() {
        User admin = new User();
        admin.setId(1L);
        admin.setEmail(ADMIN_EMAIL);
        when(userRepository.findByEmail(ADMIN_EMAIL)).thenReturn(Optional.of(admin));
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);

        LocalDateTime aug = LocalDateTime.of(2026, 8, 10, 9, 0);
        LocalDateTime jul = LocalDateTime.of(2026, 7, 10, 9, 0);

        when(bookingRepository.findScopedBookingRows(
                eqDay(2026, 8, 1), eqDay(2026, 9, 1), anyList()))
                .thenReturn(List.of(
                        bookingRow(1L, aug, 5_000_000),
                        bookingRow(2L, aug, 3_000_000),
                        bookingRow(3L, aug, 2_000_000)));
        when(bookingRepository.findScopedBookingRows(
                eqDay(2026, 7, 1), eqDay(2026, 8, 1), anyList()))
                .thenReturn(List.of(
                        bookingRow(4L, jul, 4_000_000),
                        bookingRow(5L, jul, 4_000_000)));

        when(bookingRepository.sumServiceRevenueForBookings(anyList()))
                .thenReturn(BigDecimal.valueOf(500_000));
        when(bookingRepository.findEarliestBookingDate(anyList()))
                .thenReturn(LocalDateTime.of(2026, 1, 5, 8, 0));

        // provider: [id, name, type, amount, tickets]
        when(bookingRepository.findRevenueByProviderInPeriod(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(
                        new Object[] { 1L, "Phuong Trang", "BUS", BigDecimal.valueOf(6_000_000), 40L },
                        new Object[] { 2L, "Vietnam Airlines", "PLANE", BigDecimal.valueOf(3_500_000), 12L }));
        // vehicle type: [name, amount]
        when(bookingRepository.findRevenueByVehicleTypeInPeriod(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(
                        new Object[] { "BUS", BigDecimal.valueOf(6_000_000) },
                        new Object[] { "PLANE", BigDecimal.valueOf(3_500_000) }));
        // route: [origin, destination, amount, tickets]
        when(bookingRepository.findTopRoutesInPeriod(any(), any(), anyList(), any()))
                .thenReturn(List.<Object[]>of(
                        new Object[] { "Ha Noi", "Da Nang", BigDecimal.valueOf(4_200_000), 28L },
                        new Object[] { "Ha Noi", "Sai Gon", BigDecimal.valueOf(2_800_000), 9L }));
    }

    private static LocalDateTime eqDay(int y, int m, int d) {
        return org.mockito.ArgumentMatchers.eq(LocalDate.of(y, m, d).atStartOfDay());
    }

    /** Bản tóm tắt mà AnalyticsService thực sự gửi cho model. */
    private String captureReport() {
        analyticsService.getInsights(ReportScope.SYSTEM, ADMIN_EMAIL,
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 15));
        verify(aiService).getAIAnalysis(systemCaptor.capture(), reportCaptor.capture());
        return reportCaptor.getValue();
    }

    // ------------------------------------------------------------------ chế độ live

    private static boolean liveModeEnabled() {
        String key = System.getenv("GEMINI_API_KEY");
        return "1".equals(System.getenv("BI_EVAL_LIVE")) && key != null && !key.isBlank();
    }

    @SuppressWarnings("unchecked")
    private static String askModel(String systemInstruction, String report) {
        LlmProperties.Provider config = new LlmProperties.Provider();
        config.setName("gemini");
        config.setBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
        config.setApiKey(System.getenv("GEMINI_API_KEY"));
        config.setModel("gemini-flash-lite-latest");
        // Giống hồ sơ tác vụ ANALYSIS đang chạy thật: nhiệt độ thấp, đầu ra dài.
        config.setTemperature(0.3);
        config.setMaxTokens(4000);

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(120));

        com.booking.api.ai.llm.OpenAiCompatibleProvider provider =
                new com.booking.api.ai.llm.OpenAiCompatibleProvider(
                        config, new RestTemplate(factory), HttpClient.newHttpClient(), new ObjectMapper());

        Map<String, Object> reply = provider.chatCompletion(
                List.of(Map.of("role", "system", "content", systemInstruction),
                        Map.of("role", "user", "content", report)),
                null, config.getTemperature(), config.getMaxTokens());

        Object content = reply == null ? null : reply.get("content");
        return content instanceof String s ? s : "";
    }

    // ------------------------------------------------------------------ test

    @Test
    @DisplayName("Bộ đo groundedness nhận dạng đúng con số, kể cả khi định dạng khác nhau")
    void boDoNhanDangDungConSo() {
        // Khoá lại chính bộ đo. Bản tóm tắt ghi 1.500.000 và +50.0%; câu trả lời viết
        // 1.500.000 và 50% — cùng một con số, phải được coi là truy ngược được.
        String report = "Doanh thu: 1.500.000 VND. Kỳ trước: 1.000.000 VND. Tăng trưởng: +50.0%.";
        String answer = "Doanh thu đạt 1.500.000 VND, tăng 50% so với mức 1.000.000 VND của kỳ trước.";

        assertThat(score(answer, report).groundedness())
                .as("cùng một con số viết hai kiểu định dạng phải khớp nhau")
                .isEqualTo(1.0);

        // Và ngược lại: một con số không hề có trong bản tóm tắt phải bị bắt.
        String bia = "Doanh thu đạt 1.500.000 VND, chiếm 73% thị phần toàn miền Bắc.";
        Score s = score(bia, report);
        assertThat(s.ungrounded()).as("phải chỉ đúng con số bịa").containsExactly("73");
        assertThat(s.groundedness()).isEqualTo(0.5);

        assertThat(normalize("1.500.000")).isEqualTo("1500000");
        assertThat(normalize("1,500,000")).isEqualTo("1500000");
        assertThat(normalize("50.0")).isEqualTo("50");
        assertThat(normalize("50,5")).isEqualTo("50.5");
    }

    @Test
    @DisplayName("Bản tóm tắt gửi cho model chứa đủ số liệu để chấm groundedness")
    void banTomTatChuaDuSoLieu() {
        givenBusinessData();
        String report = captureReport();

        List<String> numbers = extractNumbers(report);
        assertThat(numbers).as("bản tóm tắt phải có số để mà đối chiếu").isNotEmpty();
        assertThat(report).contains("10.000.000");  // doanh thu thực thu
        assertThat(report).contains("8.000.000");   // kỳ trước
        assertThat(report).contains("+25.0%");      // tăng trưởng, tính sẵn bằng Java
        System.out.printf("%n[BI] Bản tóm tắt chứa %d con số phân biệt.%n",
                new LinkedHashSet<>(numbers).size());
    }

    @Test
    @DisplayName("Groundedness của lời văn AI trên số liệu thật (chỉ chạy ở chế độ live)")
    void groundednessCuaLoiVanAi() {
        if (!liveModeEnabled()) {
            System.out.println();
            System.out.println("[Bỏ qua] Đặt BI_EVAL_LIVE=1 và GEMINI_API_KEY để đo groundedness thật.");
            return;
        }

        givenBusinessData();
        String report = captureReport();
        String systemInstruction = systemCaptor.getValue();

        String answer = askModel(systemInstruction, report);
        assertThat(answer).as("model không trả về nội dung nào").isNotBlank();

        Score s = score(answer, report);

        System.out.println();
        System.out.println("================ GROUNDEDNESS — AI BI ================");
        System.out.printf("Số con số trong câu trả lời : %d%n", s.total());
        System.out.printf("Truy ngược được về SQL      : %d%n", s.grounded());
        System.out.printf("Groundedness                : %.3f%n", s.groundedness());
        System.out.println("------------------------------------------------------");
        if (s.ungrounded().isEmpty()) {
            System.out.println("Không có con số nào nằm ngoài bản tóm tắt.");
        } else {
            System.out.printf("%d con số KHÔNG truy ngược được: %s%n",
                    s.ungrounded().size(), s.ungrounded());
            System.out.println("Đọc từng cái: AI bịa? AI làm tròn? hay chỉ là số thứ tự mục?");
        }
        System.out.println("======================================================");
        System.out.println();
        System.out.println("--- Câu trả lời của model ---");
        System.out.println(answer);

        assertThat(s.groundedness())
                .as("groundedness tụt dưới ngưỡng — đọc danh sách số không truy được ở trên "
                        + "trước khi kết luận, vì làm tròn cũng rơi vào danh sách đó")
                .isGreaterThanOrEqualTo(MIN_GROUNDEDNESS);
    }
}
