package com.booking.api.service;

import com.booking.api.catalog.PlaceCatalog;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

/**
 * Chuyến sinh ra phải giống chuyến thật tới mức nhìn vào không thấy chỗ nào phi lý.
 *
 * <p>Bản cũ bốc thời gian chạy và giá bằng xúc xắc, độc lập với cự ly, nên dữ liệu seed mang
 * những chỗ sai ai cũng nhận ra ngay: xe khách Hà Nội đi Sài Gòn mất 3 tiếng, tàu Thống Nhất
 * chạy nhanh hơn máy bay, và bay tới thành phố xa hơn lại rẻ hơn. Các test dưới đây khoá lại
 * đúng những chỗ đó, đồng thời khoá luôn tính tất định — thứ mà bộ sinh ngẫu nhiên cũ không có,
 * khiến mỗi lần khởi động lại là một bảng giá khác và không demo lại được.
 *
 * <p>Các ngưỡng dưới đây nới rộng có chủ ý. Mục đích là bắt cái phi lý, không phải chốt cứng
 * tham số hiệu chỉnh — chốt cứng thì mỗi lần chỉnh giá lại phải sửa test, và test kiểu đó chỉ
 * chép lại mã nguồn chứ không kiểm tra gì.
 */
@ExtendWith(MockitoExtension.class)
class TripSupplyRealismTest {

    private static final int HORIZON_DAYS = 5;

    @Mock
    private RouteRepository routeRepository;
    @Mock
    private VehicleRepository vehicleRepository;
    @Mock
    private TripRepository tripRepository;

    @InjectMocks
    private TripSupplyService tripSupplyService;

    private final List<Route> routeStore = new ArrayList<>();
    private final List<Trip> tripStore = new ArrayList<>();
    private final AtomicLong routeSeq = new AtomicLong();

