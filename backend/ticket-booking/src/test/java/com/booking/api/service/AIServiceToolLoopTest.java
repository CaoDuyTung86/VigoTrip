package com.booking.api.service;

import com.booking.api.ai.llm.LlmBudgetGuard;
import com.booking.api.ai.llm.LlmProperties;
import com.booking.api.ai.llm.LlmProvider;
import com.booking.api.ai.llm.LlmRouter;
import com.booking.api.ai.llm.LlmTask;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Vòng function calling trước đây đóng cứng ở hai lượt: hỏi, chạy tool, hỏi lần nữa để lấy câu
 * trả lời. Hai lượt chịu thua đúng một loại câu hỏi, nhưng là loại rất tự nhiên với khách — câu
 * mà kết quả tra lần một mới cho biết lần hai phải tra gì. "Vé sắp đi của tôi tới đâu, chỗ đó
 * thời tiết thế nào" phải đọc đơn hàng xong mới biết hỏi thời tiết ở nơi nào.
 *
 * <p>Nới trần thì mở ra hai đường hỏng mới, và phần lớn test ở đây khoá hai đường đó: một lượt
 * chat quẩn vô hạn, và một lượt chat nã hàng chục truy vấn vào cơ sở dữ liệu.
 */
class AIServiceToolLoopTest {

    /** Nhà cung cấp giả: đọc kịch bản đã soạn sẵn và ghi lại mình được hỏi những gì. */
    private static final class ProviderGia implements LlmProvider {

        private final Deque<Map<String, Object>> kichBan = new ArrayDeque<>();
        private final List<Boolean> coKemTool = new ArrayList<>();
        private String daStream;

        void soan(Map<String, Object> phanHoi) {
            kichBan.add(phanHoi);
        }

        @Override
        public String name() {
            return "gia";
        }

        @Override
        public String model() {
            return "model-gia";
        }

        @Override
        public int maxTokens() {
            return 800;
        }

        @Override
        public double temperature() {
            return 0.7;
        }

        @Override
        public Map<String, Object> chatCompletion(List<Map<String, Object>> messages,
                                                  List<Map<String, Object>> tools,
                                                  double temperature, int maxTokens) {
            coKemTool.add(tools != null && !tools.isEmpty());
            if (kichBan.isEmpty()) {
                throw new AssertionError("Model bị gọi nhiều lần hơn kịch bản đã soạn");
            }
            return kichBan.poll();
        }

        @Override
        public void streamCompletion(List<Map<String, Object>> messages, double temperature,
                                     int maxTokens, Consumer<String> chunkConsumer) {
            daStream = "stream";
            chunkConsumer.accept("câu trả lời stream");
        }

        int soLanGoi() {
            return coKemTool.size();
        }
    }

    private static Map<String, Object> traLoiChu(String noiDung) {
        return Map.of("role", "assistant", "content", noiDung);
    }

    private static Map<String, Object> xinGoiTool(String ten, String argsJson) {
        return Map.of("role", "assistant", "content", "", "tool_calls", List.of(
                Map.of("id", "call-" + ten + "-" + argsJson.hashCode(), "type", "function",
                        "function", Map.of("name", ten, "arguments", argsJson))));
    }

    private ProviderGia provider;
    private AIService aiService;
    private LlmProperties properties;
    private List<String> daChay;

    @BeforeEach
    void setUp() {
        provider = new ProviderGia();
        properties = new LlmProperties();
        daChay = new ArrayList<>();

        LlmRouter router = mock(LlmRouter.class);
        when(router.execute(any(LlmTask.class), any())).thenAnswer(inv -> {
            Function<LlmProvider, Object> action = inv.getArgument(1);
            return action.apply(provider);
        });

        LlmBudgetGuard budgetGuard = mock(LlmBudgetGuard.class);
        when(budgetGuard.tryConsume()).thenReturn(true);

        aiService = new AIService(router, properties, budgetGuard);
    }

    private AIService.ToolHandler handler() {
        return (ten, args) -> {
            daChay.add(ten);
            return "ket qua cua " + ten;
        };
    }

    private String hoi() {
        return aiService.getChatResponse("system", List.of(), "câu hỏi của khách", handler());
    }

    @Test
    @DisplayName("Tra xong một thứ rồi tra tiếp thứ hai dựa trên kết quả đó")
    void noiDuocChuoiHaiBuoc() {
        provider.soan(xinGoiTool("get_user_bookings", "{}"));
        provider.soan(xinGoiTool("get_weather_forecast", "{\"place\":\"Đà Nẵng\"}"));
        provider.soan(traLoiChu("Vé của bạn đi Đà Nẵng, ở đó đang có mưa rào."));

        String traLoi = hoi();

        assertThat(daChay).containsExactly("get_user_bookings", "get_weather_forecast");
        assertThat(traLoi).contains("mưa rào");
        assertThat(provider.soLanGoi()).isEqualTo(3);
    }

    @Test
    @DisplayName("Câu hỏi không cần tra thì vẫn đúng một lời gọi model")
    void khongCanTraThiMotLoiGoi() {
        provider.soan(traLoiChu("Chào bạn."));

        assertThat(hoi()).isEqualTo("Chào bạn.");
        assertThat(daChay).isEmpty();
        assertThat(provider.soLanGoi()).isEqualTo(1);
    }

