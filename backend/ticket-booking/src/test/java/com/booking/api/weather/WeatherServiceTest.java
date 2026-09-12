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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Kho chuyến luôn phủ 30 ngày còn dự báo miễn phí chỉ đáng tin trong vòng một tuần, nên phần lớn
 * lượt đặt vé sẽ KHÔNG có thời tiết để hiện. Đó là trạng thái bình thường, và các test dưới đây
 * khoá lại rằng nó được xử lý bằng cách im lặng chứ không phải bằng cách bịa một con số.
 */
@ExtendWith(MockitoExtension.class)
class WeatherServiceTest {

    @Mock
    private OpenMeteoClient openMeteoClient;

    @InjectMocks
    private WeatherService weatherService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(weatherService, "enabled", true);
        lenient().when(openMeteoClient.daily(anyString(), anyDouble(), anyDouble(), any()))
                .thenReturn(Optional.of(new OpenMeteoClient.DailyForecast(80, 25.1, 31.2, 70)));
    }

    @Test
    @DisplayName("Ngày trong tầm thì trả về dự báo kèm tên nơi đến và nguồn")
    void ngayTrongTamThiCoDuBao() {
        WeatherForecast duBao = weatherService
                .forecastFor("DAD", LocalDate.now().plusDays(2))
                .orElseThrow();

        assertEquals("DAD", duBao.placeCode());
        assertEquals("danang", duBao.cityId());
        assertEquals("Đà Nẵng", duBao.cityNameVi());
        assertEquals(80, duBao.weatherCode());
        assertEquals(25.1, duBao.temperatureMinC(), 0.001);
        // Giấy phép CC-BY-4.0 của Open-Meteo bắt ghi nguồn.
        assertEquals("Open-Meteo", duBao.source());
    }

    @Test
    @DisplayName("Ngoài tầm bảy ngày thì im lặng, và không gọi ra ngoài")
    void ngoaiTamThiKhongGoiRaNgoai() {
        Optional<WeatherForecast> duBao = weatherService
                .forecastFor("DAD", LocalDate.now().plusDays(20));

        assertTrue(duBao.isEmpty(),
                "Qua mốc một tuần thì dự báo gần như không còn giá trị để khách dựa vào");
        verify(openMeteoClient, never()).daily(anyString(), anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("Ngày đã qua thì không phải dự báo nữa")
    void ngayDaQuaThiKhongCo() {
        assertTrue(weatherService.forecastFor("DAD", LocalDate.now().minusDays(1)).isEmpty());
        verify(openMeteoClient, never()).daily(anyString(), anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("Hôm nay vẫn tính là trong tầm")
    void homNayVanTinhLaTrongTam() {
        assertTrue(weatherService.forecastFor("DAD", LocalDate.now()).isPresent());
    }

    @Test
    @DisplayName("Mã điểm chưa có toạ độ thì im lặng")
    void maDiemChuaCoToaDoThiImLang() {
        assertTrue(weatherService.forecastFor("ZZZ", LocalDate.now().plusDays(1)).isEmpty());
        verify(openMeteoClient, never()).daily(anyString(), anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("Hai mã của cùng một thành phố hỏi chung một chỗ")
    void haiMaCungThanhPhoHoiChungMotCho() {
        LocalDate ngay = LocalDate.now().plusDays(1);

        weatherService.forecastFor("HUI", ngay);
        weatherService.forecastFor("HUE", ngay);

        // Khoá cache là cityId, nên Huế đi máy bay và Huế đi tàu dùng chung một ô thay vì hỏi
        // Open-Meteo hai lần về cùng một nơi.
        ArgumentCaptor<String> thanhPho = ArgumentCaptor.forClass(String.class);
        verify(openMeteoClient, org.mockito.Mockito.times(2))
                .daily(thanhPho.capture(), anyDouble(), anyDouble(), any());
        assertEquals(thanhPho.getAllValues().get(0), thanhPho.getAllValues().get(1));
        assertEquals("hue", thanhPho.getAllValues().get(0));
    }

    @Test
    @DisplayName("Tắt tính năng thì im lặng hoàn toàn")
    void tatTinhNangThiImLang() {
        ReflectionTestUtils.setField(weatherService, "enabled", false);

        assertTrue(weatherService.forecastFor("DAD", LocalDate.now().plusDays(1)).isEmpty());
        verifyNoInteractions(openMeteoClient);
    }

    @Test
    @DisplayName("Nguồn dữ liệu không trả lời được thì im lặng")
    void nguonKhongTraLoiThiImLang() {
        lenient().when(openMeteoClient.daily(anyString(), anyDouble(), anyDouble(), any()))
                .thenReturn(Optional.empty());

        assertTrue(weatherService.forecastFor("DAD", LocalDate.now().plusDays(1)).isEmpty());
    }
}
