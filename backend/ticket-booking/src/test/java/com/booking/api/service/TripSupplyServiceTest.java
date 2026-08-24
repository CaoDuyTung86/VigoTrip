package com.booking.api.service;

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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Nguồn cung chuyến từng là seeder chạy-một-lần với điều kiện bỏ qua chốt vào MỘT tuyến
 * đại diện ("HAN->SAP đã có chuyến chưa"), nên chỉ cần tuyến đó có dữ liệu là mấy chục
 * tuyến còn lại không bao giờ được sinh — production vì thế chỉ còn HAN<->SGN, HAN<->DAD.
 * Kèm theo đó là một bước dọn rác xoá chuyến quá khứ, mà Trip.tickets đang cascade ALL +
 * orphanRemoval nên xoá chuyến là xoá luôn vé đã bán và toàn bộ dữ liệu doanh thu.
 *
 * Test ở đây khoá lại hành vi mới: bù ĐÚNG phần còn thiếu theo từng (tuyến, phương tiện,
 * ngày), gọi lại bao nhiêu lần cũng không sinh trùng, và không bao giờ xoá.
 *
 * Các repository được giả lập bằng kho trong bộ nhớ thay vì trả về hằng số, vì tính
 * idempotent chỉ có ý nghĩa khi lần chạy sau nhìn thấy được thứ lần chạy trước đã lưu.
 */
@ExtendWith(MockitoExtension.class)
class TripSupplyServiceTest {

    private static final int HORIZON_DAYS = 3;

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
                vehicle(1L, "PLANE"), vehicle(2L, "BUS"), vehicle(3L, "TRAIN")));

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
    @DisplayName("Lần đầu sinh chuyến cho cả ba loại phương tiện, không chỉ vài tuyến")
    void ensureSupply_phuDuBaLoaiPhuongTien() {
        int created = tripSupplyService.ensureSupply(HORIZON_DAYS);

        assertTrue(created > 0, "Kho rỗng thì phải sinh chuyến");
        List<String> types = tripStore.stream()
                .map(t -> t.getVehicle().getVehicleType())
                .distinct()
                .toList();
        assertTrue(types.containsAll(List.of("PLANE", "BUS", "TRAIN")),
                "Thiếu loại phương tiện: " + types);

        // Chính là lỗi cũ trên production: chỉ HAN<->SGN và HAN<->DAD có chuyến bay.
        long planeDestinationsFromHanoi = tripStore.stream()
                .filter(t -> "PLANE".equals(t.getVehicle().getVehicleType()))
                .filter(t -> "HAN".equals(t.getRoute().getOrigin()))
                .map(t -> t.getRoute().getDestination())
                .distinct()
                .count();
        assertTrue(planeDestinationsFromHanoi > 2,
                "Hà Nội phải có nhiều hơn 2 điểm đến đường bay, đang có " + planeDestinationsFromHanoi);
    }

    @Test
    @DisplayName("Gọi lại khi kho đã đầy thì không sinh thêm chuyến trùng")
    void ensureSupply_idempotent() {
        int first = tripSupplyService.ensureSupply(HORIZON_DAYS);
        int sizeAfterFirst = tripStore.size();

        int second = tripSupplyService.ensureSupply(HORIZON_DAYS);

        assertTrue(first > 0);
        assertEquals(0, second, "Lần chạy thứ hai không được sinh thêm gì");
        assertEquals(sizeAfterFirst, tripStore.size());
    }

    @Test
    @DisplayName("Thiếu đúng một (tuyến, phương tiện, ngày) thì chỉ bù đúng chỗ đó")
    void ensureSupply_buDungPhanConThieu() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        // Khoét một lỗ: bỏ hết chuyến bay của một tuyến trong đúng một ngày.
        Trip victim = tripStore.stream()
                .filter(t -> "PLANE".equals(t.getVehicle().getVehicleType()))
                .findFirst()
                .orElseThrow();
        Long routeId = victim.getRoute().getId();
        LocalDate day = victim.getDepartureTime().toLocalDate();

        List<Trip> removed = tripStore.stream()
                .filter(t -> Objects.equals(t.getRoute().getId(), routeId)
                        && "PLANE".equals(t.getVehicle().getVehicleType())
                        && t.getDepartureTime().toLocalDate().equals(day))
                .toList();
        tripStore.removeAll(removed);
        int sizeWithHole = tripStore.size();

        int refilled = tripSupplyService.ensureSupply(HORIZON_DAYS);

        assertEquals(removed.size(), refilled, "Phải bù đúng số chuyến đã khoét, không hơn không kém");
        assertEquals(sizeWithHole + removed.size(), tripStore.size());
        assertTrue(tripStore.stream()
                .skip(sizeWithHole)
                .allMatch(t -> Objects.equals(t.getRoute().getId(), routeId)
                        && t.getDepartureTime().toLocalDate().equals(day)),
                "Chuyến bù phải rơi đúng vào tuyến và ngày bị thiếu");
    }

    @Test
    @DisplayName("Không sinh chuyến đã khởi hành trong quá khứ")
    void ensureSupply_khongSinhChuyenQuaKhu() {
        LocalDateTime before = LocalDateTime.now();

        tripSupplyService.ensureSupply(HORIZON_DAYS);

        assertFalse(tripStore.isEmpty());
        assertTrue(tripStore.stream().allMatch(t -> !t.getDepartureTime().isBefore(before)),
                "TripService.searchTrips lọc bỏ chuyến quá khứ, sinh ra chỉ tổ phình DB");
    }

    @Test
    @DisplayName("Không bao giờ xoá chuyến cũ — lịch sử vé và doanh thu phụ thuộc vào đó")
    void ensureSupply_khongXoaChuyenCu() {
        tripSupplyService.ensureSupply(HORIZON_DAYS);
        tripSupplyService.ensureSupply(HORIZON_DAYS);

        verify(tripRepository, never()).delete(any());
        verify(tripRepository, never()).deleteAll(anyList());
        verify(tripRepository, never()).deleteAll();
    }

    private static Vehicle vehicle(Long id, String type) {
        Provider provider = new Provider();
        provider.setId(id);
        provider.setProviderName("NCC " + type);
        provider.setProviderType(type);

        Vehicle v = new Vehicle();
        v.setId(id);
        v.setProvider(provider);
        v.setVehicleType(type);
        v.setTotalSeats(40);
        return v;
    }
}
