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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

    /** Mã chỗ dạng "<hàng><cột>", ví dụ "12B". */
    private static final Pattern SEAT_NUMBER = Pattern.compile("^(\\d+)([A-Za-z])$");

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
            int retypedSeats = alignSeatDecks();
            if (retypedSeats > 0) {
                log.info("[FleetSeeder] Đã đưa {} chỗ xe khách/tàu hoả về đúng bố cục hạng chỗ hiện tại.", retypedSeats);
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
     * Những hàng đầu là hạng cao hơn, đúng cách các hãng thật xếp khoang.
     */
    private static List<Seat> buildSeats(Vehicle vehicle, String type, int totalSeats) {
        String[] columns = columnsOf(type);
        int rows = totalSeats / columns.length;
        int premiumRows = premiumRowsOf(type, rows);
        String premiumType = premiumTypeOf(type);

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

    private static String[] columnsOf(String type) {
        return "PLANE".equals(type)
                ? new String[] { "A", "B", "C", "D", "E", "F" }
                : new String[] { "A", "B", "C", "D" };
    }

    /**
     * Xe khách đường dài ở Việt Nam chủ yếu là xe giường nằm hai tầng, nên tầng giường phải
     * chiếm phần lớn sơ đồ chứ không phải vài hàng đầu như khoang thương gia máy bay: lấy
     * 60% số hàng làm giường, chừa lại ít nhất 3 hàng ghế ngồi ở cuối để tầng 2 không rỗng.
     */
    private static int premiumRowsOf(String type, int rows) {
        if (!"BUS".equals(type)) {
            return 3;
        }
        int sleeperRows = (int) Math.ceil(rows * 0.6);
        return Math.max(1, Math.min(sleeperRows, rows - 3));
    }

    /**
     * Tên hạng chỗ ở đây không phải chuyện thẩm mỹ: BookingService cộng phụ thu theo đúng
     * chuỗi này (BUSINESS +100.000, SLEEPER +50.000, VIP x2) và sơ đồ chỗ phía web cũng
     * xếp tầng/toa theo nó.
     *
     * Xe khách dùng SLEEPER để lên tầng giường nằm. Tàu hoả dùng BUSINESS chứ không phải
     * VIP: toàn bộ giao diện tàu gọi khoang cao cấp là "toa thương gia" và bảng giá tóm tắt
     * báo phụ thu +100.000, trong khi VIP bị nhân đôi giá — chọn ghế báo 400.000 rồi sang
     * bước sau thu 600.000 chính là chỗ lệch đó.
     */
    private static String premiumTypeOf(String type) {
        return "BUS".equals(type) ? "SLEEPER" : "BUSINESS";
    }

    /**
     * Đưa xe khách và tàu hoả đã seed từ trước về đúng bố cục hạng chỗ hiện tại.
     *
     * ensureVehicles bỏ qua phương tiện đã tồn tại, nên nếu chỉ sửa buildSeats thì mọi cơ sở
     * dữ liệu cũ vẫn giữ sơ đồ cũ — xe khách không có lấy một chỗ SLEEPER nào (tầng giường
     * nằm trống trơn), còn tàu hoả giữ 3 hàng VIP bị tính giá gấp đôi trong khi giao diện
     * báo giá theo hạng thương gia. Chỉ ghi đè loại chỗ; vé đã đặt không đổi giá vì Ticket
     * chốt giá ngay lúc tạo booking.
     */
    private int alignSeatDecks() {
        List<Seat> changed = new ArrayList<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {
            String type = vehicle.getVehicleType();
            if (!"BUS".equals(type) && !"TRAIN".equals(type)) {
                continue;
            }
            List<Seat> seats = seatRepository.findByVehicleId(vehicle.getId());
            if (seats.isEmpty()) {
                continue;
            }

            int rows = seats.stream()
                    .map(seat -> rowOf(seat.getSeatNumber()))
                    .max(Integer::compareTo)
                    .orElse(0);
            if (rows == 0) {
                continue;
            }

            int premiumRows = premiumRowsOf(type, rows);
            String premiumType = premiumTypeOf(type);
            for (Seat seat : seats) {
                int row = rowOf(seat.getSeatNumber());
                if (row <= 0) {
                    continue;
                }
                String expected = row <= premiumRows ? premiumType : "ECONOMY";
                if (!expected.equalsIgnoreCase(seat.getSeatType())) {
                    seat.setSeatType(expected);
                    changed.add(seat);
                }
            }
        }

        if (!changed.isEmpty()) {
            seatRepository.saveAll(changed);
        }
        return changed.size();
    }

    /** Số hàng trong mã chỗ kiểu "12B"; 0 nếu không đúng định dạng. */
    private static int rowOf(String seatNumber) {
        if (seatNumber == null) {
            return 0;
        }
        Matcher matcher = SEAT_NUMBER.matcher(seatNumber.trim());
        return matcher.matches() ? Integer.parseInt(matcher.group(1)) : 0;
    }
}
