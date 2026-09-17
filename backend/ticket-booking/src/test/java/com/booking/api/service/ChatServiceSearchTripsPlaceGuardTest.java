package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.weather.WeatherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Mã điểm là tham số duy nhất của {@code search_trips} do MODEL tự nghĩ ra, và là chỗ nó bịa mà
 * không có gì kêu lên.
 *
 * <p>Ca thật, đo ngày 16/09: khách hỏi "tìm vé đi Quy Nhơn". Quy Nhơn không có trong bảng mã của
 * VigoTrip. Thăm dò 12 lần ở temperature 0 thì cả 12 lần model truyền {@code destination=UIH} —
 * mã IATA thật của sân bay Phù Cát, đúng ngoài đời nhưng hệ thống không hề có; ở temperature 0.7
 * thì 2/12 lần nó lùi về {@code QNH}, mà {@code QNH} là Quảng Ninh, cách Quy Nhơn hơn 800 km.
 *
 * <p>Chỗ tệ không nằm ở việc model đoán — nó sẽ luôn đoán chừng nào bảng mã chưa nói mã nào là
 * nơi nào. Chỗ tệ là ba tầng phía sau đều im lặng: câu LIKE không khớp tuyến nào nên trả rỗng,
 * khách nghe thành "hết vé" thay vì "chưa hỗ trợ", và mã bịa còn đọng lại trong bộ nhớ phiên để
 * làm điểm đến mặc định cho những lượt sau. Lớp test này khoá đúng ba chỗ im lặng đó.
 */
class ChatServiceSearchTripsPlaceGuardTest {

    private static final String PHIEN = "phien-test";

