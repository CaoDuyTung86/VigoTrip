package com.booking.api.integration;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VehicleRepository;
import com.booking.api.service.EmailService;
import com.booking.api.service.TripSupplyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bước tính lại giá chuyến chạy trên dữ liệu ĐÃ CÓ, nên nó là chỗ duy nhất trong nguồn cung
 * chuyến có thể làm hỏng thứ người khác đã mua. Test giả lập bằng mock không nói được gì về
 * điều đó: nguy cơ nằm ở tầng JPA, không nằm ở tầng logic.
 *
 * <p>Cụ thể là {@code Trip.tickets} đang để cascade ALL kèm orphanRemoval. Ghi lại một chuyến
 * bằng đường merge trên entity đã tách có thể kéo theo việc xoá vé đã bán của chuyến đó — mất
 * vé của khách, và mất luôn dòng doanh thu tương ứng. Vì vậy bước tính lại sửa thẳng trên
 * entity đang được quản lý rồi flush. Chỉ có chạy trên một cơ sở dữ liệu thật mới chứng minh
 * được là nó làm đúng như thế.
 */
@SpringBootTest
@ActiveProfiles("test")
class TripRealignIntegrationTest {

    @Autowired private TripSupplyService tripSupplyService;
    @Autowired private ProviderRepository providerRepository;
    @Autowired private RouteRepository routeRepository;
    @Autowired private VehicleRepository vehicleRepository;
    @Autowired private SeatRepository seatRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TripRepository tripRepository;

    @MockitoBean private EmailService emailService;

    /** Giá và giờ chạy kiểu bản cũ: xe khách Hà Nội - Sài Gòn chạy 5 tiếng với giá một bậc cố định. */
    private static final BigDecimal GIA_CU = BigDecimal.valueOf(350_000);
    private static final int GIO_CHAY_CU = 5;

    private Route route;
    private Vehicle vehicle;
    private Seat seat;
    private User user;

    @BeforeEach
    void setUp() {
        Provider provider = new Provider();
        provider.setProviderName("Nhà xe kiểm thử " + UUID.randomUUID());
        provider.setProviderType("BUS");
        provider.setContactInfo("test@example.com");
        provider = providerRepository.save(provider);

        route = new Route();
        route.setOrigin("HAN");
        route.setDestination("SGN");
        route = routeRepository.save(route);

        vehicle = new Vehicle();
        vehicle.setProvider(provider);
        vehicle.setVehicleType("BUS");
        vehicle.setTotalSeats(40);
        vehicle = vehicleRepository.save(vehicle);

        seat = new Seat();
        seat.setVehicle(vehicle);
        seat.setSeatNumber("A1");
        seat.setSeatType("STANDARD");
        seat = seatRepository.save(seat);

        user = new User();
        user.setEmail("realign-" + UUID.randomUUID() + "@example.com");
        user.setFullName("Khách kiểm thử");
        user.setRole("USER");
        user.setEnabled(true);
        user = userRepository.save(user);
    }

    @Test
    @DisplayName("Tính lại ghi được xuống CSDL, và vé đã bán vẫn còn nguyên")
    void tinhLaiGhiXuongDbVaGiuNguyenVe() {
        Trip trip = luuChuyen(LocalDateTime.now().plusDays(2).withHour(8).withMinute(0));
        Ticket ticket = luuVeCho(trip);

        tripSupplyService.realignFutureTrips();

        Trip sauKhiTinhLai = tripRepository.findById(trip.getId()).orElseThrow();
        double gioChay = Duration.between(sauKhiTinhLai.getDepartureTime(),
                sauKhiTinhLai.getArrivalTime()).toMinutes() / 60.0;

        assertThat(gioChay)
                .as("Xe khách Bắc - Nam phải hơn một ngày đường")
                .isGreaterThan(24);
        assertThat(sauKhiTinhLai.getPrice())
                .as("Giá phải được tính lại theo cự ly thật")
                .isNotEqualByComparingTo(GIA_CU);

        assertThat(ticketRepository.findById(ticket.getId()))
                .as("Tính lại giá chuyến không được phép xoá vé đã bán")
                .isPresent();
        assertThat(ticketRepository.findById(ticket.getId()).orElseThrow().getPrice())
                .as("Vé giữ số tiền tại thời điểm đặt, không chạy theo giá chuyến")
                .isEqualByComparingTo(GIA_CU);
    }

    @Test
    @DisplayName("Chuyến đã chạy thì không bị đụng tới")
    void chuyenDaChayKhongBiDungToi() {
        Trip daChay = luuChuyen(LocalDateTime.now().minusDays(2).withHour(8).withMinute(0));

        tripSupplyService.realignFutureTrips();

        Trip sauKhiTinhLai = tripRepository.findById(daChay.getId()).orElseThrow();
        assertThat(sauKhiTinhLai.getPrice())
                .as("Quá khứ là dữ liệu doanh thu, sửa vào đó là sửa sổ sách")
                .isEqualByComparingTo(GIA_CU);
        assertThat(sauKhiTinhLai.getArrivalTime())
                .isEqualTo(daChay.getDepartureTime().plusHours(GIO_CHAY_CU));
    }

    @Test
    @DisplayName("Chạy lần hai không sửa thêm chuyến nào của bộ dữ liệu này")
    void chayLanHaiKhongSuaThem() {
        luuChuyen(LocalDateTime.now().plusDays(2).withHour(8).withMinute(0));

        tripSupplyService.realignFutureTrips();
        int lanHai = tripSupplyService.realignFutureTrips();

        assertThat(lanHai)
                .as("Mô hình tất định nên lượt chạy sau không còn gì để sửa")
                .isZero();
    }

    private Trip luuChuyen(LocalDateTime departure) {
        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicle(vehicle);
        trip.setDepartureTime(departure.withSecond(0).withNano(0));
        trip.setArrivalTime(departure.withSecond(0).withNano(0).plusHours(GIO_CHAY_CU));
        trip.setPrice(GIA_CU);
        trip.setStatus("ACTIVE");
        return tripRepository.save(trip);
    }

    private Ticket luuVeCho(Trip trip) {
        Booking booking = new Booking();
        booking.setUser(user);
        booking.setBookingDate(LocalDateTime.now());
        booking.setTotalPrice(GIA_CU);
        booking.setStatus("CONFIRMED");
        booking = bookingRepository.save(booking);

        Ticket ticket = new Ticket();
        ticket.setBooking(booking);
        ticket.setTrip(trip);
        ticket.setSeat(seat);
        ticket.setPrice(GIA_CU);
        ticket.setPassengerName("Khách kiểm thử");
        ticket.setStatus("ACTIVE");
        return ticketRepository.save(ticket);
    }
}
