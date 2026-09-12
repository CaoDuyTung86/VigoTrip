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
import java.util.ArrayList;
import java.util.List;
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

    /** Dự báo một ngày kèm ngày của nó, dùng cho khoảng nhiều ngày. */
    public record DatedForecast(LocalDate date, DailyForecast forecast) {
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
        return fetch(cityId, latitude, longitude, date, date).stream()
                .findFirst()
                .map(DatedForecast::forecast);
    }

    /**
     * Dự báo cho một khoảng ngày, trong MỘT lời gọi ra ngoài.
     *
     * <p>Không phải là vòng lặp gọi {@link #daily} nhiều lần, và đó là điểm chính. Trợ lý AI hỏi
     * "ba ngày cuối tuần ở Đà Nẵng thế nào" ngay giữa một lượt chat mà khách đang ngồi chờ; ba
     * lời gọi nối đuôi nhau, mỗi lời chờ tối đa bốn giây, là một lượt chat treo mười hai giây khi
     * nguồn dữ liệu chậm. Open-Meteo vốn nhận {@code start_date} và {@code end_date}, nên một lời
     * gọi là đủ.
     *
     * <p>Ngày nào thiếu dữ liệu lõi thì bị bỏ khỏi danh sách chứ không kéo cả khoảng xuống rỗng:
     * mất một ngày giữa tuần vẫn còn sáu ngày dùng được.
     *
     * @return danh sách theo đúng thứ tự ngày; rỗng khi không lấy được gì
     */
    @Cacheable(value = "weather", key = "#cityId + '|' + #start + '|' + #end")
    public List<DatedForecast> range(String cityId, double latitude, double longitude,
                                     LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            return List.of();
        }
        return fetch(cityId, latitude, longitude, start, end);
    }

    private List<DatedForecast> fetch(String cityId, double latitude, double longitude,
                                      LocalDate start, LocalDate end) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("latitude", latitude)
                .queryParam("longitude", longitude)
                .queryParam("daily", "weather_code,temperature_2m_max,temperature_2m_min,"
                        + "precipitation_probability_max")
                .queryParam("timezone", timezone)
                .queryParam("start_date", start)
                .queryParam("end_date", end)
                .build()
                .toUri();

        try {
            JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
            return parse(body, start, end);
        } catch (Exception e) {
            log.warn("[Weather] Không lấy được dự báo cho {} từ {} đến {}: {}", cityId, start, end, e.toString());
            return List.of();
        }
    }

    /**
     * Đọc mảng {@code daily} của Open-Meteo.
     *
     * <p>Bắt buộc phải có mã thời tiết và cả hai mốc nhiệt độ. Thiếu một trong ba thì coi như
     * không có dự báo, vì hiện ra một khối chỉ có nhiệt độ cao mà không có nhiệt độ thấp thì
     * khách đọc còn khó hiểu hơn là không hiện gì. Riêng xác suất mưa được phép thiếu — nó là
     * phần thêm, không phải phần lõi.
     *
     * <p>Ngày lấy từ mảng {@code time} của chính phản hồi, không phải đếm từ {@code start}: nếu
     * nhà cung cấp trả thiếu hay lệch ngày thì đếm tay sẽ gán dự báo của hôm nay cho ngày mai.
     * Chỉ khi mảng {@code time} vắng mặt mới suy ra ngày, và chỉ suy cho khoảng đúng một ngày.
     */
    private List<DatedForecast> parse(JsonNode body, LocalDate start, LocalDate end) {
        if (body == null) {
            return List.of();
        }
        JsonNode daily = body.path("daily");
        JsonNode codes = daily.path("weather_code");
        JsonNode maxima = daily.path("temperature_2m_max");
        JsonNode minima = daily.path("temperature_2m_min");

        if (!codes.isArray() || !maxima.isArray() || !minima.isArray()) {
            return List.of();
        }

        JsonNode times = daily.path("time");
        JsonNode rainOdds = daily.path("precipitation_probability_max");

        int size = Math.min(codes.size(), Math.min(maxima.size(), minima.size()));
        List<DatedForecast> result = new ArrayList<>(size);

        for (int i = 0; i < size; i++) {
            if (codes.get(i).isNull() || maxima.get(i).isNull() || minima.get(i).isNull()) {
                continue;
            }
            LocalDate date = dateAt(times, i, start, end);
            if (date == null) {
                continue;
            }
            Integer precipitation = rainOdds.isArray() && rainOdds.size() > i && !rainOdds.get(i).isNull()
                    ? rainOdds.get(i).asInt()
                    : null;

            result.add(new DatedForecast(date, new DailyForecast(
                    codes.get(i).asInt(),
                    minima.get(i).asDouble(),
                    maxima.get(i).asDouble(),
                    precipitation)));
        }
        return List.copyOf(result);
    }

    private LocalDate dateAt(JsonNode times, int index, LocalDate start, LocalDate end) {
        if (times.isArray() && times.size() > index && !times.get(index).isNull()) {
            try {
                return LocalDate.parse(times.get(index).asText());
            } catch (Exception e) {
                return null;
            }
        }
        // Không có mảng ngày: chỉ chấp nhận được khi cả khoảng vỏn vẹn một ngày, còn lại thì
        // không có cách nào biết phần tử thứ i là ngày nào mà không đoán.
        return index == 0 && start.equals(end) ? start : null;
    }
}
