package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
public class AdditionalServiceSeeder {

    @Bean
    public CommandLineRunner initAdditionalServices(AdditionalServiceRepository additionalServiceRepository) {
        return args -> {
            
            List<AdditionalService> oldMeals = additionalServiceRepository.findAll()
                .stream()
                .filter(s -> s.getServiceName().contains("Suất ăn") || s.getServiceName().contains("Combo"))
                .toList();
            
            try {
                additionalServiceRepository.deleteAll(oldMeals);
            } catch (Exception e) {
                log.warn("Could not delete old meals due to constraints, skipping deletion...");
            }

            List<AdditionalService> newMeals = List.of(
                    new AdditionalService(null, "Combo Mỳ Ý và Nước suối và Hạt điều", BigDecimal.valueOf(99000)),
                    new AdditionalService(null, "Combo Cơm chiên Thái và Nước suối và Hạt điều", BigDecimal.valueOf(99000)),
                    new AdditionalService(null, "Combo Miến xào Tôm cua và Nước suối và Hạt điều", BigDecimal.valueOf(99000)),
                    new AdditionalService(null, "Combo Bún xào Singapore và Nước suối và Hạt điều", BigDecimal.valueOf(99000))
            );
            
            long combosCount = additionalServiceRepository.findAll().stream().filter(s -> s.getServiceName().contains("Combo Mỳ Ý")).count();
            if (combosCount == 0) {
                additionalServiceRepository.saveAll(newMeals);
            }

            if (additionalServiceRepository.count() <= 4) {
                List<AdditionalService> services = List.of(
                        new AdditionalService(null, "Hành lý ký gửi 15kg", BigDecimal.valueOf(180000)),
                        new AdditionalService(null, "Hành lý ký gửi 20kg", BigDecimal.valueOf(250000)),
                        new AdditionalService(null, "Hành lý ký gửi 30kg", BigDecimal.valueOf(350000)),
                        new AdditionalService(null, "Bảo hiểm du lịch cơ bản", BigDecimal.valueOf(49000)),
                        new AdditionalService(null, "Bảo hiểm du lịch cao cấp", BigDecimal.valueOf(99000)),
                        new AdditionalService(null, "Taxi đưa đón sân bay (Xanh SM)", BigDecimal.valueOf(199000))
                );
                additionalServiceRepository.saveAll(services);
            }
        };
    }
}
