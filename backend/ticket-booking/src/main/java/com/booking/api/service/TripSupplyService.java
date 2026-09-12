package com.booking.api.service;

import com.booking.api.catalog.DemandCalendar;
import com.booking.api.catalog.PlaceCatalog;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VehicleRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
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
 *
 * <p><b>Chuyến sinh ra theo mô hình, không theo xúc xắc.</b> Thời gian chạy và giá từng được
 * bốc ngẫu nhiên độc lập với mọi thứ khác, nên dữ liệu seed mang những chỗ phi lý ai nhìn cũng
 * thấy: xe khách Hà Nội đi Sài Gòn mất 3 tiếng, còn bay Hà Nội đi Nha Trang có khi rẻ hơn bay
 * Hà Nội đi Huế. Nay cả hai đều là hàm của cự ly thật giữa hai thành phố ({@link PlaceCatalog})
 * nhân với mùa vụ đi lại ({@link DemandCalendar}). Phần ngẫu nhiên chỉ còn là một nhiễu nhỏ,
 * và nhiễu đó cũng tất định theo từng chuyến nên chạy lại bao nhiêu lần cũng ra đúng một bảng giá.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TripSupplyService {

    /** Số ngày luôn phải có sẵn chuyến, tính từ hôm nay. */
    public static final int DEFAULT_HORIZON_DAYS = 30;

    /** Ngưỡng flush khi lưu, để lần chạy đầu trên DB rỗng không ôm cả chục nghìn entity. */
    private static final int SAVE_BATCH_SIZE = 500;

    /** Cự ly dùng tạm khi một mã điểm chưa có trong danh mục địa điểm. */
    private static final double FALLBACK_DISTANCE_KM = 400.0;

    /** Cứ chừng này phút chạy liên tục thì cộng một lần nghỉ dọc đường. */
    private static final int MINUTES_BETWEEN_REST_BREAKS = 300;

    /** Không chuyến nào ngắn hơn mức này, kể cả chặng rất gần. */
    private static final int MIN_TRAVEL_MINUTES = 30;

    /** Giá làm tròn tới bội số này, cho khỏi hiện ra con số lẻ tới từng đồng. */
    private static final int FARE_ROUNDING_VND = 1_000;

    /** Trạng thái của chuyến đang bán. Chỉ những chuyến này mới được sinh và được tính lại. */
    private static final String ACTIVE_STATUS = "ACTIVE";

    /** Hệ số nhu cầu cho chuyến nằm ngoài mọi khung giờ của mô hình: coi như giờ thường. */
    private static final int NEUTRAL_DEMAND_PERCENT = 100;

    private final RouteRepository routeRepository;
    private final VehicleRepository vehicleRepository;
    private final TripRepository tripRepository;
    private final EntityManager entityManager;

    /**
     * Cấu hình sinh chuyến cho một loại phương tiện.
     *
     * <p>Các tham số dưới đây hiệu chỉnh tay theo lịch chạy và bảng giá đã công bố của tàu
     * Thống Nhất, các chặng bay nội địa và xe giường nằm. Chép một lần vào đây rồi thôi: dự án
     * không gọi ra dịch vụ ngoài nào để lấy chúng, nên không có thêm một điểm hỏng lúc chạy.
     *
     * <p><b>Sai số còn lại, biết trước và chấp nhận.</b> Cả mạng lưới dùng chung một tốc độ hiệu
     * dụng, trong khi ngoài đời hệ số đi vòng tăng dần theo chiều dài chặng: đường sắt Hà Nội -
     * Sài Gòn dài gấp 1,52 lần đường chim bay còn Hà Nội - Vinh chỉ gấp 1,22 lần. Hệ quả là mấy
     * chặng tàu ngắn phía Bắc đang lâu hơn thực tế chừng 20%, đổi lại chặng Bắc - Nam khớp với
     * hơn 30 tiếng mà ai cũng biết. Đây là đánh đổi cố ý: chặng người ta thuộc lòng thì phải đúng.
     * Muốn đúng cả hai thì phải có cự ly đường sắt và đường bộ thật cho từng chặng, tức là một
     * bảng nữa, không phải chỉnh lại một con số.
     *
     * @param vehicleType           khớp phuong_tien.vehicle_type — cũng là tham số type của /api/trips/search
     * @param routePairs            danh mục tuyến CÓ THẬT của loại phương tiện này
     * @param frequencies           mật độ chuyến theo dải cự ly, xét từ dải ngắn nhất trở đi
     * @param effectiveKmh          tốc độ hiệu dụng tính trên cự ly ĐƯỜNG CHIM BAY, nên nó đã nuốt
     *                              sẵn cả phần đi vòng: tàu chạy 1726 km đường sắt cho 1138 km chim
     *                              bay Hà Nội - Sài Gòn, và con số ở đây phản ánh điều đó
     * @param fixedOverheadMinutes  phần không phụ thuộc quãng đường: lăn bánh và chờ cất hạ cánh với
     *                              máy bay, dồn khách và vào ga với xe và tàu
     * @param restBreakMinutes      nghỉ dọc đường, cộng thêm sau mỗi {@link #MINUTES_BETWEEN_REST_BREAKS}
     *                              phút chạy; để 0 nếu loại này không nghỉ
     * @param baseFareVnd           phần giá không phụ thuộc quãng đường
     * @param farePerKmVnd          đơn giá mỗi km đường chim bay
     */
    private record ModePlan(String vehicleType,
                            String[][] routePairs,
                            List<Frequency> frequencies,
                            double effectiveKmh,
                            int fixedOverheadMinutes,
                            int restBreakMinutes,
                            double baseFareVnd,
                            double farePerKmVnd) {

        /** Khung giờ chạy của một tuyến, chọn theo tuyến đó dài bao nhiêu. */
        int[][] departuresFor(double distanceKm) {
            for (Frequency frequency : frequencies) {
                if (distanceKm <= frequency.upToKm()) {
                    return frequency.departures();
                }
            }
            return frequencies.get(frequencies.size() - 1).departures();
        }
    }

    /**
     * Mật độ chuyến của một dải cự ly.
     *
     * <p>Trước đây mọi tuyến của cùng một loại phương tiện dùng chung đúng một bộ khung giờ, nên
     * Hà Nội - Hải Phòng và Hà Nội - Sài Gòn có y hệt số chuyến mỗi ngày. Ngoài đời thì ngược
     * lại: chặng ngắn chạy rải cả ngày vì đi về trong ngày được, chặng dài chỉ có vài chuyến và
     * dồn vào sáng sớm hoặc tối để khách đi trọn một đêm.
     *
     * @param upToKm     áp dụng cho tuyến dài tới chừng này; dải cuối để {@link Integer#MAX_VALUE}
     * @param departures khung giờ khởi hành, dạng {giờ, phút, hệ số nhu cầu theo %}
     */
    private record Frequency(int upToKm, int[][] departures) {
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

    // Hệ số nhu cầu theo khung giờ: chuyến đêm và chuyến sáng sớm rẻ hơn chuyến giờ đẹp với
    // máy bay, nhưng với tàu và xe thì ngược lại — chặng đêm là giường nằm, đi một đêm tiết kiệm
    // được một đêm khách sạn nên bán đắt hơn.
    private static final List<ModePlan> MODE_PLANS = List.of(
            new ModePlan("PLANE", PLANE_ROUTES,
                    List.of(
                            // Chặng ngắn kiểu Sài Gòn - Nha Trang: ít chuyến, vì quãng này đi xe cũng được.
                            new Frequency(400, new int[][] {
                                    { 7, 0, 100 }, { 12, 30, 100 }, { 18, 0, 108 } }),
                            new Frequency(800, new int[][] {
                                    { 6, 0, 95 }, { 10, 0, 104 }, { 15, 0, 100 }, { 19, 30, 102 } }),
                            // Trục Bắc - Nam: dày nhất, phủ từ chuyến sớm tới chuyến đêm.
                            new Frequency(Integer.MAX_VALUE, new int[][] {
                                    { 6, 0, 95 }, { 9, 30, 106 }, { 13, 0, 100 },
                                    { 17, 30, 110 }, { 20, 30, 93 } })),
                    780, 40, 0, 450_000, 950),
            new ModePlan("BUS", BUS_ROUTES,
                    List.of(
                            // Chặng đi về trong ngày như Hà Nội - Hải Phòng: chạy rải cả ngày.
                            new Frequency(200, new int[][] {
                                    { 6, 0, 100 }, { 9, 0, 96 }, { 12, 0, 94 },
                                    { 15, 0, 100 }, { 18, 30, 104 } }),
                            new Frequency(500, new int[][] {
                                    { 6, 30, 100 }, { 11, 0, 94 }, { 14, 30, 98 }, { 21, 0, 108 } }),
                            // Chặng cả ngày đường: chỉ sáng sớm hoặc tối, không ai mở chuyến giữa trưa.
                            new Frequency(Integer.MAX_VALUE, new int[][] {
                                    { 8, 0, 96 }, { 18, 0, 108 } })),
                    42, 15, 25, 45_000, 850),
            new ModePlan("TRAIN", TRAIN_ROUTES,
                    List.of(
                            new Frequency(200, new int[][] {
                                    { 6, 0, 98 }, { 12, 0, 94 }, { 17, 30, 104 } }),
                            new Frequency(700, new int[][] {
                                    { 7, 0, 98 }, { 13, 30, 96 }, { 19, 30, 108 } }),
                            // Thống Nhất: một chuyến ngày, một chuyến tối, đúng như lịch chạy thật.
                            new Frequency(Integer.MAX_VALUE, new int[][] {
                                    { 6, 0, 100 }, { 19, 0, 110 } })),
                    36, 10, 0, 120_000, 750));

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

        warnUnknownPlaceCodes();

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

                // Cự ly tính một lần cho cả tuyến: nó quyết định cả mật độ chuyến trong ngày lẫn
                // thời gian chạy và giá của từng chuyến, mà tuyến thì không đổi theo ngày.
                double distanceKm = distanceOf(route);
                int[][] departures = plan.departuresFor(distanceKm);

                for (int day = 0; day < horizonDays; day++) {
                    LocalDate date = today.plusDays(day);
                    if (covered.contains(slotKey(route.getId(), plan.vehicleType(), date))) {
                        continue;
                    }

                    for (int[] slot : departures) {
                        LocalDateTime departure = date.atTime(slot[0], slot[1]);
                        // Hôm nay chỉ sinh những khung giờ chưa trôi qua — TripService.searchTrips
                        // lọc bỏ hết chuyến quá khứ nên sinh ra cũng không ai thấy.
                        if (departure.isBefore(now)) {
                            continue;
                        }
                        pending.add(buildTrip(route, fleet, departure, plan, distanceKm, slot[2]));
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

    /**
     * Tính lại giờ đến và giá cho mọi chuyến chưa khởi hành, theo đúng mô hình hiện hành.
     *
     * <p>Vì sao phải có: {@link #ensureSupply} chỉ BÙ phần còn thiếu, không bao giờ sửa cái đã có.
     * Nên sau khi đổi cách tính, những chuyến seed từ bản cũ vẫn giữ nguyên giá và giờ chạy bốc
     * ngẫu nhiên, và chúng còn nằm đó tới hết tầm 30 ngày. Trên một cơ sở dữ liệu đang chạy thì đó
     * chính là phần lớn những gì khách nhìn thấy, nên không tính lại thì coi như chưa sửa gì.
     *
     * <p>CHỈ sửa giờ đến và giá:
     * <ul>
     *   <li>Không đụng phương tiện — ghế và vé đã bán đều trỏ về phương tiện của chuyến, đổi là
     *       làm hỏng sơ đồ ghế của những đơn có sẵn.</li>
     *   <li>Không đụng giờ khởi hành — khách đã được báo giờ đó, và thư nhắc trước chuyến dựng
     *       trên nó.</li>
     *   <li>Không đụng chuyến đã chạy — quá khứ để yên, mọi thống kê doanh thu đọc từ đó.</li>
     * </ul>
     *
     * <p>Tiền của đơn đã bán không suy suyển: {@code ve.price} và {@code dat_ve.total_price} lưu số
     * tiền riêng tại thời điểm đặt chứ không đọc lại giá chuyến.
     *
     * <p><b>Cảnh báo.</b> Hàm này không phân biệt được chuyến do hệ thống sinh với chuyến do quản
     * trị viên tự tạo hoặc tự sửa giá — chuyến nào cũng chỉ là một hàng trong chuyen_di. Sửa giá
     * tay trên màn quản trị rồi khởi động lại là giá đó bị kéo về mức của mô hình. Ai cần giữ giá
     * tay thì tắt {@code TRIP_REALIGN_ON_STARTUP}.
     *
     * @return số chuyến thực sự bị sửa; 0 nghĩa là tất cả đã khớp mô hình, không phải lỗi
     */
    @Transactional
    public int realignFutureTrips() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, ModePlan> planByType = MODE_PLANS.stream()
                .collect(Collectors.toMap(ModePlan::vehicleType, plan -> plan));

        int changed = 0;
        int pageNumber = 0;
        Page<Trip> page;
        do {
            page = tripRepository.findFutureTripsByStatus(now, ACTIVE_STATUS,
                    PageRequest.of(pageNumber, SAVE_BATCH_SIZE));

            for (Trip trip : page.getContent()) {
                if (realign(trip, planByType)) {
                    changed++;
                }
            }

            // Sửa trên entity đang được quản lý rồi flush, KHÔNG gọi saveAll. saveAll trên entity
            // đã tách sẽ đi đường merge, mà Trip.tickets đang cascade ALL kèm orphanRemoval — đúng
            // cái nhánh mà một lần merge nhìn nhầm tập vé là xoá vé đã bán. Dirty checking không
            // bao giờ chạm tới các collection chưa nạp.
            entityManager.flush();
            // Dọn để không ôm cả cửa sổ tồn kho trong bộ nhớ: hơn chục nghìn chuyến cho 30 ngày.
            entityManager.clear();
            pageNumber++;
        } while (page.hasNext());

        if (changed > 0) {
            log.info("[TripSupply] Đã tính lại giờ đến và giá cho {} chuyến chưa khởi hành.", changed);
        } else {
            log.debug("[TripSupply] Mọi chuyến chưa khởi hành đã khớp mô hình, không phải sửa gì.");
        }
        return changed;
    }

    /** Trả về true nếu chuyến này đang lệch mô hình và vừa được sửa lại. */
    private boolean realign(Trip trip, Map<String, ModePlan> planByType) {
        Vehicle vehicle = trip.getVehicle();
        Route route = trip.getRoute();
        if (vehicle == null || vehicle.getVehicleType() == null || route == null) {
            return false;
        }
        ModePlan plan = planByType.get(vehicle.getVehicleType().toUpperCase());
        if (plan == null) {
            // Loại phương tiện ngoài danh mục thì không có tham số nào để tính. Để nguyên còn hơn đoán.
            return false;
        }

        LocalDateTime departure = trip.getDepartureTime();
        if (departure == null) {
            return false;
        }

        double distanceKm = distanceOf(route);
        long fingerprint = fingerprint(route, plan.vehicleType(), departure);
        LocalDateTime arrival = departure.plusMinutes(travelMinutes(distanceKm, plan, fingerprint));
        BigDecimal price = fare(distanceKm, plan, departure,
                demandPercentFor(plan, distanceKm, departure), fingerprint);

        boolean lechGioDen = !arrival.equals(trip.getArrivalTime());
        // So bằng compareTo chứ không bằng equals: giá đọc từ CSDL mang scale 2 còn giá vừa tính
        // mang scale 0, equals của BigDecimal thì coi 950000 khác 950000.00.
        boolean lechGia = trip.getPrice() == null || price.compareTo(trip.getPrice()) != 0;
        if (!lechGioDen && !lechGia) {
            return false;
        }

        trip.setArrivalTime(arrival);
        trip.setPrice(price);
        return true;
    }

    /**
     * Hệ số nhu cầu của khung giờ mà một chuyến rơi vào.
     *
     * <p>Chuyến nằm ngoài mọi khung giờ của mô hình — do quản trị viên tự đặt giờ, hoặc sinh theo
     * bộ khung giờ của một bản cũ — vẫn phải có giá theo cự ly, chỉ là không được cộng trừ phần
     * nhu cầu theo giờ.
     */
    private static int demandPercentFor(ModePlan plan, double distanceKm, LocalDateTime departure) {
        for (int[] slot : plan.departuresFor(distanceKm)) {
            if (slot[0] == departure.getHour() && slot[1] == departure.getMinute()) {
                return slot[2];
            }
        }
        return NEUTRAL_DEMAND_PERCENT;
    }

    private static double distanceOf(Route route) {
        return PlaceCatalog.distanceKm(route.getOrigin(), route.getDestination())
                .orElse(FALLBACK_DISTANCE_KM);
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

    /**
     * Dựng một chuyến từ cự ly thật thay vì từ xúc xắc.
     *
     * <p>Giờ đến và giá đều là hàm của (cự ly, loại phương tiện, khung giờ, ngày khởi hành).
     * Phần ngẫu nhiên còn lại chỉ là một nhiễu nhỏ cho giá khỏi đều tăm tắp, và nhiễu đó lấy từ
     * vân tay của chính chuyến đó nên vẫn tất định.
     *
     * <p>Cố ý KHÔNG tính "còn mấy ngày nữa tới chuyến" vào giá. Giá seed chỉ được phụ thuộc vào
     * bản thân chuyến; phụ thuộc thêm vào thời điểm seed thì hai chuyến giống hệt nhau lại lệch
     * giá chỉ vì một chuyến được bù sớm hơn chuyến kia, mà chuyến bù sớm hay muộn là chuyện của
     * lịch cron chứ không phải chuyện của thị trường. Phần tăng giá khi cận ngày, nếu làm, thuộc
     * về một lớp định giá lúc tìm kiếm.
     */
    private Trip buildTrip(Route route, List<Vehicle> fleet, LocalDateTime departure,
                           ModePlan plan, double distanceKm, int demandPercent) {
        long fingerprint = fingerprint(route, plan.vehicleType(), departure);

        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicle(fleet.get(Math.floorMod(fingerprint >> 33, fleet.size())));
        trip.setDepartureTime(departure);
        trip.setArrivalTime(departure.plusMinutes(travelMinutes(distanceKm, plan, fingerprint)));
        trip.setPrice(fare(distanceKm, plan, departure, demandPercent, fingerprint));
        trip.setStatus(ACTIVE_STATUS);
        return trip;
    }

    /** Thời gian chạy: quãng đường chia tốc độ hiệu dụng, cộng phần cố định và nghỉ dọc đường. */
    private static long travelMinutes(double distanceKm, ModePlan plan, long fingerprint) {
        double drivingMinutes = distanceKm / plan.effectiveKmh() * 60.0;
        long restMinutes = plan.restBreakMinutes() > 0
                ? (long) (drivingMinutes / MINUTES_BETWEEN_REST_BREAKS) * plan.restBreakMinutes()
                : 0L;
        long jitter = Math.floorMod(fingerprint >> 17, 13) - 6;
        long total = plan.fixedOverheadMinutes() + Math.round(drivingMinutes) + restMinutes + jitter;
        return Math.max(MIN_TRAVEL_MINUTES, roundToNearest(total, 5));
    }

    /** Giá: giá sàn theo cự ly, nhân mùa vụ của ngày đi, nhân nhu cầu của khung giờ. */
    private static BigDecimal fare(double distanceKm, ModePlan plan, LocalDateTime departure,
                                   int demandPercent, long fingerprint) {
        double floorPrice = plan.baseFareVnd() + plan.farePerKmVnd() * distanceKm;
        double jitter = 0.96 + Math.floorMod(fingerprint, 801) / 10_000.0;
        double price = floorPrice
                * DemandCalendar.factorFor(departure.toLocalDate())
                * (demandPercent / 100.0)
                * jitter;
        return BigDecimal.valueOf(roundToNearest(Math.round(price), FARE_ROUNDING_VND));
    }

    private static long roundToNearest(long value, long step) {
        return (value + step / 2) / step * step;
    }

    /**
     * Vân tay tất định của một chuyến, dùng thay cho bộ sinh ngẫu nhiên.
     *
     * <p>Tự viết hàm băm thay vì gọi {@code Objects.hash} vì {@code hashCode} của
     * {@code LocalDateTime} không được đặc tả là bất biến giữa các bản JDK, mà thứ cần ở đây
     * đúng là tính bất biến: cùng một chuyến thì máy nào, JDK nào, lần chạy nào cũng phải ra
     * đúng một con số. FNV-1a 64 bit thì cố định vĩnh viễn và viết gọn trong sáu dòng.
     */
    private static long fingerprint(Route route, String vehicleType, LocalDateTime departure) {
        String key = route.getOrigin() + '-' + route.getDestination() + '|' + vehicleType + '|' + departure;
        long hash = 0xcbf29ce484222325L;
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) {
            hash ^= (b & 0xff);
            hash *= 0x100000001b3L;
        }
        return hash;
    }

    /**
     * Mã điểm nào trong danh mục tuyến chưa có toạ độ.
     *
     * <p>Không chặn việc sinh chuyến, chỉ nói to lên: thiếu toạ độ nghĩa là tuyến đó rơi về cự ly
     * mặc định, và khi đó giờ đến lẫn giá đều sai mà nhìn vào màn hình thì không thấy gì bất thường.
     */
    private void warnUnknownPlaceCodes() {
        Set<String> unknown = new TreeSet<>();
        for (ModePlan plan : MODE_PLANS) {
            for (String[] pair : plan.routePairs()) {
                for (String code : pair) {
                    if (PlaceCatalog.find(code).isEmpty()) {
                        unknown.add(code);
                    }
                }
            }
        }
        if (!unknown.isEmpty()) {
            log.warn("[TripSupply] Chưa có toạ độ cho mã điểm {}; những tuyến dính các mã này dùng cự ly "
                    + "mặc định {} km nên giờ đến và giá sẽ không đúng.", unknown, FALLBACK_DISTANCE_KM);
        }
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
