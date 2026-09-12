package com.booking.api.config;

import com.booking.api.entity.Voucher;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.time.LocalDateTime;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class VoucherDataSeeder {

    private final VoucherRepository voucherRepository;

    @Bean
    @Order(3)
    CommandLineRunner seedVoucherData() {
        return args -> {
            if (voucherRepository.count() > 0) {
                log.info("Voucher data already exists, skipping seed.");
                return;
            }

            log.info("Seeding voucher data...");

            Voucher welcome = new Voucher();
            welcome.setCode("WELCOME20");
            welcome.setDiscountPercent(20.0);
            welcome.setMaxDiscountAmount(100000.0);
            welcome.setMinOrderAmount(200000.0);
            welcome.setExpiryDate(LocalDateTime.now().plusMonths(3));
            welcome.setMaxUsage(100);
            welcome.setCurrentUsage(0);
            welcome.setDescription("Giảm 20% cho khách hàng mới (tối đa 100.000đ)");
            welcome.setIsActive(true);
            voucherRepository.save(welcome);

            Voucher summer = new Voucher();
            summer.setCode("SUMMER2026");
            summer.setDiscountPercent(15.0);
            summer.setMaxDiscountAmount(200000.0);
            summer.setMinOrderAmount(500000.0);
            summer.setExpiryDate(LocalDateTime.of(2026, 8, 31, 23, 59, 59));
            summer.setMaxUsage(50);
            summer.setCurrentUsage(0);
            summer.setDescription("Ưu đãi mùa hè — Giảm 15% (tối đa 200.000đ)");
            summer.setIsActive(true);
            voucherRepository.save(summer);

            Voucher aiPromo = new Voucher();
            aiPromo.setCode("AI_PROMO_10");
            aiPromo.setDiscountPercent(10.0);
            aiPromo.setMaxDiscountAmount(50000.0);
            aiPromo.setMinOrderAmount(100000.0);
            aiPromo.setExpiryDate(LocalDateTime.now().plusMonths(6));
            aiPromo.setMaxUsage(200);
            aiPromo.setCurrentUsage(0);
            aiPromo.setDescription("Mã riêng từ Chatbot AI — Giảm 10% (tối đa 50.000đ)");
            aiPromo.setIsActive(true);
            // Mã duy nhất KHÔNG lên dải tin chạy: chatbot phát nó cho từng người trong hội
            // thoại riêng, rao lên bảng điện tử thì cái tính riêng ấy thành vô nghĩa.
            aiPromo.setShowOnTicker(false);
            voucherRepository.save(aiPromo);

            Voucher vip = new Voucher();
            vip.setCode("VIP50");
            vip.setDiscountPercent(50.0);
            vip.setMaxDiscountAmount(500000.0);
            vip.setMinOrderAmount(1000000.0);
            vip.setExpiryDate(LocalDateTime.now().plusMonths(1));
            vip.setMaxUsage(10);
            vip.setCurrentUsage(0);
            vip.setDescription("Siêu giảm 50% cho đơn từ 1 triệu (tối đa 500.000đ, giới hạn 10 lượt)");
            vip.setIsActive(true);
            voucherRepository.save(vip);

            log.info("Seeded {} voucher codes.", voucherRepository.count());
        };
    }
}