    @Test
    @DisplayName("Câu hỏi tra một bước vẫn chỉ tốn hai lời gọi như trước")
    void traMotBuocVanHaiLoiGoi() {
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(traLoiChu("Có ba chuyến."));

        assertThat(hoi()).isEqualTo("Có ba chuyến.");
        assertThat(provider.soLanGoi()).isEqualTo(2);
    }

    @Test
    @DisplayName("Lượt cuối gọi model KHÔNG kèm định nghĩa tool")
    void luotCuoiKhongKemTool() {
        properties.getTools().setMaxRounds(3);
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(xinGoiTool("get_addon_services", "{}"));
        provider.soan(traLoiChu("Xong."));

        hoi();

        // Còn tool ở lượt cuối thì model xin gọi thêm một lần nữa mà ta đã hết lượt để phục vụ,
        // và thứ gửi cho khách sẽ là một câu trả lời rỗng.
        assertThat(provider.coKemTool).containsExactly(true, true, false);
    }

    @Test
    @DisplayName("Model cứ xin tool mãi thì dừng ở trần vòng, không quẩn vô hạn")
    void quanMaiThiDungODungTran() {
        properties.getTools().setMaxRounds(4);
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"SGN\"}"));
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"DAD\"}"));
        provider.soan(traLoiChu("Đây là những gì mình tra được."));

        assertThat(hoi()).isEqualTo("Đây là những gì mình tra được.");
        assertThat(provider.soLanGoi()).isEqualTo(4);
    }

    @Test
    @DisplayName("Xin lại đúng tool với đúng tham số thì dùng kết quả cũ, không chạy lần hai")
    void xinLaiThiDungKetQuaCu() {
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(traLoiChu("Xong."));

        hoi();

        // Hỏi lại một câu và nhận về đúng một đáp án thì model thôi hỏi; mỗi lần lại là một truy
        // vấn thật thì nó có thể quẩn cho tới khi hết trần.
        assertThat(daChay).containsExactly("search_trips");
    }

    @Test
    @DisplayName("Cùng tool nhưng khác tham số thì vẫn chạy thật")
    void khacThamSoThiVanChay() {
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"SGN\"}"));
        provider.soan(traLoiChu("Xong."));

        hoi();

        assertThat(daChay).containsExactly("search_trips", "search_trips");
    }

    @Test
    @DisplayName("Chạm trần số lần chạy tool thì báo hết lượt chứ không ném lỗi")
    void chamTranSoLanChayThiBaoHetLuot() {
        properties.getTools().setMaxCallsPerTurn(2);

        List<Map<String, Object>> baToolMotVong = List.of(
                Map.of("id", "c1", "type", "function",
                        "function", Map.of("name", "search_trips", "arguments", "{\"origin\":\"HAN\"}")),
                Map.of("id", "c2", "type", "function",
                        "function", Map.of("name", "search_trips", "arguments", "{\"origin\":\"SGN\"}")),
                Map.of("id", "c3", "type", "function",
                        "function", Map.of("name", "search_trips", "arguments", "{\"origin\":\"DAD\"}")));
        provider.soan(Map.of("role", "assistant", "content", "", "tool_calls", baToolMotVong));
        provider.soan(traLoiChu("Mình tra được hai tuyến."));

        assertThat(hoi()).isEqualTo("Mình tra được hai tuyến.");
        // Trần số vòng một mình không chặn được chỗ này: ba tool nằm trong CÙNG một vòng.
        assertThat(daChay).hasSize(2);
    }

    @Test
    @DisplayName("Trần một vòng bị nâng lên hai, vì một vòng là tắt hẳn function calling")
    void tranMotVongDuocNangLenHai() {
        properties.getTools().setMaxRounds(1);
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(traLoiChu("Xong."));

        assertThat(hoi()).isEqualTo("Xong.");
        assertThat(provider.coKemTool).containsExactly(true, false);
    }

    @Test
    @DisplayName("Bản stream cũng nối được chuỗi, và chỉ lượt cuối mới stream thật")
    void banStreamCungNoiDuocChuoi() {
        List<String> nhanDuoc = new ArrayList<>();
        provider.soan(xinGoiTool("get_user_bookings", "{}"));
        provider.soan(xinGoiTool("get_weather_forecast", "{\"place\":\"Đà Nẵng\"}"));

        aiService.streamChatResponse("system", List.of(), "câu hỏi", handler(), nhanDuoc::add);

        assertThat(daChay).containsExactly("get_user_bookings", "get_weather_forecast");
        assertThat(provider.daStream).isEqualTo("stream");
        assertThat(String.join("", nhanDuoc)).contains("stream");
    }

    @Test
    @DisplayName("Bản stream: không còn tool để tra thì phát lại theo kiểu gõ chữ")
    void banStreamHetToolThiGoChu() {
        List<String> nhanDuoc = new ArrayList<>();
        provider.soan(xinGoiTool("search_trips", "{\"origin\":\"HAN\"}"));
        provider.soan(traLoiChu("Có ba chuyến."));

        aiService.streamChatResponse("system", List.of(), "câu hỏi", handler(), nhanDuoc::add);

        // Muốn biết model còn xin tra gì nữa không thì phải hỏi kèm định nghĩa tool, mà hỏi kèm
        // tool thì không stream được — đây là cái giá của việc nối chuỗi.
        assertThat(provider.daStream).isNull();
        assertThat(String.join("", nhanDuoc)).isEqualTo("Có ba chuyến.");
    }
}
