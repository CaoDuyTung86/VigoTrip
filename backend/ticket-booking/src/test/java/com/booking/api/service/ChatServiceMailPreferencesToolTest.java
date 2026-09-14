package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.dto.UserResponse;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tool update_mail_preferences đi qua ChatService: tham số bật/tắt không bị đoán, đề xuất trùng được
 * gộp, và kết quả tool dặn model đúng những điều khách phải biết trước khi bấm.
 */
class ChatServiceMailPreferencesToolTest {

    private static final String JWT_USER = "chinhchu@example.com";
    private static final Pattern MARKER = Pattern.compile("\\[ACTION: ([A-Za-z0-9_-]+)]");

    private AIService aiService;
    private UserService userService;
    private ChatActionService chatActionService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        when(userService.getProfile(JWT_USER)).thenReturn(UserResponse.builder()
                .email(JWT_USER).tripReminderOptIn(true).language("vi").build());
        VoucherService voucherService = mock(VoucherService.class);
        chatActionService = new ChatActionService(voucherService, mock(SavedVoucherService.class), userService);

        RouteRepository routeRepository = mock(RouteRepository.class);
        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN"));
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        when(hybridRetriever.retrieveForLanguage(anyString(), any())).thenReturn(List.of());

        aiService = mock(AIService.class);
        chatService = new ChatService(mock(TripRepository.class), mock(BookingRepository.class), voucherService,
                routeRepository, mock(AdditionalServiceRepository.class),
                mock(com.booking.api.weather.WeatherService.class), aiService, mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class), mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000), chatActionService);
    }

    /** Cho model "gọi" update_mail_preferences với từng bộ tham số; trả về kết quả tool cuối cùng. */
    private AtomicReference<String> modelCalls(List<Map<String, Object>> calls) {
        AtomicReference<String> lastResult = new AtomicReference<>();
        when(aiService.getChatResponse(anyString(), anyList(), anyString(), any())).thenAnswer(inv -> {
            AIService.ToolHandler handler = inv.getArgument(3);
            for (Map<String, Object> args : calls) {
                lastResult.set(handler.executeTool("update_mail_preferences", args));
            }
            return "Bạn bấm nút bên dưới nhé.";
        });
        return lastResult;
    }

    private String chat(String username) {
        return chatService.getChatResponse("đổi cài đặt thư", username, "s1", List.of(), "vi", null);
    }

    private static List<String> tokensIn(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher m = MARKER.matcher(text);
        while (m.find()) {
            tokens.add(m.group(1));
        }
        return tokens;
    }

    @Test
    @DisplayName("Tắt thư nhắc: một nút, chưa ghi gì, và dặn rõ thư về vé vẫn gửi")
    void tatThuNhacMotNutChuaGhi() {
        AtomicReference<String> result = modelCalls(List.of(Map.of("tripReminders", "off", "language", "")));

        String reply = chat(JWT_USER);

        assertThat(tokensIn(reply)).hasSize(1);
        assertThat(result.get())
                .contains("sẽ TẮT")
                .contains("KHÔNG chặn thư xác nhận vé")
                .contains("KHÔNG nói là đã đổi")
                .doesNotContain("Ngôn ngữ tài khoản");
        verify(userService, never()).updateMailPreferences(anyString(), any(), any());
    }

    @Test
    @DisplayName("Vòng lặp bị chạy lại và model đổi cách viết off → false: vẫn một nút")
    void chayLaiVongLapVanMotNut() {
        modelCalls(List.of(Map.of("tripReminders", "off"), Map.of("tripReminders", false)));

        assertThat(tokensIn(chat(JWT_USER))).hasSize(1);
    }

    @Test
    @DisplayName("Tham số bật/tắt rỗng hoặc lạ KHÔNG bị đoán thành tắt")
    void thamSoLaKhongDoanThanhTat() {
        modelCalls(List.of(Map.of("tripReminders", "có lẽ", "language", "en")));

        String token = tokensIn(chat(JWT_USER)).get(0);

        assertThat(chatActionService.describe(token, JWT_USER)).get()
                .satisfies(view -> {
                    assertThat(view.mailPreferences().tripReminders()).isNull();
                    assertThat(view.mailPreferences().language()).isEqualTo("en");
                });
    }

    @Test
    @DisplayName("Đổi sang ngôn ngữ chưa dịch thư: dặn giao diện đổi theo VÀ thư tới bằng tiếng Anh")
    void ngonNguChuaDichThiDanTruoc() {
        AtomicReference<String> result = modelCalls(List.of(Map.of("language", "ja")));

        chat(JWT_USER);

        assertThat(result.get()).contains("tiếng Nhật").contains("giao diện").contains("CHƯA CÓ BẢN DỊCH");
    }

    @Test
    @DisplayName("Đổi sang tiếng Anh: không kêu chưa dịch")
    void tiengAnhKhongKeuChuaDich() {
        AtomicReference<String> result = modelCalls(List.of(Map.of("language", "en")));

        chat(JWT_USER);

        assertThat(result.get()).contains("tiếng Anh").doesNotContain("CHƯA CÓ BẢN DỊCH");
    }

    @Test
    @DisplayName("Cài đặt đã đúng như khách muốn thì không dựng nút")
    void daDungRoiThiKhongCoNut() {
        AtomicReference<String> result = modelCalls(List.of(Map.of("tripReminders", "on")));

        assertThat(tokensIn(chat(JWT_USER))).isEmpty();
        assertThat(result.get()).contains("ĐÃ ĐÚNG NHƯ KHÁCH MUỐN");
    }

    @Test
    @DisplayName("Khách vãng lai: tool từ chối, không có nút, dù model truyền email người khác")
    void khachVangLaiKhongCoNut() {
        AtomicReference<String> result = modelCalls(List.of(Map.of("tripReminders", "off", "username", JWT_USER)));

        String reply = chatService.getChatResponse("tắt thư nhắc", null, "guest-1", List.of(), "vi", null);

        assertThat(tokensIn(reply)).isEmpty();
        assertThat(result.get()).contains("chưa đăng nhập");
    }
}
