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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trợ lý AI hỏi thời tiết ngay giữa một lượt chat mà khách đang ngồi chờ, nên lấy nhiều ngày phải
 * gọn trong MỘT lời gọi ra ngoài. Bảy lời gọi nối đuôi nhau, mỗi lời chờ tối đa bốn giây, là một
 * lượt chat treo gần nửa phút khi Open-Meteo chậm — mà chậm thì không hiếm với một dịch vụ miễn phí.
 */
@ExtendWith(MockitoExtension.class)
class OpenMeteoClientRangeTest {

    private static final LocalDate BAT_DAU = LocalDate.of(2026, 9, 14);
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
    @DisplayName("Ba ngày chỉ tốn một lời gọi ra ngoài")
    void baNgayMotLoiGoi() throws Exception {
        traVe("""
                {"daily":{"time":["2026-09-14","2026-09-15","2026-09-16"],"weather_code":[80,3,0],
                "temperature_2m_max":[31.2,30.0,29.5],"temperature_2m_min":[25.1,24.8,24.0],
                "precipitation_probability_max":[70,20,5]}}
                """);

        List<OpenMeteoClient.DatedForecast> duBao = client
                .range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(2));

        verify(restTemplate, times(1)).getForObject(any(URI.class), eq(JsonNode.class));
        assertEquals(3, duBao.size());
        assertEquals(BAT_DAU, duBao.get(0).date());
        assertEquals(80, duBao.get(0).forecast().weatherCode());
        assertEquals(BAT_DAU.plusDays(2), duBao.get(2).date());
        assertEquals(0, duBao.get(2).forecast().weatherCode());
    }

    @Test
    @DisplayName("Hỏi đúng khoảng ngày đã xin")
    void hoiDungKhoangNgay() throws Exception {
        traVe("""
                {"daily":{"time":["2026-09-14"],"weather_code":[0],
                "temperature_2m_max":[30.0],"temperature_2m_min":[24.0]}}
                """);

        client.range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(6));

        ArgumentCaptor<URI> duongDan = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).getForObject(duongDan.capture(), eq(JsonNode.class));
        String uri = duongDan.getValue().toString();

        assertTrue(uri.contains("start_date=2026-09-14"), uri);
        assertTrue(uri.contains("end_date=2026-09-20"), uri);
    }

    @Test
    @DisplayName("Ngày lấy từ phản hồi chứ không đếm tay từ ngày bắt đầu")
    void ngayLayTuPhanHoi() throws Exception {
        // Nhà cung cấp trả lệch một ngày so với thứ ta xin. Đếm tay thì dự báo của 15 bị gán cho
        // ngày 14, và không có gì trên màn hình cho thấy là sai.
        traVe("""
                {"daily":{"time":["2026-09-15","2026-09-16"],"weather_code":[61,0],
                "temperature_2m_max":[29.0,30.0],"temperature_2m_min":[24.0,24.5]}}
                """);

        List<OpenMeteoClient.DatedForecast> duBao = client
                .range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(1));

        assertEquals(LocalDate.of(2026, 9, 15), duBao.get(0).date());
        assertEquals(LocalDate.of(2026, 9, 16), duBao.get(1).date());
    }

    @Test
    @DisplayName("Một ngày hỏng thì bỏ đúng ngày đó, không mất cả khoảng")
    void motNgayHongThiChiBoNgayDo() throws Exception {
        traVe("""
                {"daily":{"time":["2026-09-14","2026-09-15","2026-09-16"],"weather_code":[80,3,0],
                "temperature_2m_max":[31.2,null,29.5],"temperature_2m_min":[25.1,24.8,24.0],
                "precipitation_probability_max":[70,20,5]}}
                """);

        List<OpenMeteoClient.DatedForecast> duBao = client
                .range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(2));

        assertEquals(2, duBao.size(), "Mất một ngày giữa tuần vẫn còn hai ngày dùng được");
        assertEquals(LocalDate.of(2026, 9, 14), duBao.get(0).date());
        assertEquals(LocalDate.of(2026, 9, 16), duBao.get(1).date());
    }

    @Test
    @DisplayName("Thiếu xác suất mưa ở một ngày thì ngày đó vẫn có dự báo")
    void thieuXacSuatMuaVanCoDuBao() throws Exception {
        traVe("""
                {"daily":{"time":["2026-09-14","2026-09-15"],"weather_code":[0,0],
                "temperature_2m_max":[30.0,30.0],"temperature_2m_min":[24.0,24.0],
                "precipitation_probability_max":[10,null]}}
                """);

        List<OpenMeteoClient.DatedForecast> duBao = client
                .range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(1));

        assertEquals(10, duBao.get(0).forecast().precipitationProbability());
        assertNull(duBao.get(1).forecast().precipitationProbability());
    }

    @Test
    @DisplayName("Mạng hỏng thì rỗng, không ném lên lượt chat")
    void mangHongThiRong() {
        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenThrow(new ResourceAccessException("connect timed out"));

        assertTrue(client.range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.plusDays(2)).isEmpty());
    }

    @Test
    @DisplayName("Khoảng ngày ngược đời thì rỗng, không đi hỏi")
    void khoangNguocDoiThiRong() {
        assertTrue(client.range("danang", 16.0544, 108.2022, BAT_DAU, BAT_DAU.minusDays(1)).isEmpty());
        assertTrue(client.range("danang", 16.0544, 108.2022, null, BAT_DAU).isEmpty());
    }

    private void traVe(String json) throws Exception {
        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(MAPPER.readTree(json));
    }
}
