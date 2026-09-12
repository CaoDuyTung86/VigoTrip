package com.booking.api.weather;

import com.booking.api.catalog.PlaceCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Dự báo thời tiết cho một điểm đến vào một ngày.
 *
 * <p>Chỗ nó có giá trị là nơi khách đã có sẵn cả địa điểm lẫn ngày: trang chi tiết chuyến trước
 * khi trả tiền, và danh sách vé sắp đi. Cố tình KHÔNG đưa lên dải tin chạy — dải tin là kênh một
 * nội dung cho mọi người, mà "Hà Nội 28°C" hiện cho khách đang xem chuyến Sài Gòn - Phú Quốc thì
 * chỉ là chữ chạy vô nghĩa chiếm chỗ của một mã giảm giá thật.
 *
 * <p><b>Tầm dự báo ngắn hơn tầm bán vé.</b> Kho chuyến luôn phủ 30 ngày, còn dự báo miễn phí chỉ
 * xa được 7 tới 16 ngày và sau ngày thứ bảy thì độ tin cậy rất thấp. Nên phần lớn lượt đặt vé sẽ
 * KHÔNG có dự báo, và đó là trạng thái bình thường chứ không phải lỗi. Tuyệt đối không lấp chỗ
 * trống bằng trung bình khí hậu nhiều năm rồi trình bày như dự báo: đó là bịa một con số có vẻ
 * chính xác.
 *
 * <p><b>Chỉ mô tả, không suy diễn.</b> Trả về nhiệt độ, mã thời tiết WMO và xác suất mưa. Không
 * bao giờ suy ra khả năng hoãn hay huỷ chuyến. Chữ "mưa to" nằm cạnh nút thanh toán vốn đã rất
 * dễ bị đọc thành "chuyến này sẽ delay"; thêm một câu phán đoán nữa là biến dự báo sai thành
 * khiếu nại về tiền.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    /**
     * Xa nhất bao nhiêu ngày thì còn hiện dự báo.
     *
     * <p>Bảy chứ không phải mười sáu: Open-Meteo trả xa hơn, nhưng qua mốc một tuần thì con số
     * gần như không còn giá trị để khách dựa vào mà quyết định mang ô hay đi sớm hơn. Hiện một
     * dự báo mà chính mình không tin là mời khách trách nhầm.
     */
    public static final int FORECAST_HORIZON_DAYS = 7;

    /** Dòng ghi nguồn, hiện ngay dưới khối thời tiết. Open-Meteo cấp theo giấy phép CC-BY-4.0. */
    public static final String SOURCE = "Open-Meteo";

    private final OpenMeteoClient openMeteoClient;

    @Value("${app.weather.enabled:true}")
    private boolean enabled;

    /**
     * Dự báo cho một mã điểm vào một ngày.
     *
     * @param placeCode mã điểm như trong tuyến đường, ví dụ {@code DAD}; hai mã của cùng một
     *                  thành phố cho ra cùng một kết quả
     * @return rỗng khi tính năng bị tắt, mã điểm chưa có toạ độ, ngày nằm ngoài tầm dự báo, hoặc
     *         Open-Meteo không trả lời được. Mọi trường hợp đều là "ẩn khối thời tiết đi", không
     *         phải lỗi để ném ra cho người dùng
     */
    public Optional<WeatherForecast> forecastFor(String placeCode, LocalDate date) {
        if (!enabled || date == null) {
            return Optional.empty();
        }
        if (!withinHorizon(date)) {
            return Optional.empty();
        }

        Optional<PlaceCatalog.Place> place = PlaceCatalog.find(placeCode);
        if (place.isEmpty()) {
            log.debug("[Weather] Mã điểm {} chưa có toạ độ, bỏ qua dự báo.", placeCode);
            return Optional.empty();
        }

        PlaceCatalog.Place noiDen = place.get();
        return openMeteoClient
                .daily(noiDen.cityId(), noiDen.latitude(), noiDen.longitude(), date)
                .map(daily -> new WeatherForecast(
                        placeCode.trim().toUpperCase(),
                        noiDen.cityId(),
                        noiDen.nameVi(),
                        noiDen.nameEn(),
                        date,
                        daily.weatherCode(),
                        daily.temperatureMinC(),
                        daily.temperatureMaxC(),
                        daily.precipitationProbability(),
                        SOURCE));
    }

    /** Hôm nay tính là trong tầm; quá khứ thì không, vì cái đã xảy ra không còn là dự báo. */
    public boolean withinHorizon(LocalDate date) {
        LocalDate today = LocalDate.now();
        return !date.isBefore(today) && !date.isAfter(today.plusDays(FORECAST_HORIZON_DAYS));
    }
}
