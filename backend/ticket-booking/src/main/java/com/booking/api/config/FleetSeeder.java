package com.booking.api.config;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nhà cung cấp + phương tiện + ghế. Phải chạy TRƯỚC mọi thứ sinh chuyến.
 *
 * Phần này vốn nằm lẫn trong TripDataSeeder cũ. Tách ra vì thứ tự khởi động là chuyện sống
 * còn chứ không phải sở thích: TripSupplyService chọn phương tiện theo loại, gặp bảng
 * phuong_tien rỗng thì bỏ qua sạch cả ba loại và cơ sở dữ liệu mới sẽ không có lấy một
 * chuyến nào. @Order(0) đảm bảo đội xe có trước, TripDataSeeder @Order(1) chạy sau.
 *
 * Idempotent theo bộ ba (nhà cung cấp, loại, số ghế). Bản cũ dò trùng chỉ theo (loại, số
 * ghế) và bỏ qua toàn bộ việc tạo mới khi đếm được từ 12 phương tiện trở lên, nên tuỳ dữ
 * liệu sẵn có mà bảng tra cứu bị thiếu khoá, dẫn tới chuyến bị gán phương tiện null.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class FleetSeeder {

    private final ProviderRepository providerRepository;
    private final VehicleRepository vehicleRepository;
    private final SeatRepository seatRepository;

    /** {tên, loại hình, liên hệ} */
    private static final String[][] PROVIDERS = {
            { "Vietnam Airlines", "AIRLINE", "19001100" },
            { "Vietjet Air", "AIRLINE", "19001886" },
            { "Bamboo Airways", "AIRLINE", "19001166" },
            { "Phương Trang (FUTA)", "BUS", "19006067" },
            { "Thành Bưởi", "BUS", "19006079" },
            { "Hoàng Long", "BUS", "19006051" },
            { "Đường Sắt VN (VNR)", "TRAIN", "19006469" },
            { "Violette Express", "TRAIN", "02438330155" },
    };

    /** {tên nhà cung cấp, loại phương tiện, tổng số ghế} */
    private static final Object[][] VEHICLES = {
            { "Vietnam Airlines", "PLANE", 180 },
            { "Vietnam Airlines", "PLANE", 220 },
            { "Vietjet Air", "PLANE", 180 },
            { "Vietjet Air", "PLANE", 150 },
            { "Bamboo Airways", "PLANE", 160 },
            { "Phương Trang (FUTA)", "BUS", 40 },
            { "Phương Trang (FUTA)", "BUS", 34 },
            { "Thành Bưởi", "BUS", 34 },
            { "Hoàng Long", "BUS", 45 },
            { "Đường Sắt VN (VNR)", "TRAIN", 60 },
            { "Đường Sắt VN (VNR)", "TRAIN", 40 },
            { "Violette Express", "TRAIN", 50 },
    };

    @Bean
    @Order(0)
    CommandLineRunner seedFleet() {
        return args -> {
            Map<String, Provider> providers = ensureProviders();
            int createdVehicles = ensureVehicles(providers);
            if (createdVehicles > 0) {
                log.info("[FleetSeeder] Đã tạo thêm {} phương tiện kèm sơ đồ ghế.", createdVehicles);
            }
        };
    }

    private Map<String, Provider> ensureProviders() {
        Map<String, Provider> byName = providerRepository.findAll().stream()
                .collect(Collectors.toMap(Provider::getProviderName, Function.identity(), (a, b) -> a));

        List<Provider> missing = new ArrayList<>();
        for (String[] p : PROVIDERS) {
            if (!byName.containsKey(p[0])) {
                Provider provider = new Provider();
                provider.setProviderName(p[0]);
                provider.setProviderType(p[1]);
                provider.setContactInfo(p[2]);
                missing.add(provider);
            }
        }
        if (!missing.isEmpty()) {
            providerRepository.saveAll(missing).forEach(p -> byName.put(p.getProviderName(), p));
            log.info("[FleetSeeder] Đã tạo thêm {} nhà cung cấp.", missing.size());
        }
        return byName;
    }

    private int ensureVehicles(Map<String, Provider> providers) {
        List<Vehicle> existing = vehicleRepository.findAll();
        int created = 0;

        for (Object[] v : VEHICLES) {
            String providerName = (String) v[0];
            String type = (String) v[1];
            int totalSeats = (int) v[2];

            Provider provider = providers.get(providerName);
            if (provider == null) {
                continue;
            }

            boolean alreadyThere = existing.stream().anyMatch(ev -> ev.getProvider() != null
                    && provider.getId().equals(ev.getProvider().getId())
                    && type.equals(ev.getVehicleType())
                    && Integer.valueOf(totalSeats).equals(ev.getTotalSeats()));
            if (alreadyThere) {
                continue;
            }

            Vehicle vehicle = new Vehicle();
            vehicle.setProvider(provider);
            vehicle.setVehicleType(type);
            vehicle.setTotalSeats(totalSeats);
            vehicle = vehicleRepository.save(vehicle);
            existing.add(vehicle);
            seatRepository.saveAll(buildSeats(vehicle, type, totalSeats));
            created++;
        }
        return created;
    }

    /**
     * Sơ đồ ghế: máy bay 6 ghế/hàng (A-F), xe khách và tàu 4 ghế/hàng.
     * Vài hàng đầu là hạng cao hơn, đúng cách các hãng thật xếp khoang.
     */
    private static List<Seat> buildSeats(Vehicle vehicle, String type, int totalSeats) {
        String[] columns = "PLANE".equals(type)
                ? new String[] { "A", "B", "C", "D", "E", "F" }
                : new String[] { "A", "B", "C", "D" };
        int premiumRows = "BUS".equals(type) ? 2 : 3;
        String premiumType = "PLANE".equals(type) ? "BUSINESS" : "VIP";

        int rows = totalSeats / columns.length;
        List<Seat> seats = new ArrayList<>(rows * columns.length);
        for (int row = 1; row <= rows; row++) {
            for (String column : columns) {
                Seat seat = new Seat();
                seat.setVehicle(vehicle);
                seat.setSeatNumber(row + column);
                seat.setSeatType(row <= premiumRows ? premiumType : "ECONOMY");
                seats.add(seat);
            }
        }
        return seats;
    }
}
