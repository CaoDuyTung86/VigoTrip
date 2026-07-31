package com.booking.api.config;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import java.math.BigDecimal;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final TripRepository tripRepository;

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
            // Kiểm tra xem có chuyến đi nào từ hôm nay trở đi không
            LocalDate today = LocalDate.now();
            LocalDateTime todayStart = today.atStartOfDay();
            long futureTrips = tripRepository
                    .findUpcomingTrips(todayStart, org.springframework.data.domain.PageRequest.of(0, 1))
                    .getTotalElements();

            if (futureTrips == 0) {
                // Xóa các trip cũ đã hết hạn (nếu có) để tránh rác DB
                List<Trip> oldTrips = tripRepository.findAll().stream()
                        .filter(t -> t.getDepartureTime() != null && t.getDepartureTime().isBefore(todayStart))
                        .toList();
                if (!oldTrips.isEmpty()) {
                    tripRepository.deleteAll(oldTrips);
                }

                List<Trip> trips = new ArrayList<>();

                for (int i = 0; i < 30; i++) {
                    LocalDate date = today.plusDays(i);

                    // ===== PLANE =====
                    trips.add(buildTrip(
                            hanSgn,
                            airbusA321,
                            date.atTime(LocalTime.of(6, 0)),
                            date.atTime(LocalTime.of(8, 10)),
                            2_100_000.0 + i * 50_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            hanSgn,
                            airbusA321,
                            date.atTime(LocalTime.of(14, 30)),
                            date.atTime(LocalTime.of(16, 40)),
                            1_800_000.0 + i * 30_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            hanSgn,
                            airbusA320,
                            date.atTime(LocalTime.of(19, 0)),
                            date.atTime(LocalTime.of(21, 10)),
                            1_500_000.0 + i * 30_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            sgnHan,
                            airbusA321,
                            date.atTime(LocalTime.of(7, 0)),
                            date.atTime(LocalTime.of(9, 10)),
                            2_000_000.0 + i * 40_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            sgnHan,
                            airbusA320,
                            date.atTime(LocalTime.of(20, 0)),
                            date.atTime(LocalTime.of(22, 10)),
                            1_600_000.0 + i * 35_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            hanDad,
                            airbusA320,
                            date.atTime(LocalTime.of(11, 0)),
                            date.atTime(LocalTime.of(12, 15)),
                            900_000.0 + i * 20_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            dadHan,
                            airbusA320,
                            date.atTime(LocalTime.of(15, 0)),
                            date.atTime(LocalTime.of(16, 15)),
                            950_000.0 + i * 20_000,
                            "ACTIVE"));

                    // ===== BUS =====
                    trips.add(buildTrip(
                            hanDad,
                            bus40,
                            date.atTime(LocalTime.of(7, 30)),
                            date.atTime(LocalTime.of(22, 30)),
                            420_000.0 + i * 10_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            dadHan,
                            bus40,
                            date.atTime(LocalTime.of(8, 0)),
                            date.atTime(LocalTime.of(23, 0)),
                            430_000.0 + i * 10_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            hanSgn,
                            bus40,
                            date.atTime(LocalTime.of(18, 0)),
                            date.plusDays(1).atTime(LocalTime.of(12, 0)),
                            550_000.0 + i * 15_000,
                            "ACTIVE"));

                    // ===== TRAIN =====
                    trips.add(buildTrip(
                            hanDad,
                            train120,
                            date.atTime(LocalTime.of(6, 0)),
                            date.plusDays(1).atTime(LocalTime.of(6, 30)),
                            650_000.0 + i * 15_000,
                            "ACTIVE"));

                    trips.add(buildTrip(
                            hanSgn,
                            train120,
                            date.atTime(LocalTime.of(19, 30)),
                            date.plusDays(2).atTime(LocalTime.of(4, 0)),
                            850_000.0 + i * 20_000,
                            "ACTIVE"));
                }

                tripRepository.saveAll(trips);
            }
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

    private Trip buildTrip(Route route,
            Vehicle vehicle,
            LocalDateTime departure,
            LocalDateTime arrival,
            double price,
            String status) {
        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicle(vehicle);
        trip.setDepartureTime(departure);
        trip.setArrivalTime(arrival);
        trip.setPrice(BigDecimal.valueOf(price));
        trip.setStatus(status);
        return trip;
    }
}
