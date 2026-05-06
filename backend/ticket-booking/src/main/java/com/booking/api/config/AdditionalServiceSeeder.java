package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class AdditionalServiceSeeder {

    private final AdditionalServiceRepository additionalServiceRepository;

    @Bean
    CommandLineRunner seedAdditionalServices() {
        return args -> {
            
            List<AdditionalService> oldMeals = additionalServiceRepository.findAll()
                .stream()
                .filter(s -> s.getServiceName().contains("Suất ăn") || s.getServiceName().contains("Combo"))
                .toList();
            
            try {
                additionalServiceRepository.deleteAll(oldMeals);
            } catch (Exception e) {
                System.out.println("Could not delete old meals due to constraints, skipping deletion...");
            }

            List<AdditionalService> newMeals = List.of(
                    new AdditionalService(null, "Combo Mỳ Ý và Nước suối và Hạt điều", 99000.0),
                    new AdditionalService(null, "Combo Cơm chiên Thái và Nước suối và Hạt điều", 99000.0),
                    new AdditionalService(null, "Combo Miến xào Tôm cua và Nước suối và Hạt điều", 99000.0),
                    new AdditionalService(null, "Combo Bún xào Singapore và Nước suối và Hạt điều", 99000.0)
            );
            
            long combosCount = additionalServiceRepository.findAll().stream().filter(s -> s.getServiceName().contains("Combo Mỳ Ý")).count();
            if (combosCount == 0) {
                additionalServiceRepository.saveAll(newMeals);
            }

            if (additionalServiceRepository.count() <= 4) {
                List<AdditionalService> services = List.of(
                        new AdditionalService(null, "Hành lý ký gửi 15kg", 180000.0),
                        new AdditionalService(null, "Hành lý ký gửi 20kg", 250000.0),
                        new AdditionalService(null, "Hành lý ký gửi 30kg", 350000.0),
                        new AdditionalService(null, "Bảo hiểm du lịch cơ bản", 49000.0),
                        new AdditionalService(null, "Bảo hiểm du lịch cao cấp", 99000.0),
                        new AdditionalService(null, "Taxi đưa đón sân bay (Xanh SM)", 199000.0)
                );
                additionalServiceRepository.saveAll(services);
            }
        };
    }
}
