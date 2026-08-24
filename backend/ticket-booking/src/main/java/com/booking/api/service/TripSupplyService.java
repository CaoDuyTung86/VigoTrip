package com.booking.api.service;

import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Nguồn cung chuyến đi — nơi DUY NHẤT được phép sinh dữ liệu chuyến.
 *
 * Trước đây có hai chỗ cùng ghi vào bảng chuyen_di: DataSeeder (chỉ biết 4 tuyến
 * HAN/SGN/DAD) và TripDataSeeder (biết đủ tuyến). Cả hai đều là seeder chạy-một-lần,
 * lại chốt điều kiện bỏ qua theo một tuyến đại diện ("HAN-&gt;SAP đã có chuyến chưa"),
 * nên chỉ cần một lần seed cũ chạm được tuyến đó là toàn bộ phần còn lại không bao
 * giờ được sinh nữa — đó là lý do production chỉ còn đúng tập tuyến của DataSeeder.
 *
 * Ở đây đổi hẳn cách nghĩ: không còn "seed một lần" mà là "bù cho đủ tồn kho".
 * Điều kiện idempotent xét theo từng (tuyến, phương tiện, ngày) chứ không theo một
 * tuyến đại diện, nên thiếu chỗ nào bù đúng chỗ đó. Gọi lại bao nhiêu lần cũng an
 * toàn: ngày nào đã có chuyến thì bỏ qua, chỉ ngày trống mới sinh.
 *
 * Hàm này CHỈ THÊM, không bao giờ xoá chuyến cũ: mọi thống kê doanh thu trong
 * BookingRepository đều đi đường Booking -&gt; ve -&gt; chuyen_di -&gt; tuyen_duong/phuong_tien,
 * xoá chuyến quá khứ là xoá luôn lịch sử vé (Trip.tickets đang cascade ALL +
 * orphanRemoval) và làm rỗng dữ liệu cho phần AI phân tích.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TripSupplyService {

    /** Số ngày luôn phải có sẵn chuyến, tính từ hôm nay. */
    public static final int DEFAULT_HORIZON_DAYS = 30;

    /** Ngưỡng flush khi lưu, để lần chạy đầu trên DB rỗng không ôm cả chục nghìn entity. */
    private static final int SAVE_BATCH_SIZE = 500;

    private final RouteRepository routeRepository;
    private final VehicleRepository vehicleRepository;
    private final TripRepository tripRepository;

    private final SecureRandom rng = new SecureRandom();

    /**
     * Cấu hình sinh chuyến cho một loại phương tiện.
     *
     * @param vehicleType        khớp phuong_tien.vehicle_type — cũng là tham số type của /api/trips/search
     * @param routePairs         danh mục tuyến CÓ THẬT của loại phương tiện này
     * @param departures         các khung giờ khởi hành trong ngày, dạng {giờ, phút}
     * @param priceTiers         dải giá bốc ngẫu nhiên
     * @param minTravelHours     thời gian di chuyển tối thiểu
     * @param travelHoursSpread  biên độ cộng thêm (giờ)
     * @param extraMinutesBound  biên độ cộng thêm (phút)
     */
    private record ModePlan(String vehicleType,
                            String[][] routePairs,
                            int[][] departures,
                            double[] priceTiers,
                            int minTravelHours,
                            int travelHoursSpread,
                            int extraMinutesBound) {
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Danh mục tuyến. Đây là "sự thật" về mạng lưới: không có dòng nào ở đây
    // nghĩa là ngoài đời không có tuyến thẳng, chứ không phải quên sinh dữ liệu.
    //
    // Lưu ý về mã điểm: cùng một thành phố đang mang hai mã tuỳ phương tiện
    // (HUI/HUE = Huế, CXR/NTR = Nha Trang, DLI/DLT = Đà Lạt, VII/VIN = Vinh) vì
    // hàng không dùng mã IATA còn tàu/xe dùng mã ga - bến. Phải khai cả hai cho
    // tới khi tách được bảng địa điểm / điểm đón trả riêng.
    // ─────────────────────────────────────────────────────────────────────────

    private static final String[][] PLANE_ROUTES = {
            { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "DAD" }, { "DAD", "HAN" },
            { "SGN", "DAD" }, { "DAD", "SGN" }, { "SGN", "CXR" }, { "CXR", "SGN" },
            { "HAN", "HUI" }, { "HUI", "HAN" }, { "SGN", "HUI" }, { "HUI", "SGN" },
            { "HAN", "CXR" }, { "CXR", "HAN" }, { "HAN", "DLI" }, { "DLI", "HAN" },
            { "SGN", "DLI" }, { "DLI", "SGN" }, { "HAN", "PQC" }, { "PQC", "HAN" },
            { "SGN", "PQC" }, { "PQC", "SGN" }, { "HAN", "VCL" }, { "VCL", "HAN" },
            { "SGN", "VCL" }, { "VCL", "SGN" }, { "SGN", "HPH" }, { "HPH", "SGN" },
            { "SGN", "VII" }, { "VII", "SGN" },
            // HAN-HPH (~100km) và HAN-VII (~300km) ngoài đời KHÔNG có chặng bay thương mại,
            // quãng này đi tàu/xe. Tạm giữ để dropdown vé máy bay không trả về trang trắng;
            // bỏ đi khi màn tìm kiếm biết phân biệt "không có tuyến" với "hết chuyến hôm đó".
            { "HAN", "HPH" }, { "HPH", "HAN" }, { "HAN", "VII" }, { "VII", "HAN" },
    };

    private static final String[][] BUS_ROUTES = {
            { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "HPH" }, { "HPH", "HAN" },
            { "HAN", "SAP" }, { "SAP", "HAN" }, { "HAN", "QNH" }, { "QNH", "HAN" },
            { "SGN", "NTR" }, { "NTR", "SGN" }, { "SGN", "CXR" }, { "CXR", "SGN" },
            { "SGN", "DLT" }, { "DLT", "SGN" }, { "SGN", "DLI" }, { "DLI", "SGN" },
            { "SGN", "DAD" }, { "DAD", "SGN" }, { "HAN", "VIN" }, { "VIN", "HAN" },
            { "HAN", "VII" }, { "VII", "HAN" },
            { "DAD", "HUE" }, { "HUE", "DAD" }, { "DAD", "HUI" }, { "HUI", "DAD" },
            { "HAN", "HUE" }, { "HUE", "HAN" }, { "HAN", "HUI" }, { "HUI", "HAN" },
    };

    private static final String[][] TRAIN_ROUTES = {
            { "HAN", "SGN" }, { "SGN", "HAN" }, { "HAN", "DAD" }, { "DAD", "HAN" },
            { "HAN", "HUE" }, { "HUE", "HAN" }, { "HAN", "HUI" }, { "HUI", "HAN" },
            { "HAN", "VIN" }, { "VIN", "HAN" }, { "HAN", "VII" }, { "VII", "HAN" },
            { "SGN", "NTR" }, { "NTR", "SGN" }, { "SGN", "CXR" }, { "CXR", "SGN" },
            { "DAD", "NTR" }, { "NTR", "DAD" }, { "DAD", "CXR" }, { "CXR", "DAD" },
            { "HAN", "HPH" }, { "HPH", "HAN" }, { "HAN", "QNH" }, { "QNH", "HAN" },
            { "DAD", "HUE" }, { "HUE", "DAD" }, { "DAD", "HUI" }, { "HUI", "DAD" },
            { "SGN", "DLT" }, { "DLT", "SGN" }, { "SGN", "DLI" }, { "DLI", "SGN" },
            { "HAN", "SAP" }, { "SAP", "HAN" },
    };

    private static final List<ModePlan> MODE_PLANS = List.of(
            new ModePlan("PLANE", PLANE_ROUTES,
                    new int[][] { { 6, 0 }, { 9, 30 }, { 13, 0 }, { 17, 30 }, { 20, 30 } },
                    new double[] { 1_200_000, 1_400_000, 1_600_000, 1_800_000, 2_100_000, 2_500_000 },
                    1, 2, 30),
            new ModePlan("BUS", BUS_ROUTES,
                    new int[][] { { 6, 0 }, { 10, 0 }, { 14, 0 }, { 19, 0 } },
                    new double[] { 180_000, 220_000, 280_000, 350_000, 420_000, 500_000 },
                    3, 6, 45),
            new ModePlan("TRAIN", TRAIN_ROUTES,
                    new int[][] { { 7, 0 }, { 13, 0 }, { 19, 0 } },
                    new double[] { 300_000, 400_000, 550_000, 700_000, 900_000 },
                    4, 8, 50));

    public int ensureSupply() {
        return ensureSupply(DEFAULT_HORIZON_DAYS);
    }

    /**
     * Bù chuyến cho đủ {@code horizonDays} ngày tới. Chỉ thêm phần còn thiếu.
     *
     * @return số chuyến vừa sinh thêm (0 nghĩa là kho đã đầy, không phải lỗi)
     */
    public int ensureSupply(int horizonDays) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = today.atStartOfDay();
        LocalDateTime windowEnd = today.plusDays(horizonDays).atStartOfDay();

        Map<String, Route> routes = ensureRoutes();
        Map<String, List<Vehicle>> vehiclesByType = loadVehiclesByType();
        Set<String> covered = loadCoveredSlots(windowStart, windowEnd);

        List<Trip> pending = new ArrayList<>();
        int created = 0;

        for (ModePlan plan : MODE_PLANS) {
            List<Vehicle> fleet = vehiclesByType.get(plan.vehicleType());
            if (fleet == null || fleet.isEmpty()) {
                log.warn("[TripSupply] Chưa có phương tiện loại {}, bỏ qua toàn bộ tuyến của loại này.",
                        plan.vehicleType());
                continue;
            }

            for (String[] pair : plan.routePairs()) {
                Route route = routes.get(routeKey(pair[0], pair[1]));
                if (route == null) {
                    continue;
                }

                for (int day = 0; day < horizonDays; day++) {
                    LocalDate date = today.plusDays(day);
                    if (covered.contains(slotKey(route.getId(), plan.vehicleType(), date))) {
                        continue;
                    }

                    for (int[] slot : plan.departures()) {
                        LocalDateTime departure = date.atTime(slot[0], slot[1]);
                        // Hôm nay chỉ sinh những khung giờ chưa trôi qua — TripService.searchTrips
                        // lọc bỏ hết chuyến quá khứ nên sinh ra cũng không ai thấy.
                        if (departure.isBefore(now)) {
                            continue;
                        }
                        pending.add(buildTrip(route, fleet.get(rng.nextInt(fleet.size())), departure, plan));
                    }

                    if (pending.size() >= SAVE_BATCH_SIZE) {
                        created += flush(pending);
                    }
                }
            }
        }

        created += flush(pending);

        if (created > 0) {
            log.info("[TripSupply] Đã bù {} chuyến để phủ đủ {} ngày tới.", created, horizonDays);
        } else {
            log.debug("[TripSupply] Kho chuyến đã phủ đủ {} ngày tới, không cần bù.", horizonDays);
        }
        return created;
    }

    private int flush(List<Trip> pending) {
        if (pending.isEmpty()) {
            return 0;
        }
        int n = pending.size();
        tripRepository.saveAll(pending);
        pending.clear();
        return n;
    }

    private Trip buildTrip(Route route, Vehicle vehicle, LocalDateTime departure, ModePlan plan) {
        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicle(vehicle);
        trip.setDepartureTime(departure);
        trip.setArrivalTime(departure
                .plusHours(plan.minTravelHours() + rng.nextInt(plan.travelHoursSpread()))
                .plusMinutes(rng.nextInt(plan.extraMinutesBound())));
        trip.setPrice(BigDecimal.valueOf(plan.priceTiers()[rng.nextInt(plan.priceTiers().length)]));
        trip.setStatus("ACTIVE");
        return trip;
    }

    /** Tạo sẵn mọi tuyến trong danh mục (nếu thiếu) và trả về map tra cứu theo "ORIG-DEST". */
    private Map<String, Route> ensureRoutes() {
        Map<String, Route> byKey = routeRepository.findAll().stream()
                .collect(Collectors.toMap(
                        r -> routeKey(r.getOrigin(), r.getDestination()),
                        r -> r,
                        (a, b) -> a));

        List<Route> missing = new ArrayList<>();
        Set<String> seen = new HashSet<>(byKey.keySet());
        for (ModePlan plan : MODE_PLANS) {
            for (String[] pair : plan.routePairs()) {
                if (seen.add(routeKey(pair[0], pair[1]))) {
                    Route r = new Route();
                    r.setOrigin(pair[0]);
                    r.setDestination(pair[1]);
                    missing.add(r);
                }
            }
        }

        if (!missing.isEmpty()) {
            for (Route saved : routeRepository.saveAll(missing)) {
                byKey.put(routeKey(saved.getOrigin(), saved.getDestination()), saved);
            }
            log.info("[TripSupply] Tạo thêm {} tuyến còn thiếu trong danh mục.", missing.size());
        }
        return byKey;
    }

    private Map<String, List<Vehicle>> loadVehiclesByType() {
        return vehicleRepository.findAll().stream()
                .filter(v -> v.getVehicleType() != null)
                .collect(Collectors.groupingBy(v -> v.getVehicleType().toUpperCase()));
    }

    /**
     * Những (tuyến, phương tiện, ngày) đã có chuyến trong cửa sổ đang xét.
     *
     * Phải có cả loại phương tiện trong khoá: một hàng tuyen_duong như HAN-SGN được
     * dùng chung cho cả máy bay, xe khách lẫn tàu, nếu chỉ xét (tuyến, ngày) thì hôm
     * nào có chuyến bay là xe và tàu cũng bị coi như đã đủ.
     */
    private Set<String> loadCoveredSlots(LocalDateTime from, LocalDateTime to) {
        Set<String> covered = new HashSet<>();
        for (Object[] row : tripRepository.findSupplySlots(from, to)) {
            Long routeId = (Long) row[0];
            String vehicleType = (String) row[1];
            LocalDateTime departure = (LocalDateTime) row[2];
            if (routeId == null || vehicleType == null || departure == null) {
                continue;
            }
            covered.add(slotKey(routeId, vehicleType.toUpperCase(), departure.toLocalDate()));
        }
        return covered;
    }

    private static String routeKey(String origin, String destination) {
        return origin.toUpperCase() + "-" + destination.toUpperCase();
    }

    private static String slotKey(Long routeId, String vehicleType, LocalDate date) {
        return routeId + "|" + vehicleType + "|" + date;
    }
}
