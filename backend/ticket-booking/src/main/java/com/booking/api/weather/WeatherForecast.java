package com.booking.api.weather;

import java.time.LocalDate;

/**
 * Dự báo một ngày cho một nơi, đúng dạng trả ra cho giao diện.
 *
 * <p>Trả về {@code weatherCode} theo chuẩn WMO chứ không trả chuỗi mô tả. Open-Meteo mô tả bằng
 * tiếng Anh, đưa thẳng xuống là bản tiếng Việt lại hiện "light rain shower". Giao diện tự ánh xạ
 * mã sang biểu tượng và chữ trong bảng dịch của nó.
 *
 * <p>Có cả tên tiếng Việt và tiếng Anh của nơi đến để giao diện khỏi phải tra lại bảng thành phố
 * chỉ để viết đúng một dòng tiêu đề.
 *
 * @param precipitationProbability xác suất mưa theo phần trăm; có thể null vì đây là phần thêm,
 *                                 không phải phần lõi của dự báo
 * @param source                   tên nguồn, phải hiện kèm theo giấy phép CC-BY-4.0 của Open-Meteo
 */
public record WeatherForecast(String placeCode,
                              String cityId,
                              String cityNameVi,
                              String cityNameEn,
                              LocalDate date,
                              int weatherCode,
                              double temperatureMinC,
                              double temperatureMaxC,
                              Integer precipitationProbability,
                              String source) {
}
