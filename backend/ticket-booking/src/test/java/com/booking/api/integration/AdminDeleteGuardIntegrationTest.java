package com.booking.api.integration;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VehicleRepository;
import com.booking.api.service.AdminService;
import com.booking.api.service.BookingService;
import com.booking.api.service.EmailService;
import com.booking.api.service.SeatLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Xóa danh mục không được phép cuốn theo vé đã bán.
 *
 * Route → trips, Provider → vehicles → trips và Trip → tickets đều khai báo
 * {@code cascade = ALL, orphanRemoval = true}. Trước khi có các chốt chặn dưới đây, một cú
 * DELETE tuyến đường trả về 204 rồi lặng lẽ xóa mọi chuyến thuộc tuyến cùng toàn bộ vé của
 * chúng — kể cả vé đã thanh toán. Không có cảnh báo, không có đường hoàn tác.
 *
 * Vì vậy các test này kiểm tra hai điều cùng lúc: thao tác xóa bị chặn, VÀ dữ liệu vẫn còn
 * nguyên sau khi bị chặn.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdminDeleteGuardIntegrationTest {

    @Autowired private AdminService adminService;
    @Autowired private BookingService bookingService;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private RouteRepository routeRepository;
    @Autowired private ProviderRepository providerRepository;
    @Autowired private VehicleRepository vehicleRepository;
    @Autowired private SeatRepository seatRepository;
    @Autowired private TripRepository tripRepository;
    @Autowired private TicketRepository ticketRepository;

    @MockitoBean private EmailService emailService;
    @MockitoBean private SeatLockService seatLockService;

    private Route route;
    private Provider provider;
    private Vehicle vehicle;
    private Trip trip;
    private Long ticketId;

    @BeforeEach
    void setUp() {
        when(seatLockService.getLockedBy(anyLong())).thenReturn(null);

        User user = new User();
        user.setEmail("guard@example.com");
        user.setFullName("Khach Mua Ve");
        user.setPassword("password123");
        user.setRole("ROLE_USER");
        user.setPoints(0);
        user = userRepository.save(user);

        provider = new Provider();
        provider.setProviderName("Hang Test");
        provider.setProviderType("BUS");
        provider = providerRepository.save(provider);

        vehicle = new Vehicle();
        vehicle.setProvider(provider);
        vehicle.setVehicleType("BUS");
        vehicle.setTotalSeats(30);
        vehicle = vehicleRepository.save(vehicle);

        Seat seat = new Seat();
        seat.setVehicle(vehicle);
        seat.setSeatNumber("A01");
        seat.setSeatType("NORMAL");
        seat = seatRepository.save(seat);

        route = new Route();
        route.setOrigin("HAN");
        route.setDestination("DAD");
        route = routeRepository.save(route);

        trip = new Trip();
        trip.setVehicle(vehicle);
        trip.setRoute(route);
        trip.setPrice(java.math.BigDecimal.valueOf(150000));
        trip.setDepartureTime(LocalDateTime.now().plusDays(5));
        trip.setArrivalTime(LocalDateTime.now().plusDays(5).plusHours(6));
        trip.setStatus("SCHEDULED");
        trip = tripRepository.save(trip);

        // Một vé thật đi qua đúng luồng đặt vé, để phép thử không dựa vào dữ liệu bịa.
        BookingRequest request = new BookingRequest();
        request.setTripId(trip.getId());
        request.setSeatIds(Collections.singletonList(seat.getId()));
        request.setPassengerNames(Collections.singletonList("Nguyen Van A"));
        BookingResponse booking = bookingService.createBooking(user.getEmail(), request);
        ticketId = bookingRepository.findById(booking.getId()).orElseThrow()
                .getTickets().get(0).getId();
    }

    @Test
    @DisplayName("Xóa tuyến đường đang có chuyến: bị chặn, chuyến và vé còn nguyên")
    void deleteRouteBlockedWhenTripsExist() {
        Long routeId = route.getId();

        assertThatThrownBy(() -> adminService.deleteRoute(routeId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("chuyến");

        assertThat(tripRepository.existsById(trip.getId())).isTrue();
        assertThat(ticketRepository.existsById(ticketId)).isTrue();
    }

    @Test
    @DisplayName("Xóa phương tiện đang chạy chuyến: bị chặn, chuyến và vé còn nguyên")
    void deleteVehicleBlockedWhenTripsExist() {
        Long vehicleId = vehicle.getId();

        assertThatThrownBy(() -> adminService.deleteVehicle(vehicleId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("chuyến");

        assertThat(tripRepository.existsById(trip.getId())).isTrue();
        assertThat(ticketRepository.existsById(ticketId)).isTrue();
    }

    @Test
    @DisplayName("Xóa hãng đang có phương tiện: bị chặn, phương tiện và vé còn nguyên")
    void deleteProviderBlockedWhenVehiclesExist() {
        Long providerId = provider.getId();

        assertThatThrownBy(() -> adminService.deleteProvider(providerId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("phương tiện");

        assertThat(vehicleRepository.existsById(vehicle.getId())).isTrue();
        assertThat(ticketRepository.existsById(ticketId)).isTrue();
    }

    @Test
    @DisplayName("Xóa chuyến đã bán vé: bị chặn và chỉ đường sang chức năng hủy chuyến")
    void deleteTripBlockedWhenTicketsSold() {
        Long tripId = trip.getId();

        assertThatThrownBy(() -> adminService.deleteTrip(tripId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("hủy chuyến");

        assertThat(ticketRepository.existsById(ticketId)).isTrue();
    }

    @Test
    @DisplayName("Tuyến đường trống vẫn xóa được bình thường")
    void emptyRouteIsStillDeletable() {
        Route empty = new Route();
        empty.setOrigin("SGN");
        empty.setDestination("CXR");
        empty = routeRepository.save(empty);
        Long emptyId = empty.getId();

        adminService.deleteRoute(emptyId);

        assertThat(routeRepository.existsById(emptyId)).isFalse();
    }
}
