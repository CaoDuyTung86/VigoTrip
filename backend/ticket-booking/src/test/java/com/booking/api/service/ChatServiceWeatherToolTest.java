package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.weather.WeatherForecast;
import com.booking.api.weather.WeatherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Công cụ thời tiết là công cụ đầu tiên của chatbot đọc dữ liệu từ NGOÀI hệ thống, và cũng là
 * công cụ dễ bị hiểu sai nhất: chữ "mưa to" nằm cạnh nút thanh toán rất dễ bị đọc thành "chuyến
 * này sẽ hoãn". Nên phần được khoá kỹ nhất ở đây không phải là lúc lấy được số liệu, mà là bốn
 * đường KHÔNG lấy được — mỗi đường phải nói rõ là chưa có, chứ không để một câu mơ hồ cho model
 * tự lấp bằng hiểu biết chung về khí hậu.
 */
class ChatServiceWeatherToolTest {

    private static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private WeatherService weatherService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        TripRepository tripRepository = mock(TripRepository.class);
        BookingRepository bookingRepository = mock(BookingRepository.class);
        VoucherService voucherService = mock(VoucherService.class);
        RouteRepository routeRepository = mock(RouteRepository.class);
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        weatherService = mock(WeatherService.class);

        chatService = new ChatService(tripRepository, bookingRepository, voucherService,
                routeRepository, mock(AdditionalServiceRepository.class),
                weatherService, mock(AIService.class), mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class), mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000));
    }

    private static WeatherForecast duBao(LocalDate ngay, int ma, double min, double max, Integer mua) {
        return new WeatherForecast("DAD", "danang", "Đà Nẵng", "Da Nang", ngay, ma, min, max, mua,
                WeatherService.SOURCE);
    }

    private String goi(Map<String, Object> thamSo) {
        return chatService.executeTool("get_weather_forecast", thamSo, "phien-test");
    }

    @Test
    @DisplayName("Khách gõ tên thành phố thì tool tự đổi ra mã, không bắt model đoán")
    void tenThanhPhoTuDoiRaMa() {
        LocalDate mai = LocalDate.now().plusDays(1);
        when(weatherService.forecastRange(eq("DAD"), any(), any()))
                .thenReturn(List.of(duBao(mai, 80, 25.1, 31.4, 70)));

        String ketQua = goi(Map.of("place", "Đà Nẵng", "date", mai.toString()));

        assertThat(ketQua)
                .contains("Đà Nẵng")
                .contains("DAD")
                .contains(mai.format(NGAY))
                .contains("mưa rào")
                .contains("25-31°C")
                .contains("khả năng mưa 70%")
                .contains(WeatherService.SOURCE);
    }

    @Test
    @DisplayName("Mọi kết quả đều kèm câu cấm suy ra hoãn huỷ chuyến")
    void moiKetQuaDeuKemCauCam() {
        LocalDate homNay = LocalDate.now();
        when(weatherService.forecastRange(anyString(), any(), any()))
                .thenReturn(List.of(duBao(homNay, 95, 24.0, 30.0, 90)));

        // Dông, 90% mưa: đúng kiểu số liệu khiến model muốn nói thêm một câu về chuyến bay.
        String coSoLieu = goi(Map.of("place", "DAD"));
        String khongCoSoLieu = goi(Map.of("place", "Tokyo"));

        for (String ketQua : new String[] { coSoLieu, khongCoSoLieu }) {
            assertThat(ketQua)
                    .as("Câu chặn phải đi kèm CẢ kết quả rỗng, vì đó là lúc model dễ tự lấp nhất")
                    .contains("KHÔNG suy ra")
                    .contains("hoãn");
        }
    }

    @Test
    @DisplayName("Xin nhiều ngày thì trả nhiều dòng, mỗi ngày một dòng")
    void nhieuNgayTraNhieuDong() {
        LocalDate homNay = LocalDate.now();
        when(weatherService.forecastRange(eq("DAD"), eq(homNay), eq(homNay.plusDays(2))))
                .thenReturn(List.of(
                        duBao(homNay, 0, 24.0, 31.0, 5),
                        duBao(homNay.plusDays(1), 3, 25.0, 30.0, 20),
                        duBao(homNay.plusDays(2), 63, 24.0, 28.0, 80)));

        String ketQua = goi(Map.of("place", "Đà Nẵng", "date", homNay.toString(), "days", 3));

        assertThat(ketQua)
                .contains(homNay.format(NGAY) + ": trời quang")
                .contains(homNay.plusDays(1).format(NGAY) + ": nhiều mây")
                .contains(homNay.plusDays(2).format(NGAY) + ": mưa")
                .doesNotContain("CHƯA CÓ dự báo");
    }

    @Test
    @DisplayName("Xin bảy ngày mà chỉ có ba thì phải nói ra bốn ngày còn lại là chưa có")
    void thieuNgayThiPhaiNoiRa() {
        LocalDate homNay = LocalDate.now();
        when(weatherService.forecastRange(anyString(), any(), any()))
                .thenReturn(List.of(
                        duBao(homNay, 0, 24.0, 31.0, 5),
                        duBao(homNay.plusDays(1), 0, 24.0, 31.0, 5),
                        duBao(homNay.plusDays(2), 0, 24.0, 31.0, 5)));

        String ketQua = goi(Map.of("place", "Đà Nẵng", "days", 7));

        // Im lặng cắt bốn ngày cuối là để khách tưởng mình đã hỏi xong cả tuần.
        assertThat(ketQua)
                .contains("CHƯA CÓ dự báo")
                .contains(homNay.plusDays(3).format(NGAY));
    }

    @Test
    @DisplayName("Ngoài tầm bảy ngày thì không hỏi nguồn, và nói thẳng là chưa có")
    void ngoaiTamThiKhongHoiNguon() {
        String ketQua = goi(Map.of("place", "Đà Nẵng", "date", LocalDate.now().plusDays(30).toString()));

        assertThat(ketQua).contains("Chưa có dự báo").contains("7 ngày tới");
        // Biết chắc là ngoài tầm thì đi ra ngoài mạng làm gì cho khách phải chờ.
        verifyNoInteractions(weatherService);
    }

    @Test
    @DisplayName("Ngày đã qua thì nói là đã qua, không trả thời tiết hôm nay thay thế")
    void ngayDaQuaThiNoiDaQua() {
        String ketQua = goi(Map.of("place", "Đà Nẵng", "date", LocalDate.now().minusDays(3).toString()));

        assertThat(ketQua).contains("đã qua");
        verifyNoInteractions(weatherService);
    }

    @Test
    @DisplayName("Nơi ngoài danh mục thì nói chưa hỗ trợ kèm danh sách nơi tra được")
    void noiNgoaiDanhMucThiMachLai() {
        String ketQua = goi(Map.of("place", "Tokyo"));

        assertThat(ketQua)
                .contains("Chưa có dữ liệu thời tiết")
                .contains("Tokyo")
                .contains("Đà Nẵng");
        // Không có toạ độ thì không có gì để hỏi Open-Meteo.
        verifyNoInteractions(weatherService);
    }

    @Test
    @DisplayName("Nguồn dữ liệu im lặng thì nói chưa tra được, không bịa con số")
    void nguonImLangThiNoiChuaTraDuoc() {
        when(weatherService.forecastRange(anyString(), any(), any())).thenReturn(List.of());

        String ketQua = goi(Map.of("place", "Đà Nẵng"));

        assertThat(ketQua).contains("chưa lấy được dự báo").contains("Đà Nẵng");
    }

    @Test
    @DisplayName("Ngày model gửi lên đọc không nổi thì hỏi lại, không lặng lẽ trả về hôm nay")
    void ngayDocKhongNoiThiHoiLai() {
        String ketQua = goi(Map.of("place", "Đà Nẵng", "date", "cuối tuần này"));

        assertThat(ketQua).contains("Không đọc được ngày");
        verifyNoInteractions(weatherService);
    }

    @Test
    @DisplayName("Thiếu tham số nơi thì hỏi lại chứ không đoán một thành phố")
    void thieuNoiThiHoiLai() {
        assertThat(goi(Map.of())).contains("Cần biết khách hỏi thời tiết ở đâu");
        verifyNoInteractions(weatherService);
    }

    @Test
    @DisplayName("Số ngày lạ thì kẹp về khoảng cho phép chứ không làm hỏng cả lượt hỏi")
    void soNgayLaThiKep() {
        LocalDate homNay = LocalDate.now();
        when(weatherService.forecastRange(anyString(), any(), any()))
                .thenReturn(List.of(duBao(homNay, 0, 24.0, 31.0, null)));

        // 99 ngày kẹp xuống 7, 0 ngày và chữ vớ vẩn đều về mặc định 1 ngày.
        for (Object soNgay : new Object[] { 99, 0, -5, "ba" }) {
            assertThat(goi(Map.of("place", "Đà Nẵng", "days", soNgay)))
                    .as("days=" + soNgay)
                    .contains("DỰ BÁO THỜI TIẾT TẠI");
        }
    }

    @Test
    @DisplayName("Thiếu xác suất mưa thì bỏ hẳn phần đó, không viết 0%")
    void thieuXacSuatMuaThiBoHan() {
        when(weatherService.forecastRange(anyString(), any(), any()))
                .thenReturn(List.of(duBao(LocalDate.now(), 1, 24.0, 31.0, null)));

        // 0% là một lời khẳng định trời không mưa; thiếu dữ liệu thì không được khẳng định gì.
        assertThat(goi(Map.of("place", "Đà Nẵng"))).contains("ít mây").doesNotContain("khả năng mưa");
    }
}
