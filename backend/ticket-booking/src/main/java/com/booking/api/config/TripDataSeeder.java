package com.booking.api.config;

import com.booking.api.entity.*;
import com.booking.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class TripDataSeeder {

    private final RouteRepository routeRepository;
    private final ProviderRepository providerRepository;
    private final VehicleRepository vehicleRepository;
    private final SeatRepository seatRepository;
    private final TripRepository tripRepository;

    @Bean
    @Order(1)
    CommandLineRunner seedTripData() {
        return args -> {
            LocalDateTime now = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);

            // Kiểm tra: nếu đã có chuyến đi TRONG TƯƠNG LAI thì bỏ qua
            long futureTrips = tripRepository.findAll().stream()
                    .filter(t -> t.getDepartureTime() != null && t.getDepartureTime().isAfter(now))
                    .count();

            if (futureTrips > 1000) {
                log.info("[TripDataSeeder] Đã có {} chuyến đi trong tương lai, bỏ qua.", futureTrips);
                return;
            }

            log.info(
                    "[TripDataSeeder] Phát hiện chỉ có {} chuyến đi trong tương lai. Bắt đầu sinh dữ liệu mới cho 30 ngày tới...",
                    futureTrips);

            // ── 1. Routes ──
            String[][] routePairs = {
                    { "HAN", "SGN" }, { "SGN", "HAN" },
                    { "HAN", "DAD" }, { "DAD", "HAN" },
                    { "HAN", "HPH" }, { "HPH", "HAN" },
                    { "HAN", "HUE" }, { "HUE", "HAN" },
                    { "HAN", "VIN" }, { "VIN", "HAN" },
                    { "HAN", "SAP" }, { "SAP", "HAN" },
                    { "HAN", "QNH" }, { "QNH", "HAN" },
                    { "SGN", "DAD" }, { "DAD", "SGN" },
                    { "SGN", "NTR" }, { "NTR", "SGN" },
                    { "SGN", "DLT" }, { "DLT", "SGN" },
                    { "SGN", "HUE" }, { "HUE", "SGN" },
                    { "DAD", "NTR" }, { "NTR", "DAD" },
                    { "DAD", "HUE" }, { "HUE", "DAD" },
                    { "HAN", "NTR" }, { "NTR", "HAN" },
                    { "HAN", "DLT" }, { "DLT", "HAN" },
            };

            Map<String, Route> routeMap = new HashMap<>();
            for (String[] pair : routePairs) {
                String key = pair[0] + "-" + pair[1];
                Route existing = routeRepository.findAll().stream()
                        .filter(r -> r.getOrigin().equals(pair[0]) && r.getDestination().equals(pair[1]))
                        .findFirst().orElse(null);
                if (existing != null) {
                    routeMap.put(key, existing);
                } else {
                    Route r = new Route();
                    r.setOrigin(pair[0]);
                    r.setDestination(pair[1]);
                    routeMap.put(key, routeRepository.save(r));
                }
            }

            // ── 2. Providers ──
            Map<String, Provider> provMap = new HashMap<>();
            String[][] providers = {
                    { "Vietnam Airlines", "AIRLINE", "19001100" },
                    { "Vietjet Air", "AIRLINE", "19001886" },
                    { "Bamboo Airways", "AIRLINE", "19001166" },
                    { "Phương Trang (FUTA)", "BUS", "19006067" },
                    { "Thành Bưởi", "BUS", "19006079" },
                    { "Hoàng Long", "BUS", "19006051" },
                    { "Đường Sắt VN (VNR)", "TRAIN", "19006469" },
                    { "Violette Express", "TRAIN", "02438330155" },
            };
            for (String[] p : providers) {
                Provider existing = providerRepository.findAll().stream()
                        .filter(x -> x.getProviderName().equals(p[0]))
                        .findFirst().orElse(null);
                if (existing != null) {
                    provMap.put(p[0], existing);
                } else {
                    Provider prov = new Provider();
                    prov.setProviderName(p[0]);
                    prov.setProviderType(p[1]);
                    prov.setContactInfo(p[2]);
                    provMap.put(p[0], providerRepository.save(prov));
                }
            }

            // ── 3. Vehicles + Seats (Kiểm tra trước khi tạo mới) ──
            Map<String, Vehicle> vehMap = new HashMap<>();
            Object[][] vehicles = {
                    { "Vietnam Airlines", "PLANE", 180, "VNA-180" },
                    { "Vietnam Airlines", "PLANE", 220, "VNA-220" },
                    { "Vietjet Air", "PLANE", 180, "VJ-180" },
                    { "Vietjet Air", "PLANE", 150, "VJ-150" },
                    { "Bamboo Airways", "PLANE", 160, "BB-160" },
                    { "Phương Trang (FUTA)", "BUS", 40, "FUTA-40" },
                    { "Phương Trang (FUTA)", "BUS", 34, "FUTA-34" },
                    { "Thành Bưởi", "BUS", 34, "TB-34" },
                    { "Hoàng Long", "BUS", 45, "HL-45" },
                    { "Đường Sắt VN (VNR)", "TRAIN", 60, "VNR-60" },
                    { "Đường Sắt VN (VNR)", "TRAIN", 40, "VNR-40" },
                    { "Violette Express", "TRAIN", 50, "VIO-50" },
            };

            // Nếu đã có đủ 12 vehicle thì chỉ lấy lại, KHÔNG tạo mới
            List<Vehicle> existingVehicles = vehicleRepository.findAll();
            boolean skipVehicleCreation = existingVehicles.size() >= 12;

            for (Object[] v : vehicles) {
                String provName = (String) v[0];
                String type = (String) v[1];
                int totalSeats = (int) v[2];
                String key = (String) v[3];

                Provider provider = provMap.get(provName);
                final Long providerId = provider.getId();

                // Tìm vehicle đã tồn tại (dùng ID trực tiếp để tránh lỗi lazy proxy)
                Vehicle existingVeh = existingVehicles.stream()
                        .filter(ev -> ev.getVehicleType().equals(type)
                                && ev.getTotalSeats().equals(totalSeats))
                        .findFirst().orElse(null);

                if (existingVeh != null) {
                    vehMap.put(key, existingVeh);
                } else if (!skipVehicleCreation) {
                    Vehicle veh = new Vehicle();
                    veh.setProvider(provider);
                    veh.setVehicleType(type);
                    veh.setTotalSeats(totalSeats);
                    veh = vehicleRepository.save(veh);
                    vehMap.put(key, veh);

                    // Tạo ghế cho vehicle mới
                    List<Seat> seats = new ArrayList<>();
                    if ("PLANE".equals(type)) {
                        String[] cols = { "A", "B", "C", "D", "E", "F" };
                        int rows = totalSeats / 6;
                        for (int row = 1; row <= rows; row++) {
                            for (String col : cols) {
                                Seat s = new Seat();
                                s.setVehicle(veh);
                                s.setSeatNumber(row + col);
                                s.setSeatType(row <= 3 ? "BUSINESS" : "ECONOMY");
                                seats.add(s);
                            }
                        }
                    } else if ("BUS".equals(type)) {
                        String[] cols = { "A", "B", "C", "D" };
                        int rows = totalSeats / 4;
                        for (int row = 1; row <= rows; row++) {
                            for (String col : cols) {
                                Seat s = new Seat();
                                s.setVehicle(veh);
                                s.setSeatNumber(row + col);
                                s.setSeatType(row <= 2 ? "VIP" : "ECONOMY");
                                seats.add(s);
                            }
                        }
                    } else { // TRAIN
                        String[] cols = { "A", "B", "C", "D" };
                        int rows = totalSeats / 4;
                        for (int row = 1; row <= rows; row++) {
                            for (String col : cols) {
                                Seat s = new Seat();
                                s.setVehicle(veh);
                                s.setSeatNumber(row + col);
                                s.setSeatType(row <= 3 ? "VIP" : "ECONOMY");
                                seats.add(s);
                            }
                        }
                    }
                    seatRepository.saveAll(seats);
                    log.info("[TripDataSeeder] Tạo mới Vehicle {} với {} ghế.", key, seats.size());
                }
            }

            // ── 4. Trips (30 ngày kể từ HÔM NAY) ──
            java.security.SecureRandom rng = new java.security.SecureRandom();

            // Plane routes + config
            String[][] planeRoutes = {
                    { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "DAD" }, { "DAD", "HAN" },
                    { "SGN", "DAD" }, { "DAD", "SGN" }, { "SGN", "NTR" }, { "NTR", "SGN" },
                    { "HAN", "HUE" }, { "HUE", "HAN" }, { "SGN", "HUE" }, { "HUE", "SGN" },
                    { "HAN", "NTR" }, { "NTR", "HAN" }, { "HAN", "DLT" }, { "DLT", "HAN" },
                    { "SGN", "DLT" }, { "DLT", "SGN" },
            };
            String[] planeVehicles = { "VNA-180", "VNA-220", "VJ-180", "VJ-150", "BB-160" };
            int[][] planeHours = { { 6, 0 }, { 8, 30 }, { 11, 0 }, { 14, 0 }, { 17, 30 }, { 20, 0 } };
            double[] planePrices = { 1200000, 1400000, 1600000, 1800000, 2100000, 2500000, 2800000 };

            // Bus routes
            String[][] busRoutes = {
                    { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "HPH" }, { "HPH", "HAN" },
                    { "HAN", "SAP" }, { "SAP", "HAN" }, { "HAN", "QNH" }, { "QNH", "HAN" },
                    { "SGN", "NTR" }, { "NTR", "SGN" }, { "SGN", "DLT" }, { "DLT", "SGN" },
                    { "SGN", "DAD" }, { "DAD", "SGN" }, { "HAN", "VIN" }, { "VIN", "HAN" },
                    { "DAD", "HUE" }, { "HUE", "DAD" }, { "HAN", "HUE" }, { "HUE", "HAN" },
            };
            String[] busVehicles = { "FUTA-40", "FUTA-34", "TB-34", "HL-45" };
            int[][] busHours = { { 5, 0 }, { 7, 30 }, { 10, 0 }, { 13, 30 }, { 18, 0 }, { 21, 0 } };
            double[] busPrices = { 180000, 220000, 280000, 350000, 420000, 500000 };

            // Train routes
            String[][] trainRoutes = {
                    { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "DAD" }, { "DAD", "HAN" },
                    { "HAN", "HUE" }, { "HUE", "HAN" }, { "HAN", "VIN" }, { "VIN", "HAN" },
                    { "SGN", "NTR" }, { "NTR", "SGN" }, { "DAD", "NTR" }, { "NTR", "DAD" },
                    { "HAN", "HPH" }, { "HPH", "HAN" }, { "HAN", "QNH" }, { "QNH", "HAN" },
                    { "DAD", "HUE" }, { "HUE", "DAD" },
            };
            String[] trainVehicles = { "VNR-60", "VNR-40", "VIO-50" };
            int[][] trainHours = { { 6, 0 }, { 9, 0 }, { 14, 0 }, { 19, 0 }, { 22, 0 } };
            double[] trainPrices = { 300000, 400000, 550000, 700000, 900000 };

            List<Trip> allTrips = new ArrayList<>();

            // Sinh dữ liệu cho 30 ngày tới (tính từ hôm nay)
            for (int day = 0; day < 30; day++) {
                LocalDateTime base = now.plusDays(day);

                // Plane trips
                for (String[] rt : planeRoutes) {
                    String routeKey = rt[0] + "-" + rt[1];
                    Route route = routeMap.get(routeKey);
                    if (route == null)
                        continue;

                    for (int hi = 0; hi < planeHours.length; hi++) {
                        Trip t = new Trip();
                        t.setRoute(route);
                        t.setVehicle(vehMap.get(planeVehicles[rng.nextInt(planeVehicles.length)]));
                        t.setDepartureTime(base.withHour(planeHours[hi][0]).withMinute(planeHours[hi][1]));
                        t.setArrivalTime(
                                t.getDepartureTime().plusHours(1 + rng.nextInt(2)).plusMinutes(rng.nextInt(30)));
                        t.setPrice(planePrices[rng.nextInt(planePrices.length)]);
                        t.setStatus("ACTIVE");
                        allTrips.add(t);
                    }
                }

                // Bus trips
                for (String[] rt : busRoutes) {
                    String routeKey = rt[0] + "-" + rt[1];
                    Route route = routeMap.get(routeKey);
                    if (route == null)
                        continue;

                    for (int hi = 0; hi < busHours.length; hi++) {
                        Trip t = new Trip();
                        t.setRoute(route);
                        t.setVehicle(vehMap.get(busVehicles[rng.nextInt(busVehicles.length)]));
                        t.setDepartureTime(base.withHour(busHours[hi][0]).withMinute(busHours[hi][1]));
                        t.setArrivalTime(
                                t.getDepartureTime().plusHours(3 + rng.nextInt(6)).plusMinutes(rng.nextInt(45)));
                        t.setPrice(busPrices[rng.nextInt(busPrices.length)]);
                        t.setStatus("ACTIVE");
                        allTrips.add(t);
                    }
                }

                // Train trips
                for (String[] rt : trainRoutes) {
                    String routeKey = rt[0] + "-" + rt[1];
                    Route route = routeMap.get(routeKey);
                    if (route == null)
                        continue;

                    for (int hi = 0; hi < trainHours.length; hi++) {
                        Trip t = new Trip();
                        t.setRoute(route);
                        t.setVehicle(vehMap.get(trainVehicles[rng.nextInt(trainVehicles.length)]));
                        t.setDepartureTime(base.withHour(trainHours[hi][0]).withMinute(trainHours[hi][1]));
                        t.setArrivalTime(
                                t.getDepartureTime().plusHours(4 + rng.nextInt(8)).plusMinutes(rng.nextInt(50)));
                        t.setPrice(trainPrices[rng.nextInt(trainPrices.length)]);
                        t.setStatus("ACTIVE");
                        allTrips.add(t);
                    }
                }
            }

            tripRepository.saveAll(allTrips);
            log.info("[TripDataSeeder] ✅ Đã tạo {} chuyến đi mới cho 30 ngày tới (PLANE/BUS/TRAIN).", allTrips.size());
        };
    }
}
