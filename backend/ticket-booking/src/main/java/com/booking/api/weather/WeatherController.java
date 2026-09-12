package com.booking.api.weather;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Dự báo thời tiết cho điểm đến của một chuyến. Công khai, vì khách xem chi tiết chuyến trước
 * khi đăng nhập cũng phải thấy.
 */
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    /**
     * GET /api/weather?place=DAD&amp;date=2026-09-14
     *
     * <p>Trả 204 khi không có dự báo — ngày nằm ngoài tầm bảy ngày, mã điểm chưa có toạ độ, hoặc
     * nguồn dữ liệu đang không trả lời. Cả ba đều là "không có gì để hiện" chứ không phải lỗi của
     * người gọi, nên không dùng 4xx: giao diện chỉ cần biết là ẩn khối thời tiết đi.
     *
     * <p>Cache-Control 30 phút khớp với vòng đời dữ liệu phía máy chủ. Thời tiết đổi từng giờ,
     * nhưng dự báo cho MỘT NGÀY thì không đổi từng phút, nên không có lý do gì để mỗi lần khách
     * bấm qua lại giữa hai chuyến là một lần đi hết đường ra Open-Meteo.
     */
    @GetMapping
    public ResponseEntity<WeatherForecast> forecast(
            @RequestParam("place") String place,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        Optional<WeatherForecast> forecast = weatherService.forecastFor(place, date);
        if (forecast.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(30)).cachePublic())
                .body(forecast.get());
    }
}