    private TripRepository tripRepository;
    private AIService aiService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        tripRepository = mock(TripRepository.class);
        BookingRepository bookingRepository = mock(BookingRepository.class);
        RouteRepository routeRepository = mock(RouteRepository.class);
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        VoucherService voucherService = mock(VoucherService.class);
        aiService = mock(AIService.class);

        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN", "QNH"));
        when(hybridRetriever.retrieveForLanguage(anyString(), any())).thenReturn(List.of());
        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of());

        chatService = new ChatService(tripRepository, bookingRepository, voucherService,
                routeRepository, mock(AdditionalServiceRepository.class),
                mock(WeatherService.class), aiService, mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class), mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000), mock(ChatActionService.class));
    }

    private String timChuyen(Map<String, Object> thamSo) {
        return chatService.executeTool("search_trips", thamSo, PHIEN);
    }

    private static Map<String, Object> thamSo(String... capKhoaGiaTri) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < capKhoaGiaTri.length; i += 2) {
            map.put(capKhoaGiaTri[i], capKhoaGiaTri[i + 1]);
        }
        return map;
    }

    private static Trip chuyen(String diemDi, String diemDen) {
        Route tuyen = new Route();
        tuyen.setOrigin(diemDi);
        tuyen.setDestination(diemDen);

        Trip trip = new Trip();
        trip.setRoute(tuyen);
        trip.setPrice(BigDecimal.valueOf(1200000));
        trip.setDepartureTime(LocalDateTime.now().plusDays(1));
        return trip;
    }

    /**
     * Chạy một lượt chat rồi lấy ra system prompt mà ChatService đã dựng cho phiên đó.
     *
     * <p>Để trống email: khoá của bộ nhớ phiên là email khi khách đã đăng nhập, và là sessionKey
     * khi chưa — truyền email vào đây thì lượt chat đọc một khoá khác với khoá mà
     * {@link #timChuyen} vừa ghi, và mọi khẳng định về bộ nhớ phiên thành vô nghĩa.
     */
    private String promptCuaPhien() {
        chatService.getChatResponse("còn vé không", null, PHIEN, List.of(), "vi", null);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(aiService).getChatResponse(captor.capture(), anyList(), anyString(), any());
        return captor.getValue();
    }

    @Test
    @DisplayName("Mã ngoài danh mục thì nói chưa hỗ trợ, không đem đi tra")
    void maNgoaiDanhMucThiNoiChuaHoTro() {
        String ketQua = timChuyen(thamSo("destination", "UIH"));

        // Câu trả lời phải phân biệt được "chưa hỗ trợ nơi này" với "hết vé": trước đây cả hai ra
        // cùng một câu, nên khách hiểu là VigoTrip có tuyến đi Quy Nhơn mà hôm nay hết chỗ.
        assertThat(ketQua)
                .contains("UIH")
                .contains("chưa hỗ trợ")
                .doesNotContain("Không tìm thấy chuyến đi phù hợp");
        // Kèm danh sách nơi tra được, để câu từ chối còn dùng được chứ không cụt lủn.
        assertThat(ketQua).contains("Hà Nội").contains("Hạ Long");

        verifyNoInteractions(tripRepository);
    }

    @Test
    @DisplayName("Mã bịa không đọng lại làm điểm đến mặc định cho lượt sau")
    void maBiaKhongDongLaiTrongBoNhoPhien() {
        timChuyen(thamSo("destination", "UIH"));

        String prompt = promptCuaPhien();

        // Đây là nửa âm thầm nhất của lỗi: lượt sau khách chỉ hỏi "còn vé không", prompt tự kèm
        // theo một điểm đến không có thật và model trả lời tiếp như thể nơi đó có tuyến.
        assertThat(prompt)
                .as("bộ nhớ phiên không được giữ mã model bịa ra")
                .doesNotContain("Khách hàng đang quan tâm tuyến đường");
    }

    @Test
    @DisplayName("Mã có thật được giữ nguyên và ghi vào bộ nhớ phiên kèm tên nơi")
    void maCoThatVanChayBinhThuong() {
        when(tripRepository.searchTripsFlexible(anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of());

        timChuyen(thamSo("origin", "HAN", "destination", "QNH"));

        // QNH là mã CÓ THẬT (Hạ Long). Bản sửa chấm theo luật "có trong danh mục không", nên nó
        // không được cấm QNH theo giá trị — cấm theo từng giá trị đúng là thứ đã để lọt UIH.
        verify(tripRepository).searchTripsFlexible(eq("HAN"), eq("QNH"), any(), any(), any(), any());

        String prompt = promptCuaPhien();
        assertThat(prompt).contains("Từ HAN (Hà Nội)").contains("Đến QNH (Hạ Long)");
    }

    @Test
    @DisplayName("Model gửi tên thành phố thay vì mã thì tool tự đổi, không tra bằng tên")
    void tenThanhPhoDuocDoiRaMa() {
        when(tripRepository.searchTripsFlexible(anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of());

        timChuyen(thamSo("origin", "Hà Nội", "destination", "Đà Nẵng"));

        // Trước đây chuỗi "Đà Nẵng" đi thẳng vào câu LIKE trên cột mã rồi không khớp tuyến nào —
        // cũng là một đường trả rỗng êm đẹp, chỉ khác là do model gửi tên chứ không do bịa mã.
        verify(tripRepository).searchTripsFlexible(eq("HAN"), eq("DAD"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Thiếu điểm đi thì link không mang chữ null")
    void linkKhongMangChuNull() {
        when(tripRepository.searchTripsFlexible(any(), anyString(), any(), any(), any(), any()))
                .thenReturn(List.of(chuyen("HAN", "SGN")));

        String ketQua = timChuyen(thamSo("destination", "SGN"));

        assertThat(ketQua).contains("[LINK:").contains("to=SGN").doesNotContain("from=null");
    }

    @Test
    @DisplayName("Danh sách mã trong hướng dẫn đi kèm tên nơi")
    void danhSachMaKemTenNoi() {
        // "QNH" trần là thứ model phải tự đoán nghĩa, và nó đoán là Quy Nhơn.
        assertThat(ChatService.placeCodesWithNames("HAN, QNH, SGN"))
                .isEqualTo("Hà Nội=HAN, Hạ Long=QNH, TP. Hồ Chí Minh=SGN");

        // Mã lạ trong danh mục tuyến thì để trần chứ không bị bỏ đi: danh mục tuyến mới là nguồn
        // sự thật cho "đang có chuyến".
        assertThat(ChatService.placeCodesWithNames("HAN, ZZZ")).isEqualTo("Hà Nội=HAN, ZZZ");
    }
}
