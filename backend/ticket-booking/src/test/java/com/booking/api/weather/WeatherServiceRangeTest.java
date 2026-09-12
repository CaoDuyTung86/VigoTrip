package com.booking.api.weather;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Khoảng ngày do trợ lý AI xin luôn có thể lệch ra ngoài tầm dự báo — khách hỏi "tuần sau" mà
 * hôm nay đã là thứ Sáu thì nửa sau của tuần đó nằm ngoài bảy ngày. Chỗ này chọn CẮT BỚT chứ
 * không từ chối cả khoảng: bốn ngày có thật vẫn hơn không có gì, miễn là nơi gọi nhìn vào danh
 * sách trả về là biết mình bị cắt để còn nói với khách.
 */
@ExtendWith(MockitoExtension.class)
class WeatherServiceRangeTest {

    @Mock
    private OpenMeteoClient openMeteoClient;

    @InjectMocks
    private WeatherService weatherService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(weatherService, "enabled", true);
        lenient().when(openMeteoClient.range(anyString(), anyDouble(), anyDouble(), any(), any()))
                .thenReturn(List.of(new OpenMeteoClient.DatedForecast(
                        LocalDate.now(), new OpenMeteoClient.DailyForecast(0, 24.0, 31.0, 10))));
    }

    @Test
    @DisplayName("Tra được theo tên nơi, không chỉ theo mã điểm")
    void traDuocTheoTenNoi() {
        List<WeatherForecast> duBao = weatherService
                .forecastRange("Đà Nẵng", LocalDate.now(), LocalDate.now());

        assertEquals(1, duBao.size());
        assertEquals("DAD", duBao.get(0).placeCode());
        assertEquals("Đà Nẵng", duBao.get(0).cityNameVi());
        assertEquals("Open-Meteo", duBao.get(0).source());
    }

    @Test
    @DisplayName("Phần vượt quá bảy ngày bị cắt trước khi đi hỏi")
    void catPhanVuotTam() {
        LocalDate homNay = LocalDate.now();
        weatherService.forecastRange("DAD", homNay, homNay.plusDays(30));

        ArgumentCaptor<LocalDate> ketThuc = ArgumentCaptor.forClass(LocalDate.class);
        verify(openMeteoClient).range(anyString(), anyDouble(), anyDouble(), any(), ketThuc.capture());
        assertEquals(homNay.plusDays(WeatherService.FORECAST_HORIZON_DAYS), ketThuc.getValue());
    }

    @Test
    @DisplayName("Phần đã qua bị kéo về hôm nay, không đi hỏi quá khứ")
    void keoPhanDaQuaVeHomNay() {
        LocalDate homNay = LocalDate.now();
        weatherService.forecastRange("DAD", homNay.minusDays(5), homNay.plusDays(1));

        ArgumentCaptor<LocalDate> batDau = ArgumentCaptor.forClass(LocalDate.class);
        verify(openMeteoClient).range(anyString(), anyDouble(), anyDouble(), batDau.capture(), any());
        assertEquals(homNay, batDau.getValue());
    }

    @Test
    @DisplayName("Cả khoảng nằm ngoài tầm thì không hỏi gì cả")
    void caKhoangNgoaiTamThiKhongHoi() {
        LocalDate homNay = LocalDate.now();

        assertTrue(weatherService.forecastRange("DAD", homNay.plusDays(20), homNay.plusDays(25)).isEmpty());
        assertTrue(weatherService.forecastRange("DAD", homNay.minusDays(9), homNay.minusDays(2)).isEmpty());
        verifyNoInteractions(openMeteoClient);
    }

    @Test
    @DisplayName("Nơi lạ thì rỗng chứ không đoán sang nơi gần giống")
    void noiLaThiRong() {
        assertTrue(weatherService.forecastRange("Tokyo", LocalDate.now(), LocalDate.now()).isEmpty());
        verifyNoInteractions(openMeteoClient);
    }

    @Test
    @DisplayName("Tắt tính năng thì rỗng, kể cả khi mọi thứ khác hợp lệ")
    void tatTinhNangThiRong() {
        ReflectionTestUtils.setField(weatherService, "enabled", false);

        assertTrue(weatherService.forecastRange("DAD", LocalDate.now(), LocalDate.now()).isEmpty());
        verifyNoInteractions(openMeteoClient);
    }
}
