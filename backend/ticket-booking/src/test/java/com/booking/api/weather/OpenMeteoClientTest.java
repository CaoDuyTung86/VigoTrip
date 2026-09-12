package com.booking.api.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khối thời tiết nằm ngay cạnh nút thanh toán, nên cách nó HỎNG quan trọng hơn cách nó chạy:
 * mọi đường hỏng đều phải dẫn về "ẩn khối đi", không được ném ngoại lệ lên luồng đặt vé và cũng
 * không được hiện ra một nửa dự báo.
 */
@ExtendWith(MockitoExtension.class)
class OpenMeteoClientTest {

    private static final LocalDate NGAY = LocalDate.of(2026, 9, 14);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    private RestTemplate restTemplate;

    private OpenMeteoClient client;

    @BeforeEach
    void setUp() {
        client = new OpenMeteoClient(restTemplate,
                "https://api.open-meteo.com/v1/forecast", "Asia/Bangkok");
    }

    @Test
    @DisplayName("Đọc đúng dự báo Open-Meteo trả về")
    void docDungDuBao() throws Exception {
        traVe("""
                {"daily":{"time":["2026-09-14"],"weather_code":[80],
                "temperature_2m_max":[31.2],"temperature_2m_min":[25.1],
                "precipitation_probability_max":[70]}}
                """);

        OpenMeteoClient.DailyForecast duBao = client
                .daily("danang", 16.0544, 108.2022, NGAY).orElseThrow();

        assertEquals(80, duBao.weatherCode());
        assertEquals(25.1, duBao.temperatureMinC(), 0.001);
        assertEquals(31.2, duBao.temperatureMaxC(), 0.001);
        assertEquals(70, duBao.precipitationProbability());
    }

    @Test
    @DisplayName("Hỏi đúng toạ độ, đúng ngày và đúng múi giờ")
    void hoiDungThamSo() throws Exception {
        traVe("""
                {"daily":{"weather_code":[0],"temperature_2m_max":[30.0],"temperature_2m_min":[24.0]}}
                """);

        client.daily("danang", 16.0544, 108.2022, NGAY);

        ArgumentCaptor<URI> duongDan = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).getForObject(duongDan.capture(), eq(JsonNode.class));
        String uri = duongDan.getValue().toString();

        assertTrue(uri.contains("latitude=16.0544"), uri);
        assertTrue(uri.contains("longitude=108.2022"), uri);
        assertTrue(uri.contains("start_date=2026-09-14"), uri);
        assertTrue(uri.contains("end_date=2026-09-14"), uri);
        // Cắt ngày theo UTC thì dự báo "ngày 14" lệch mất bảy tiếng so với ngày của khách.
        assertTrue(uri.contains("Bangkok"), uri);
    }

    @Test
    @DisplayName("Xác suất mưa thiếu thì vẫn có dự báo")
    void thieuXacSuatMuaVanCoDuBao() throws Exception {
        traVe("""
                {"daily":{"weather_code":[0],"temperature_2m_max":[30.0],"temperature_2m_min":[24.0]}}
                """);

        OpenMeteoClient.DailyForecast duBao = client
                .daily("danang", 16.0544, 108.2022, NGAY).orElseThrow();

        // Xác suất mưa là phần thêm, không phải phần lõi.
        assertNull(duBao.precipitationProbability());
        assertEquals(0, duBao.weatherCode());
    }

    @Test
    @DisplayName("Thiếu nhiệt độ thì coi như không có dự báo")
    void thieuNhietDoThiCoiNhuKhongCo() throws Exception {
        // Hiện một khối chỉ có nhiệt độ cao mà không có nhiệt độ thấp còn khó hiểu hơn là không
        // hiện gì, nên ở đây phải rỗng chứ không phải điền bừa.
        traVe("""
                {"daily":{"weather_code":[80],"temperature_2m_max":[31.2]}}
                """);

        assertTrue(client.daily("danang", 16.0544, 108.2022, NGAY).isEmpty());
    }

    @Test
    @DisplayName("Thân phản hồi lạ hình dạng thì rỗng chứ không vỡ")
    void thanPhanHoiLaThiRong() throws Exception {
        traVe("""
                {"error":true,"reason":"Invalid date"}
                """);

        assertTrue(client.daily("danang", 16.0544, 108.2022, NGAY).isEmpty());
    }

    @Test
    @DisplayName("Mạng hỏng hay hết giờ chờ thì rỗng, không ném lên luồng đặt vé")
    void mangHongThiRong() {
        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenThrow(new ResourceAccessException("connect timed out"));

        Optional<OpenMeteoClient.DailyForecast> duBao =
                client.daily("danang", 16.0544, 108.2022, NGAY);

        assertTrue(duBao.isEmpty(), "Dịch vụ ngoài hỏng không được phép chặn luồng đặt vé");
    }

    @Test
    @DisplayName("Không có thân phản hồi thì rỗng")
    void khongCoThanPhanHoiThiRong() {
        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class))).thenReturn(null);

        assertTrue(client.daily("danang", 16.0544, 108.2022, NGAY).isEmpty());
    }

    private void traVe(String json) throws Exception {
        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(MAPPER.readTree(json));
    }
}
