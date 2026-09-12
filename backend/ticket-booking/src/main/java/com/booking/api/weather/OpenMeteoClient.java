package com.booking.api.weather;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Lấy dự báo một ngày từ Open-Meteo.
 *
 * <p>Chọn Open-Meteo vì nó không cần khoá API. Cả hai tính năng dùng khoá hiện nay (trợ lý AI và
 * gửi thư) đều theo cùng một kỷ luật: thiếu khoá thì mất tính năng chứ hệ thống vẫn chạy. Ở đây
 * còn đỡ hơn, không có khoá nào để mà thiếu.
 *
 * <p><b>Hỏng là im lặng, không phải là vỡ.</b> Mọi lỗi — mạng, hết giờ chờ, JSON đổi hình dạng —
 * đều trả về rỗng. Khối thời tiết nằm ngay cạnh nút thanh toán, nên nguyên tắc là nó biến mất
 * chứ tuyệt đối không được chặn luồng đặt vé. Cũng vì thế mà giờ chờ đặt rất ngắn.
 *
 * <p><b>Cache cả kết quả rỗng.</b> Nếu chỉ cache lần lấy được, thì lúc Open-Meteo trục trặc mỗi
 * lượt xem trang lại phải chờ hết giờ chờ rồi mới chịu bỏ cuộc. Cache cả lượt hỏng nghĩa là một
 * cặp (thành phố, ngày) im lặng trong vòng một tiếng — đổi lại không có chuyện dồn lời gọi vào
 * một dịch vụ đang yếu.
 *
 * <p>Khoá cache là {@code cityId} chứ không phải mã điểm, để {@code HUI} và {@code HUE} dùng
 * chung một ô thay vì hỏi Open-Meteo hai lần về cùng một Huế.
 */
@Slf4j
@Component
public class OpenMeteoClient {

    /**
     * Dự báo một ngày.
     *
     * @param weatherCode mã thời tiết WMO; tự ánh xạ sang chữ và biểu tượng ở phía giao diện chứ
     *                    không hiện thẳng chuỗi tiếng Anh của nhà cung cấp
     */
    public record DailyForecast(int weatherCode,
                                double temperatureMinC,
                                double temperatureMaxC,
                                Integer precipitationProbability) {
    }

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String timezone;

    public OpenMeteoClient(@Qualifier("weatherRestTemplate") RestTemplate restTemplate,
                           @Value("${app.weather.base-url:https://api.open-meteo.com/v1/forecast}") String baseUrl,
                           @Value("${app.weather.timezone:Asia/Bangkok}") String timezone) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
        this.timezone = timezone;
    }

    @Cacheable(value = "weather", key = "#cityId + '|' + #date")
    public Optional<DailyForecast> daily(String cityId, double latitude, double longitude, LocalDate date) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("latitude", latitude)
                .queryParam("longitude", longitude)
                .queryParam("daily", "weather_code,temperature_2m_max,temperature_2m_min,"
                        + "precipitation_probability_max")
                .queryParam("timezone", timezone)
                .queryParam("start_date", date)
                .queryParam("end_date", date)
                .build()
                .toUri();

        try {
            JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
            return parse(body);
        } catch (Exception e) {
            log.warn("[Weather] Không lấy được dự báo cho {} ngày {}: {}", cityId, date, e.toString());
            return Optional.empty();
        }
    }

    /**
     * Đọc mảng {@code daily} của Open-Meteo.
     *
     * <p>Bắt buộc phải có mã thời tiết và cả hai mốc nhiệt độ. Thiếu một trong ba thì coi như
     * không có dự báo, vì hiện ra một khối chỉ có nhiệt độ cao mà không có nhiệt độ thấp thì
     * khách đọc còn khó hiểu hơn là không hiện gì. Riêng xác suất mưa được phép thiếu — nó là
     * phần thêm, không phải phần lõi.
     */
    private Optional<DailyForecast> parse(JsonNode body) {
        if (body == null) {
            return Optional.empty();
        }
        JsonNode daily = body.path("daily");
        JsonNode codes = daily.path("weather_code");
        JsonNode maxima = daily.path("temperature_2m_max");
        JsonNode minima = daily.path("temperature_2m_min");

        if (!codes.isArray() || !maxima.isArray() || !minima.isArray()
                || codes.isEmpty() || maxima.isEmpty() || minima.isEmpty()
                || codes.get(0).isNull() || maxima.get(0).isNull() || minima.get(0).isNull()) {
            return Optional.empty();
        }

        JsonNode rainOdds = daily.path("precipitation_probability_max");
        Integer precipitation = rainOdds.isArray() && !rainOdds.isEmpty() && !rainOdds.get(0).isNull()
                ? rainOdds.get(0).asInt()
                : null;

        return Optional.of(new DailyForecast(
                codes.get(0).asInt(),
                minima.get(0).asDouble(),
                maxima.get(0).asDouble(),
                precipitation));
    }
}
