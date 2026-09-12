package com.booking.api.config;

import com.booking.api.service.TripSupplyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

/**
 * Bù chuyến ngay khi ứng dụng khởi động.
 *
 * Toàn bộ phần sinh dữ liệu đã chuyển sang {@link TripSupplyService}; ở đây chỉ còn
 * đúng hai lời gọi. Lý do vẫn giữ CommandLineRunner dù đã có TripSupplyScheduler:
 * trên Render gói free container bị ngủ và khởi động lại liên tục, cron 3h sáng có
 * thể rơi đúng lúc đang ngủ nên không chạy. Bù thêm ở lần khởi động là cái lưới an
 * toàn — và vì ensureSupply idempotent nên chạy trùng với cron cũng vô hại.
 *
 * <p>Lời gọi thứ hai là bước tính lại. Bù chuyến chỉ THÊM phần còn thiếu, không bao giờ
 * sửa chuyến đã có, nên mỗi lần đổi cách tính giờ đến và giá thì dữ liệu seed từ bản cũ
 * vẫn nằm nguyên trong cơ sở dữ liệu tới hết tầm 30 ngày. Trên một môi trường đang chạy,
 * đó lại chính là phần lớn những gì khách nhìn thấy. Cả hai bước đều tất định nên chạy
 * lại không sinh trùng và cũng gần như không ghi gì.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class TripDataSeeder {

    private final TripSupplyService tripSupplyService;

    @Value("${app.trip-supply.realign-on-startup:true}")
    private boolean realignOnStartup;

    @Bean
    @Order(1)
    CommandLineRunner seedTripData() {
        return args -> {
            int created = tripSupplyService.ensureSupply();
            log.info("[TripDataSeeder] Kiểm tra tồn kho chuyến lúc khởi động: bù thêm {} chuyến.", created);

            if (!realignOnStartup) {
                log.info("[TripDataSeeder] Bỏ qua bước tính lại giá chuyến (app.trip-supply.realign-on-startup=false).");
                return;
            }
            int realigned = tripSupplyService.realignFutureTrips();
            log.info("[TripDataSeeder] Tính lại giờ đến và giá theo mô hình hiện hành: sửa {} chuyến.", realigned);
        };
    }
}
