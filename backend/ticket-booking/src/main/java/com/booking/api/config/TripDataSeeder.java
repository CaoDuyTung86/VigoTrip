package com.booking.api.config;

import com.booking.api.service.TripSupplyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

/**
 * Bù chuyến ngay khi ứng dụng khởi động.
 *
 * Toàn bộ phần sinh dữ liệu đã chuyển sang {@link TripSupplyService}; ở đây chỉ còn
 * đúng một lời gọi. Lý do vẫn giữ CommandLineRunner dù đã có TripSupplyScheduler:
 * trên Render gói free container bị ngủ và khởi động lại liên tục, cron 3h sáng có
 * thể rơi đúng lúc đang ngủ nên không chạy. Bù thêm ở lần khởi động là cái lưới an
 * toàn — và vì ensureSupply idempotent nên chạy trùng với cron cũng vô hại.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class TripDataSeeder {

    private final TripSupplyService tripSupplyService;

    @Bean
    @Order(1)
    CommandLineRunner seedTripData() {
        return args -> {
            int created = tripSupplyService.ensureSupply();
            log.info("[TripDataSeeder] Kiểm tra tồn kho chuyến lúc khởi động: bù thêm {} chuyến.", created);
        };
    }
}
