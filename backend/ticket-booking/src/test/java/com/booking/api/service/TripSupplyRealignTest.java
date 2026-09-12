package com.booking.api.service;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VehicleRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.PageImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bù chuyến chỉ THÊM phần còn thiếu, không bao giờ sửa chuyến đã có. Nên mỗi lần đổi cách tính
 * giờ đến và giá, dữ liệu seed từ bản cũ vẫn nằm nguyên trong cơ sở dữ liệu tới hết tầm 30 ngày
 * — và trên môi trường đang chạy thì đó chính là phần lớn những gì khách nhìn thấy. Bước tính
 * lại sinh ra để vá đúng khoảng đó.
 *
 * <p>Nó ghi đè lên dữ liệu có sẵn nên phải được khoanh vùng chặt: chỉ giờ đến và giá, chỉ chuyến
 * chưa khởi hành, và tuyệt đối không đụng tới phương tiện — ghế cùng vé đã bán đều trỏ về phương
 * tiện của chuyến. Các test dưới đây khoá lại đúng phạm vi đó.
 */
@ExtendWith(MockitoExtension.class)
class TripSupplyRealignTest {

    @Mock
    private RouteRepository routeRepository;
    @Mock
    private VehicleRepository vehicleRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private TripSupplyService tripSupplyService;

    @Test
    @DisplayName("Chuyến seed từ bản cũ được kéo về đúng mô hình")
    void keoChuyenCuVeDungMoHinh() {
        // Xe khách Hà Nội - Sài Gòn mà chạy 5 tiếng: đúng kiểu phi lý của bản bốc ngẫu nhiên cũ.
        Trip chuyenLechMoHinh = trip("HAN", "SGN", "BUS", ngayMai(8, 0), 350_000, 5);

        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of(chuyenLechMoHinh)));

        int daSua = tripSupplyService.realignFutureTrips();

        assertEquals(1, daSua);
        double gioChay = Duration.between(chuyenLechMoHinh.getDepartureTime(),
                chuyenLechMoHinh.getArrivalTime()).toMinutes() / 60.0;
        assertTrue(gioChay > 24,
                "Xe khách Bắc - Nam phải hơn một ngày đường, đang là " + gioChay);
        assertNotEquals(0, chuyenLechMoHinh.getPrice().compareTo(BigDecimal.valueOf(350_000)),
                "Giá phải được tính lại theo cự ly chứ không giữ bậc giá cũ");
    }

    @Test
    @DisplayName("Chỉ sửa giờ đến và giá, không đụng phương tiện lẫn giờ khởi hành")
    void khongDungPhuongTienVaGioKhoiHanh() {
        LocalDateTime gioDi = ngayMai(8, 0);
        Trip chuyen = trip("HAN", "SGN", "BUS", gioDi, 350_000, 5);
        Vehicle phuongTienBanDau = chuyen.getVehicle();

        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of(chuyen)));

        tripSupplyService.realignFutureTrips();

        // Ghế và vé đã bán đều trỏ về phương tiện của chuyến; đổi phương tiện là làm hỏng sơ đồ
        // ghế của những đơn có sẵn. Giờ khởi hành thì khách đã được báo, và thư nhắc dựng trên nó.
        assertSame(phuongTienBanDau, chuyen.getVehicle());
        assertEquals(gioDi, chuyen.getDepartureTime());
        assertEquals("ACTIVE", chuyen.getStatus());
    }

    @Test
    @DisplayName("Chạy lần hai không ghi gì nữa")
    void chayLanHaiKhongGhiThem() {
        Trip chuyen = trip("HAN", "SGN", "BUS", ngayMai(8, 0), 350_000, 5);

        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of(chuyen)));

        int lanDau = tripSupplyService.realignFutureTrips();
        int lanHai = tripSupplyService.realignFutureTrips();

        assertEquals(1, lanDau);
        assertEquals(0, lanHai,
                "Mô hình tất định nên chuyến đã khớp phải được bỏ qua, không ghi lại mỗi lần khởi động");
    }

    @Test
    @DisplayName("Chỉ đụng tới chuyến chưa khởi hành và đang bán")
    void chiDungChuyenChuaKhoiHanhVaDangBan() {
        LocalDateTime truocKhiChay = LocalDateTime.now();
        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of()));

        tripSupplyService.realignFutureTrips();

        ArgumentCaptor<LocalDateTime> tuLuc = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(tripRepository).findFutureTripsByStatus(tuLuc.capture(), eq("ACTIVE"), any());

        assertTrue(!tuLuc.getValue().isBefore(truocKhiChay),
                "Phải lọc từ thời điểm hiện tại trở đi: quá khứ là dữ liệu doanh thu, không được sửa");
    }

    @Test
    @DisplayName("Loại phương tiện lạ thì để nguyên chứ không đoán")
    void loaiPhuongTienLaThiDeNguyen() {
        Trip chuyenLa = trip("HAN", "SGN", "FERRY", ngayMai(8, 0), 350_000, 5);
        LocalDateTime gioDenBanDau = chuyenLa.getArrivalTime();

        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of(chuyenLa)));

        int daSua = tripSupplyService.realignFutureTrips();

        assertEquals(0, daSua);
        assertEquals(gioDenBanDau, chuyenLa.getArrivalTime());
        assertEquals(0, chuyenLa.getPrice().compareTo(BigDecimal.valueOf(350_000)));
    }

    @Test
    @DisplayName("Không bao giờ đi đường saveAll, vì merge chạm phải nhánh xoá vé")
    void khongDiDuongSaveAll() {
        Trip chuyen = trip("HAN", "SGN", "BUS", ngayMai(8, 0), 350_000, 5);
        when(tripRepository.findFutureTripsByStatus(any(), eq("ACTIVE"), any()))
                .thenReturn(new PageImpl<>(List.of(chuyen)));

        tripSupplyService.realignFutureTrips();

        // Trip.tickets đang cascade ALL kèm orphanRemoval. saveAll trên entity đã tách sẽ đi
        // đường merge, và đó đúng là nhánh mà một lần nhìn nhầm tập vé là xoá vé đã bán.
        // Ở đây phải là sửa trên entity đang được quản lý rồi flush.
        verify(tripRepository, never()).saveAll(any());
        verify(entityManager).flush();
        verify(entityManager).clear();
    }

    private static LocalDateTime ngayMai(int gio, int phut) {
        return LocalDateTime.now().plusDays(1).withHour(gio).withMinute(phut)
                .withSecond(0).withNano(0);
    }

    private static Trip trip(String origin, String destination, String vehicleType,
                             LocalDateTime departure, long price, int gioChayCu) {
        Route route = new Route();
        route.setId(1L);
        route.setOrigin(origin);
        route.setDestination(destination);

        Provider provider = new Provider();
        provider.setId(1L);
        provider.setProviderName("NCC " + vehicleType);
        provider.setProviderType(vehicleType);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setProvider(provider);
        vehicle.setVehicleType(vehicleType);
        vehicle.setTotalSeats(40);

        Trip trip = new Trip();
        trip.setId(1L);
        trip.setRoute(route);
        trip.setVehicle(vehicle);
        trip.setDepartureTime(departure);
        trip.setArrivalTime(departure.plusHours(gioChayCu));
        trip.setPrice(BigDecimal.valueOf(price));
        trip.setStatus("ACTIVE");
        return trip;
    }
}
