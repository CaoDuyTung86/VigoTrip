package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tool save_voucher đi qua ChatService: server gắn nút, gộp đề xuất trùng khi vòng lặp bị chạy lại,
 * và danh tính của đề xuất luôn lấy từ JWT.
 */
class ChatServiceSaveVoucherToolTest {

    private static final String JWT_USER = "chinhchu@example.com";
    private static final String VICTIM = "nannhan@example.com";
    private static final Pattern MARKER = Pattern.compile("\\[ACTION: ([A-Za-z0-9_-]+)]");

    private AIService aiService;
    private SavedVoucherService savedVoucherService;
    private ChatHistoryService chatHistoryService;
    private ChatActionService chatActionService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        VoucherService voucherService = mock(VoucherService.class);
        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of(
                VoucherPublicDTO.builder().id(11L).code("AUTUMN2026").discountPercent(12.0).available(true).build()));
        savedVoucherService = mock(SavedVoucherService.class);
        chatActionService = new ChatActionService(voucherService, savedVoucherService, mock(UserService.class));

        RouteRepository routeRepository = mock(RouteRepository.class);
        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN"));
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        when(hybridRetriever.retrieveForLanguage(anyString(), any())).thenReturn(List.of());

        aiService = mock(AIService.class);
        chatHistoryService = mock(ChatHistoryService.class);
        chatService = new ChatService(mock(TripRepository.class), mock(BookingRepository.class), voucherService,
                routeRepository, mock(AdditionalServiceRepository.class),
                mock(com.booking.api.weather.WeatherService.class), aiService, mock(RestTemplate.class), hybridRetriever,
                chatHistoryService, mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000), chatActionService);
    }

    private static List<String> tokensIn(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher m = MARKER.matcher(text);
        while (m.find()) {
            tokens.add(m.group(1));
        }
        return tokens;
    }

    /** Cho model "gọi" tool bằng những lời gọi truyền vào, rồi trả về một câu trả lời cố định. */
    private void modelCalls(AtomicReference<String> lastToolResult, List<Map<String, Object>> calls) {
        when(aiService.getChatResponse(anyString(), anyList(), anyString(), any())).thenAnswer(inv -> {
            AIService.ToolHandler handler = inv.getArgument(3);
            for (Map<String, Object> args : calls) {
                lastToolResult.set(handler.executeTool("save_voucher", args));
            }
            return "Bạn bấm nút bên dưới để lưu mã nhé.";
        });
    }

    @Test
    @DisplayName("Vòng lặp bị chạy lại (failover) vẫn chỉ ra MỘT nút, và chưa ghi gì")
    void chayLaiVongLapVanMotNut() {
        AtomicReference<String> result = new AtomicReference<>();
        // Lần hai viết thường: sổ nhớ lời gọi của AIService coi đó là tham số khác, nên chỉ có
        // bước gộp theo nội dung ở ChatService mới chặn được.
        modelCalls(result, List.of(Map.of("code", "AUTUMN2026"), Map.of("code", "autumn2026")));

        String reply = chatService.getChatResponse("lưu mã AUTUMN2026", JWT_USER, "s1", List.of(), "vi", null);

        assertThat(tokensIn(reply)).hasSize(1);
        assertThat(reply).startsWith("Bạn bấm nút bên dưới");
        verify(savedVoucherService, never()).saveVoucher(anyString(), any());
    }

    @Test
    @DisplayName("Đề xuất thuộc về tài khoản trong JWT, không phải email model truyền vào")
    void usernameDoModelGuiBiBoQua() {
        modelCalls(new AtomicReference<>(), List.of(Map.of("code", "AUTUMN2026", "username", VICTIM)));

        String reply = chatService.getChatResponse("lưu mã", JWT_USER, "s1", List.of(), "vi", null);
        String token = tokensIn(reply).get(0);

        assertThat(chatActionService.describe(token, JWT_USER)).isPresent();
        assertThat(chatActionService.describe(token, VICTIM)).isEmpty();
    }

    @Test
    @DisplayName("Khách vãng lai: tool từ chối, không có nút nào")
    void khachVangLaiKhongCoNut() {
        AtomicReference<String> result = new AtomicReference<>();
        modelCalls(result, List.of(Map.of("code", "AUTUMN2026", "username", VICTIM)));

        String reply = chatService.getChatResponse("lưu mã", null, "guest-1", List.of(), "vi", null);

        assertThat(tokensIn(reply)).isEmpty();
        assertThat(result.get()).contains("chưa đăng nhập");
    }

    @Test
    @DisplayName("Không gọi tool thì câu trả lời giữ nguyên, không dính thẻ nào")
    void khongGoiToolThiKhongCoThe() {
        when(aiService.getChatResponse(anyString(), anyList(), anyString(), any())).thenReturn("Xin chào");

        assertThat(chatService.getChatResponse("chào", JWT_USER, "s1", List.of(), "vi", null)).isEqualTo("Xin chào");
    }

    @Test
    @DisplayName("Kết quả tool dặn model KHÔNG được nói là đã lưu")
    void ketQuaToolDanKhongNoiDaLuu() {
        AtomicReference<String> result = new AtomicReference<>();
        modelCalls(result, List.of(Map.of("code", "AUTUMN2026")));

        chatService.getChatResponse("lưu mã", JWT_USER, "s1", List.of(), "vi", null);

        assertThat(result.get()).contains("MÃ CHƯA ĐƯỢC LƯU").contains("KHÔNG nói là đã lưu");
    }

    @Test
    @DisplayName("Stream: nút gắn vào mẩu cuối và đi vào lịch sử hội thoại")
    void streamGanNutVaoCuoi() {
        doAnswer(inv -> {
            AIService.ToolHandler handler = inv.getArgument(3);
            Consumer<String> consumer = inv.getArgument(4);
            handler.executeTool("save_voucher", Map.of("code", "AUTUMN2026"));
            consumer.accept("Bấm nút để lưu mã.");
            return null;
        }).when(aiService).streamChatResponse(anyString(), anyList(), anyString(), any(), any());

        StringBuilder streamed = new StringBuilder();
        chatService.streamChatResponse("lưu mã", JWT_USER, "s1", List.of(), "vi", null, streamed::append);

        assertThat(streamed.toString()).startsWith("Bấm nút để lưu mã.");
        assertThat(tokensIn(streamed.toString())).hasSize(1);

        ArgumentCaptor<String> saved = ArgumentCaptor.forClass(String.class);
        verify(chatHistoryService).saveExchange(eq(JWT_USER), any(), any(), saved.capture(), any(), any());
        assertThat(tokensIn(saved.getValue())).hasSize(1);
    }
}
