package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Suất ăn, gói hành lý, bảo hiểm và xe đưa đón sống trong bảng dich_vu_bo_sung, nhưng trước
 * đây chatbot không có đường nào đọc tới. Khách hỏi "gợi ý món ăn" là model tự đặt ra thực
 * đơn kèm giá — nghe rất thật, không một dòng nào có thật.
 *
 * Hai lớp bảo vệ được kiểm ở đây: một công cụ đọc đúng danh mục đó, và một luật trong system
 * prompt buộc model gọi công cụ thay vì tự nghĩ.
 */
class ChatServiceAddonServiceTest {

    private AdditionalServiceRepository additionalServiceRepository;
    private AIService aiService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        TripRepository tripRepository = mock(TripRepository.class);
        BookingRepository bookingRepository = mock(BookingRepository.class);
        VoucherService voucherService = mock(VoucherService.class);
        RouteRepository routeRepository = mock(RouteRepository.class);
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        additionalServiceRepository = mock(AdditionalServiceRepository.class);
        aiService = mock(AIService.class);

        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of());
        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN"));
        when(hybridRetriever.retrieve(anyString())).thenReturn(List.of());

        chatService = new ChatService(tripRepository, bookingRepository, voucherService,
                routeRepository, additionalServiceRepository,
                aiService, mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class), mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000));
    }

    private static AdditionalService svc(String code, String category, String name, long price) {
        return new AdditionalService(code, category, name, BigDecimal.valueOf(price));
    }

    private void catalog(AdditionalService... rows) {
        when(additionalServiceRepository.findAll()).thenReturn(List.of(rows));
    }

    /** System prompt mà ChatService gửi cho model trong một lượt chat. */
    private String captureSystemInstruction() {
        chatService.getChatResponse("gợi ý món ăn", null, "session-1", List.of(), "vi", null);
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(aiService).getChatResponse(captor.capture(), anyList(), anyString(), any());
        return captor.getValue();
    }

    @Test
    @DisplayName("Trả về đúng tên và giá của từng dịch vụ trong danh mục")
    void listsCatalogWithNameAndPrice() {
        catalog(svc("MEAL_MY_Y", "MEAL", "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều", 99000),
                svc("BAGGAGE_20KG", "BAGGAGE", "Hành lý ký gửi 20kg", 250000));

        String result = chatService.executeTool("get_addon_services", Map.of());

        assertThat(result).contains("Combo Mỳ Ý").contains("99.000");
        assertThat(result).contains("Hành lý ký gửi 20kg").contains("250.000");
        assertThat(result).contains("Suất ăn").contains("Hành lý");
    }

    @Test
    @DisplayName("Lọc theo nhóm chỉ trả về đúng nhóm đó")
    void filtersByCategory() {
        catalog(svc("MEAL_MY_Y", "MEAL", "Suất ăn - Combo Mỳ Ý", 99000),
                svc("INSURANCE_BASIC", "INSURANCE", "Bảo hiểm du lịch cơ bản", 49000));

        String result = chatService.executeTool("get_addon_services", Map.of("category", "meal"));

        assertThat(result).contains("Combo Mỳ Ý");
        assertThat(result).doesNotContain("Bảo hiểm du lịch");
    }

    @Test
    @DisplayName("Danh mục rỗng trả về câu nói rõ là chưa có, không trả về chuỗi rỗng")
    void emptyCatalogSaysSo() {
        catalog();

        // Chuỗi rỗng sẽ bị model diễn giải tùy ý; một câu khẳng định rõ ràng thì không.
        assertThat(chatService.executeTool("get_addon_services", Map.of()))
                .contains("chưa có dịch vụ mua kèm");
        assertThat(chatService.executeTool("get_addon_services", Map.of("category", "MEAL")))
                .contains("Không có dịch vụ mua kèm");
    }

    @Test
    @DisplayName("Dòng chưa có nhóm vẫn được liệt kê, xếp vào Khác chứ không bị bỏ qua")
    void rowsWithoutCategoryStillListed() {
        catalog(svc(null, null, "Dịch vụ do quản trị viên tự thêm", 15000));

        String result = chatService.executeTool("get_addon_services", Map.of());

        assertThat(result).contains("Khác").contains("tự thêm");
    }

    @Test
    @DisplayName("System prompt buộc model gọi công cụ thay vì tự nghĩ ra món ăn")
    void systemPromptForbidsInventingMeals() {
        String prompt = captureSystemInstruction();

        assertThat(prompt).contains("get_addon_services");
        assertThat(prompt).contains("CHỈ NÓI ĐIỀU CÓ CĂN CỨ");
    }

    @Test
    @DisplayName("System prompt cho phép nói thẳng là chưa có thông tin")
    void systemPromptAllowsSayingItDoesNotKnow() {
        String prompt = captureSystemInstruction();

        // Luật cấm lộ cấu trúc hệ thống từng khiến model không còn cách nào từ chối tự
        // nhiên, nên nó lấp khoảng trống bằng câu trả lời tự nghĩ.
        assertThat(prompt).contains("mình chưa có thông tin này");
    }
}
