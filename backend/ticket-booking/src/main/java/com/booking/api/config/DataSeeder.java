package com.booking.api.config;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Configuration
@RequiredArgsConstructor
public class DataSeeder {

    private final ProviderRepository providerRepository;
    private final RouteRepository routeRepository;
    private final VehicleRepository vehicleRepository;
    private final SeatRepository seatRepository;

    @Bean
    CommandLineRunner seedCoreData() {
        return args -> {

            Provider vietjet = ensureProvider("Vietjet Air", "AIRLINE", "https://vietjetair.com");
            Provider bamboo = ensureProvider("Bamboo Airways", "AIRLINE", "https://www.bambooairways.com");
            Provider futa = ensureProvider("FUTA Bus Lines", "BUS", "https://futabus.vn");
            Provider vnr = ensureProvider("Vietnam Railways", "TRAIN", "https://dsvn.vn");

            Route hanSgn = ensureRoute("HAN", "SGN");
            Route sgnHan = ensureRoute("SGN", "HAN");
            Route hanDad = ensureRoute("HAN", "DAD");
            Route dadHan = ensureRoute("DAD", "HAN");

            Vehicle airbusA321 = ensureVehicle(vietjet, "PLANE", 180);
            Vehicle airbusA320 = ensureVehicle(bamboo, "PLANE", 150);
            Vehicle bus40 = ensureVehicle(futa, "BUS", 40);
            Vehicle train120 = ensureVehicle(vnr, "TRAIN", 120);

            ensureSeatsForVehicle(airbusA321);
            ensureSeatsForVehicle(airbusA320);
            ensureSeatsForVehicle(bus40);
            ensureSeatsForVehicle(train120);

            // Cố tình KHÔNG sinh chuyến ở đây nữa.
            //
            // Khối cũ chỉ biết 4 tuyến HAN<->SGN và HAN<->DAD, lại chạy sau TripDataSeeder
            // (bean này không khai @Order nên xếp cuối), nên trên production tập tuyến nhìn
            // thấy đúng bằng tập nghèo nàn của nó. Toàn bộ việc sinh chuyến đã dồn về
            // TripSupplyService — một nguồn duy nhất, biết đủ danh mục tuyến, bù theo
            // (tuyến, phương tiện, ngày).
            //
            // Khối cũ còn kèm một bước 'dọn rác' xoá mọi chuyến đã khởi hành khi lịch cạn.
            // Bước đó nguy hiểm chứ không vô hại: Trip.tickets khai cascade ALL +
            // orphanRemoval, xoá chuyến quá khứ là xoá theo cả vé đã bán, trong khi các
            // truy vấn doanh thu (BookingRepository) đều join Booking -> ve -> chuyen_di
            // -> tuyen_duong/phuong_tien. Mất chuyến cũ là mất luôn dữ liệu cho AI phân tích,
            // còn phía khách thì chuyến đã qua vốn đã tự ẩn nhờ bộ lọc thời gian trong
            // TripService, không cần xoá khỏi DB.
        };
    }

    private Provider ensureProvider(String name, String type, String contact) {
        return providerRepository.findAll().stream()
                .filter(p -> name.equalsIgnoreCase(p.getProviderName()))
                .findFirst()
                .orElseGet(() -> {
                    Provider p = new Provider();
                    p.setProviderName(name);
                    p.setProviderType(type);
                    p.setContactInfo(contact);
                    return providerRepository.save(p);
                });
    }

    private Route ensureRoute(String origin, String destination) {
        return routeRepository.findAll().stream()
                .filter(r -> origin.equalsIgnoreCase(r.getOrigin()) && destination.equalsIgnoreCase(r.getDestination()))
                .findFirst()
                .orElseGet(() -> {
                    Route r = new Route();
                    r.setOrigin(origin);
                    r.setDestination(destination);
                    return routeRepository.save(r);
                });
    }

    private Vehicle ensureVehicle(Provider provider, String vehicleType, Integer totalSeats) {
        return vehicleRepository.findAll().stream()
                .filter(v -> v.getProvider() != null
                        && v.getProvider().getId() != null
                        && v.getProvider().getId().equals(provider.getId())
                        && vehicleType.equalsIgnoreCase(v.getVehicleType()))
                .min(Comparator.comparing(v -> Optional.ofNullable(v.getId()).orElse(Long.MAX_VALUE)))
                .orElseGet(() -> {
                    Vehicle v = new Vehicle();
                    v.setProvider(provider);
                    v.setVehicleType(vehicleType);
                    v.setTotalSeats(totalSeats);
                    return vehicleRepository.save(v);
                });
    }

    private void ensureSeatsForVehicle(Vehicle vehicle) {
        if (vehicle == null || vehicle.getId() == null)
            return;
        if (!seatRepository.findByVehicleId(vehicle.getId()).isEmpty())
            return;

        List<Seat> seats = new ArrayList<>();
        String type = vehicle.getVehicleType() == null ? "" : vehicle.getVehicleType().toUpperCase();
        int total = vehicle.getTotalSeats() == null ? 0 : vehicle.getTotalSeats();

        if ("PLANE".equals(type)) {
            for (int row = 1; row <= 30; row++) {
                for (char col : new char[] { 'A', 'B', 'C', 'D', 'E', 'F' }) {
                    Seat seat = new Seat();
                    seat.setVehicle(vehicle);
                    seat.setSeatNumber(row + String.valueOf(col));
                    seat.setSeatType(col <= 'C' ? "ECO" : "BUSINESS");
                    seats.add(seat);
                }
            }
        } else {
            int n = Math.max(total, 0);
            for (int i = 1; i <= n; i++) {
                Seat seat = new Seat();
                seat.setVehicle(vehicle);
                seat.setSeatNumber(String.valueOf(i));
                seat.setSeatType("ECO");
                seats.add(seat);
            }
        }

        if (!seats.isEmpty()) {
            seatRepository.saveAll(seats);
        }
    }
}