    @BeforeEach
    void setUp() {
        when(routeRepository.findAll()).thenAnswer(inv -> new ArrayList<>(routeStore));
        when(routeRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<Route> batch = inv.getArgument(0);
            batch.forEach(r -> {
                r.setId(routeSeq.incrementAndGet());
                routeStore.add(r);
            });
            return batch;
        });
        when(vehicleRepository.findAll()).thenReturn(List.of(
                vehicle(1L, "PLANE"), vehicle(2L, "PLANE"),
                vehicle(3L, "BUS"), vehicle(4L, "BUS"),
                vehicle(5L, "TRAIN"), vehicle(6L, "TRAIN")));
        when(tripRepository.findSupplySlots(any(), any())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            LocalDateTime to = inv.getArgument(1);
            return tripStore.stream()
                    .filter(t -> !t.getDepartureTime().isBefore(from) && t.getDepartureTime().isBefore(to))
                    .map(t -> new Object[] {
                            t.getRoute().getId(), t.getVehicle().getVehicleType(), t.getDepartureTime() })
                    .collect(Collectors.toList());
        });
        when(tripRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<Trip> batch = inv.getArgument(0);
            tripStore.addAll(batch);
            return batch;
        });
    }

    @Test
    @DisplayName("Mọi mã điểm trong danh mục tuyến đều có toạ độ")
    void moiMaDiemDeuCoToaDo() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        Set<String> thieuToaDo = new LinkedHashSet<>();
        for (Trip trip : tripStore) {
            for (String code : List.of(trip.getRoute().getOrigin(), trip.getRoute().getDestination())) {
                if (PlaceCatalog.find(code).isEmpty()) {
                    thieuToaDo.add(code);
                }
            }
        }

        // Thiếu toạ độ thì tuyến đó rơi về cự ly mặc định: giờ đến và giá vẫn hiện ra bình thường
        // nhưng đều sai, nên đây là kiểu hỏng phải bắt bằng test chứ không bắt được bằng mắt.
        assertTrue(thieuToaDo.isEmpty(),
                "Thêm mã điểm vào danh mục tuyến thì phải thêm cả toạ độ: " + thieuToaDo);
    }

    @Test
    @DisplayName("Thời gian chạy hợp lý với từng loại phương tiện trên chặng Bắc - Nam")
    void thoiGianChayHopLyTrenChangBacNam() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        double bayGio = gioChayTrungBinh("PLANE", "HAN", "SGN");
        double tauGio = gioChayTrungBinh("TRAIN", "HAN", "SGN");
        double xeGio = gioChayTrungBinh("BUS", "HAN", "SGN");

        assertTrue(bayGio > 1.5 && bayGio < 3.0,
                "Bay Hà Nội - Sài Gòn phải quanh 2 tiếng, đang là " + bayGio);
        assertTrue(tauGio > 26 && tauGio < 38,
                "Tàu Thống Nhất phải hơn 30 tiếng, đang là " + tauGio);
        assertTrue(xeGio > 24, "Xe khách Bắc - Nam không thể dưới một ngày, đang là " + xeGio);
        assertTrue(bayGio < tauGio, "Tàu không thể nhanh hơn máy bay");
    }

    @Test
    @DisplayName("Chặng ngắn thì nhanh, và nhanh theo đúng tỉ lệ cự ly")
    void changNganThiNhanh() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        double bacNam = gioChayTrungBinh("TRAIN", "HAN", "SGN");
        double haNoiVinh = gioChayTrungBinh("TRAIN", "HAN", "VIN");

        assertTrue(haNoiVinh > 3 && haNoiVinh < 11,
                "Tàu Hà Nội - Vinh phải quanh 6 tới 7 tiếng, đang là " + haNoiVinh);
        assertTrue(bacNam > haNoiVinh * 3,
                "Bắc - Nam xa gấp hơn 4 lần Hà Nội - Vinh nên phải lâu hơn hẳn");
    }

    @Test
    @DisplayName("Cùng loại phương tiện, cùng khung giờ thì chặng xa hơn đắt hơn")
    void changXaHonThiDatHon() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        Map<LocalDateTime, BigDecimal> xa = giaTheoGioKhoiHanh("PLANE", "HAN", "SGN");
        Map<LocalDateTime, BigDecimal> gan = giaTheoGioKhoiHanh("PLANE", "HAN", "DAD");

        // So cùng một thời điểm khởi hành để loại hết ảnh hưởng của mùa vụ và khung giờ;
        // khi đó chỉ còn cự ly và nhiễu nhỏ, mà nhiễu thì không đủ lật ngược chênh lệch.
        List<LocalDateTime> chung = xa.keySet().stream().filter(gan::containsKey).toList();
        assertFalse(chung.isEmpty(), "Phải có ít nhất một giờ khởi hành trùng để so sánh");

        for (LocalDateTime luc : chung) {
            assertTrue(xa.get(luc).compareTo(gan.get(luc)) > 0,
                    "Bay Sài Gòn (xa hơn) phải đắt hơn bay Đà Nẵng lúc " + luc
                            + ": " + xa.get(luc) + " so với " + gan.get(luc));
        }
    }

    @Test
    @DisplayName("Chạy lại lần nữa ra đúng bảng giá và đúng giờ đến cũ")
    void sinhLaiRaDungKetQuaCu() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);
        Map<String, String> lanDau = chupLai();

        // Xoá sạch như thể seed lại trên một môi trường mới tinh.
        tripStore.clear();
        routeStore.clear();
        routeSeq.set(0);

        tripSupplyService.ensureSupply(HORIZON_DAYS);
        Map<String, String> lanHai = chupLai();

        assertFalse(lanDau.isEmpty());
        for (Map.Entry<String, String> chuyen : lanDau.entrySet()) {
            String sauKhiSinhLai = lanHai.get(chuyen.getKey());
            if (sauKhiSinhLai == null) {
                // Khung giờ nằm sát mốc "bây giờ" có thể trôi qua giữa hai lần chạy; bỏ qua chứ
                // không coi là sai, vì nguồn cung cố ý không sinh chuyến đã khởi hành.
                continue;
            }
            assertEquals(chuyen.getValue(), sauKhiSinhLai,
                    "Cùng một chuyến mà hai lần sinh ra hai kết quả khác nhau: " + chuyen.getKey());
        }
    }

    @Test
    @DisplayName("Không chuyến nào có giá vô lý hoặc giờ đến trước giờ đi")
    void khongCoChuyenVoLy() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        assertFalse(tripStore.isEmpty());
        for (Trip trip : tripStore) {
            assertTrue(trip.getPrice().compareTo(BigDecimal.ZERO) > 0, "Giá phải dương: " + moTa(trip));
            assertTrue(trip.getArrivalTime().isAfter(trip.getDepartureTime()),
                    "Giờ đến phải sau giờ đi: " + moTa(trip));
            assertEquals(0, trip.getPrice().longValue() % 1_000,
                    "Giá phải tròn nghìn, đang là " + trip.getPrice());
        }
    }

    @Test
    @DisplayName("Chặng ngắn chạy dày hơn chặng dài")
    void changNganChayDayHonChangDai() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        // Lấy ngày cuối tầm để mọi khung giờ đều còn ở tương lai; ngày hôm nay bị cắt mất những
        // khung đã trôi qua nên không so sánh mật độ được.
        LocalDate ngayDay = LocalDate.now().plusDays(HORIZON_DAYS - 1L);

        int chuyenNgan = gioKhoiHanhTrongNgay("BUS", "HAN", "HPH", ngayDay).size();
        int chuyenDai = gioKhoiHanhTrongNgay("BUS", "HAN", "SGN", ngayDay).size();

        assertTrue(chuyenNgan > chuyenDai,
                "Hà Nội - Hải Phòng đi về trong ngày nên phải nhiều chuyến hơn chặng Bắc - Nam: "
                        + chuyenNgan + " so với " + chuyenDai);
    }

    @Test
    @DisplayName("Chặng cả ngày đường chỉ mở chuyến sáng sớm hoặc tối")
    void changDaiKhongMoChuyenGiuaTrua() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        LocalDate ngayDay = LocalDate.now().plusDays(HORIZON_DAYS - 1L);
        Set<Integer> gioChay = gioKhoiHanhTrongNgay("TRAIN", "HAN", "SGN", ngayDay);

        assertFalse(gioChay.isEmpty(), "Phải có chuyến tàu Thống Nhất trong ngày");
        for (int gio : gioChay) {
            assertTrue(gio <= 9 || gio >= 17,
                    "Tàu chạy hơn 30 tiếng thì không ai mở chuyến giữa trưa, đang có chuyến lúc " + gio);
        }
    }

    // Phần dùng chung

    private double gioChayTrungBinh(String vehicleType, String origin, String destination) {
        return chuyenCua(vehicleType, origin, destination).stream()
                .mapToDouble(t -> Duration.between(t.getDepartureTime(), t.getArrivalTime()).toMinutes() / 60.0)
                .average()
                .orElseThrow(() -> new AssertionError(
                        "Không sinh được chuyến " + vehicleType + " " + origin + "-" + destination));
    }

    private Map<LocalDateTime, BigDecimal> giaTheoGioKhoiHanh(String vehicleType,
                                                              String origin,
                                                              String destination) {
        Map<LocalDateTime, BigDecimal> theoGio = new HashMap<>();
        chuyenCua(vehicleType, origin, destination)
                .forEach(t -> theoGio.put(t.getDepartureTime(), t.getPrice()));
        return theoGio;
    }

    /** Các giờ khởi hành của một tuyến trong đúng một ngày. */
    private Set<Integer> gioKhoiHanhTrongNgay(String vehicleType, String origin,
                                              String destination, LocalDate ngay) {
        Set<Integer> gio = new TreeSet<>();
        chuyenCua(vehicleType, origin, destination).stream()
                .filter(t -> t.getDepartureTime().toLocalDate().equals(ngay))
                .forEach(t -> gio.add(t.getDepartureTime().getHour()));
        return gio;
    }

    private List<Trip> chuyenCua(String vehicleType, String origin, String destination) {
        return tripStore.stream()
                .filter(t -> vehicleType.equals(t.getVehicle().getVehicleType()))
                .filter(t -> origin.equals(t.getRoute().getOrigin()))
                .filter(t -> destination.equals(t.getRoute().getDestination()))
                .toList();
    }

    /** Khoá là danh tính chuyến, giá trị là những gì mô hình sinh ra cho chuyến đó. */
    private Map<String, String> chupLai() {
        Map<String, String> anh = new HashMap<>();
        for (Trip trip : tripStore) {
            anh.put(moTa(trip), trip.getPrice() + " @ " + trip.getArrivalTime()
                    + " / xe " + trip.getVehicle().getId());
        }
        return anh;
    }

    private static String moTa(Trip trip) {
        return trip.getRoute().getOrigin() + "-" + trip.getRoute().getDestination()
                + "|" + trip.getVehicle().getVehicleType() + "|" + trip.getDepartureTime();
    }

    private static Vehicle vehicle(Long id, String type) {
        Provider provider = new Provider();
        provider.setId(id);
        provider.setProviderName("NCC " + type + " " + id);
        provider.setProviderType(type);

        Vehicle v = new Vehicle();
        v.setId(id);
        v.setProvider(provider);
        v.setVehicleType(type);
        v.setTotalSeats(40);
        return v;
    }
}
