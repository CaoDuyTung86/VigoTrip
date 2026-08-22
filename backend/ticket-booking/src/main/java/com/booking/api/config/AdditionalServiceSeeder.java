package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
public class AdditionalServiceSeeder {

    /**
     * Tên suất ăn BẮT BUỘC mở đầu bằng "Suất ăn - ": giao diện đặt vé gom dịch vụ vào từng
     * nhóm (hành lý / suất ăn / bảo hiểm / taxi) dựa trên tiền tố này. Đặt sai tiền tố thì
     * suất ăn không rơi vào nhóm nào, giao diện tưởng cơ sở dữ liệu không có suất ăn và tự
     * dựng danh sách ảo -> id gửi lên không tồn tại -> backend bỏ qua, tiền hiển thị lệch
     * tiền thu thật.
     */
    private static final Map<String, BigDecimal> MEALS = new LinkedHashMap<>();
    static {
        MEALS.put("Suất ăn - Combo Bánh chưng chà bông, hạt điều & nước suối", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Cơm chiên Dương Châu chay, nước suối & hạt điều", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Cơm thịt bò, hạt điều & nước suối", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Hattrick Bia, khô gà & chả giò", BigDecimal.valueOf(110000));
        MEALS.put("Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Mỳ Ý, nước suối & hạt điều", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Penalty Soda dâu & hạt Macca", BigDecimal.valueOf(100000));
        MEALS.put("Suất ăn - Combo Xôi khúc giò, hạt điều & nước suối", BigDecimal.valueOf(99000));
        MEALS.put("Suất ăn - Combo Xôi mặn, hạt điều & nước suối", BigDecimal.valueOf(99000));
    }

    /**
     * Bốn dòng suất ăn của bản cũ thiếu tiền tố. Đổi tên tại chỗ thay vì xoá đi tạo lại để
     * giữ nguyên service_id — các đơn đã đặt vẫn đang tham chiếu tới chúng.
     */
    private static final Map<String, String> LEGACY_RENAMES = Map.of(
            "Combo Mỳ Ý và Nước suối và Hạt điều",
            "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều",
            "Combo Cơm chiên Thái và Nước suối và Hạt điều",
            "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều",
            "Combo Miến xào Tôm cua và Nước suối và Hạt điều",
            "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều",
            "Combo Bún xào Singapore và Nước suối và Hạt điều",
            "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều");

    private static final Map<String, BigDecimal> BASE_SERVICES = new LinkedHashMap<>();
    static {
        BASE_SERVICES.put("Hành lý ký gửi 15kg", BigDecimal.valueOf(180000));
        BASE_SERVICES.put("Hành lý ký gửi 20kg", BigDecimal.valueOf(250000));
        BASE_SERVICES.put("Hành lý ký gửi 30kg", BigDecimal.valueOf(350000));
        BASE_SERVICES.put("Bảo hiểm du lịch cơ bản", BigDecimal.valueOf(49000));
        BASE_SERVICES.put("Bảo hiểm du lịch cao cấp", BigDecimal.valueOf(99000));
        BASE_SERVICES.put("Taxi đưa đón sân bay (Xanh SM)", BigDecimal.valueOf(199000));
    }

    @Bean
    public CommandLineRunner initAdditionalServices(AdditionalServiceRepository additionalServiceRepository) {
        return args -> {
            List<AdditionalService> existing = additionalServiceRepository.findAll();

            // Bước 1: đổi tên các dòng cũ, bỏ qua nếu tên đích đã có để không tạo trùng
            for (AdditionalService svc : existing) {
                String newName = LEGACY_RENAMES.get(svc.getServiceName());
                if (newName == null) {
                    continue;
                }
                boolean targetExists = existing.stream()
                        .anyMatch(s -> !s.getId().equals(svc.getId()) && newName.equals(s.getServiceName()));
                if (targetExists) {
                    continue;
                }
                svc.setServiceName(newName);
                additionalServiceRepository.save(svc);
                log.info("Đã chuẩn hoá tên dịch vụ #{} thành \"{}\"", svc.getId(), newName);
            }

            // Bước 2: bổ sung những dịch vụ còn thiếu (chạy lại nhiều lần vẫn cho kết quả như nhau)
            seedMissing(additionalServiceRepository, MEALS);
            seedMissing(additionalServiceRepository, BASE_SERVICES);
        };
    }

    private void seedMissing(AdditionalServiceRepository repository, Map<String, BigDecimal> catalog) {
        List<String> existingNames = repository.findAll().stream()
                .map(AdditionalService::getServiceName)
                .toList();
        List<AdditionalService> missing = catalog.entrySet().stream()
                .filter(e -> !existingNames.contains(e.getKey()))
                .map(e -> new AdditionalService(null, e.getKey(), e.getValue()))
                .toList();
        if (!missing.isEmpty()) {
            repository.saveAll(missing);
            log.info("Đã thêm {} dịch vụ bổ sung còn thiếu", missing.size());
        }
    }
}
