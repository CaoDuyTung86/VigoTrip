package com.booking.api.integration;

import com.booking.api.dto.BookingRequest;
import com.booking.api.entity.*;
import com.booking.api.realtime.SeatStatusBroadcaster;
import com.booking.api.repository.*;
import com.booking.api.service.BookingService;
import com.booking.api.service.EmailService;
import com.booking.api.service.SeatLockService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Khoá lại bất biến quan trọng nhất của hệ thống đặt vé: <b>một ghế trên một chuyến không
 * bao giờ ra hai vé</b> — kể cả khi lớp giữ ghế thời gian thực biến mất hoàn toàn.
 *
 * <p>Chống đặt trùng vé được dựng thành ba lớp:
 * <pre>
 *   Lớp 1  SeatLockService  lock tạm trong bộ nhớ, phát qua WebSocket
 *   Lớp 2  SeatRepository.findByIdWithLock (PESSIMISTIC_WRITE) + existsByTripIdAndSeatId
 *   Lớp 3  BookingRepository.findByIdForUpdate — chống xác nhận thanh toán trùng
 * </pre>
 *
 * <p>Lớp 1 nằm trong bộ nhớ của một tiến trình, nên nó <i>sẽ</i> biến mất trong đời thật:
 * Render gói miễn phí ngủ khi vắng request rồi khởi động lại, và nếu chạy hai instance thì
 * mỗi instance có một bảng lock riêng. Lớp học kỹ thuật ở đây là: <b>tính đúng đắn không
 * được đặt ở lớp có thể biến mất</b>.
 *
 * <p>Test vô hiệu hoá lớp 1 hoàn toàn ({@code @MockitoBean SeatLockService} — mọi ghế đều
 * trông như đang trống) rồi cho hai luồng cùng đặt đúng một ghế. Chỉ một luồng được qua, và
 * cuối cùng CSDL có đúng một vé. Đây là bằng chứng cho tuyên bố "mất sạch lock tạm thì hậu
 * quả tệ nhất là một người bị từ chối ở bước tạo đơn, không có vé trùng".
 *
 * <p>Cố ý KHÔNG dùng {@code @Transactional}: hai luồng phải chạy trong hai giao dịch thật
 * thì khoá bi quan mới có ý nghĩa. Dọn dẹp bằng tay ở {@link #tearDown()}.
 */
@SpringBootTest
@ActiveProfiles("test")
class SeatDoubleBookingIntegrationTest {

    private static final int SO_LUONG_LUONG = 2;
    private static final int TIMEOUT_SECONDS = 20;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TripRepository tripRepository;
    @Autowired
    private SeatRepository seatRepository;
    @Autowired
    private VehicleRepository vehicleRepository;
    @Autowired
    private ProviderRepository providerRepository;
    @Autowired
    private RouteRepository routeRepository;
    @Autowired
    private BookingRepository bookingRepository;
    @Autowired
    private TicketRepository ticketRepository;

    @MockitoBean
    private EmailService emailService;

    /** Không dựng broker trong test; phần phát tin đã có test riêng. */
    @MockitoBean
    private SeatStatusBroadcaster seatStatusBroadcaster;

    /**
     * LỚP 1 BỊ VÔ HIỆU HOÀN TOÀN. Mock mặc định trả false cho {@code isHeldByOther}, tức
     * mọi ghế đều trông như chưa ai giữ — đúng trạng thái sau khi backend restart, hoặc khi
     * hai instance mỗi bên nhìn thấy một bảng lock khác nhau.
     */
    @MockitoBean
    private SeatLockService seatLockService;

    private User nguoiDungA;
    private User nguoiDungB;
    private Trip chuyen;
    private Seat gheTranhChap;

    @BeforeEach
    void setUp() {
        nguoiDungA = taoNguoiDung("dat.trung.a@example.com");
        nguoiDungB = taoNguoiDung("dat.trung.b@example.com");

        Provider provider = new Provider();
        provider.setProviderName("Nha Xe Kiem Thu Dat Trung");
        provider.setProviderType("BUS");
        provider = providerRepository.save(provider);

        Vehicle vehicle = new Vehicle();
        vehicle.setProvider(provider);
        vehicle.setVehicleType("BUS");
        vehicle.setTotalSeats(30);
        vehicle = vehicleRepository.save(vehicle);

        Seat seat = new Seat();
        seat.setVehicle(vehicle);
        seat.setSeatNumber("B01");
        seat.setSeatType("NORMAL");
        gheTranhChap = seatRepository.save(seat);

        Route route = new Route();
        route.setOrigin("Ha Noi");
        route.setDestination("Hai Phong");
        route = routeRepository.save(route);

        Trip trip = new Trip();
        trip.setVehicle(vehicle);
        trip.setRoute(route);
        trip.setPrice(java.math.BigDecimal.valueOf(120000));
        trip.setDepartureTime(LocalDateTime.now().plusDays(3));
        trip.setArrivalTime(LocalDateTime.now().plusDays(3).plusHours(2));
        trip.setStatus("SCHEDULED");
        chuyen = tripRepository.save(trip);
    }

    @AfterEach
    void tearDown() {
        // Không có @Transactional nên phải tự dọn: vé -> đơn -> người dùng. Chuyến, xe và
        // tuyến để lại cũng vô hại vì mỗi lớp test dùng CSDL H2 create-drop riêng.
        ticketRepository.deleteAll();
        bookingRepository.deleteAll();
        userRepository.deleteAll(List.of(nguoiDungA, nguoiDungB));
    }

    @Test
    @DisplayName("Hai luồng cùng đặt một ghế: chỉ một đơn thành công, dù lock tạm đã mất sạch")
    void datTrungGhe_ChiMotDonThanhCong_KhiKhongCoLockTam() throws Exception {
        CountDownLatch vachXuatPhat = new CountDownLatch(1);
        CountDownLatch xong = new CountDownLatch(SO_LUONG_LUONG);
        AtomicInteger thanhCong = new AtomicInteger();
        AtomicInteger thatBai = new AtomicInteger();

        ExecutorService pool = Executors.newFixedThreadPool(SO_LUONG_LUONG);
        try {
            for (User nguoiDat : List.of(nguoiDungA, nguoiDungB)) {
                pool.submit(() -> {
                    try {
                        // Cùng vạch xuất phát để hai giao dịch thật sự chồng lên nhau,
                        // thay vì luồng sau chạy khi luồng trước đã commit xong.
                        vachXuatPhat.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                        bookingService.createBooking(nguoiDat.getEmail(), yeuCauDatGhe());
                        thanhCong.incrementAndGet();
                    } catch (Exception e) {
                        thatBai.incrementAndGet();
                    } finally {
                        xong.countDown();
                    }
                });
            }

            vachXuatPhat.countDown();
            assertTrue(xong.await(TIMEOUT_SECONDS, TimeUnit.SECONDS), "hai luồng phải kết thúc trong hạn");
        } finally {
            pool.shutdownNow();
        }

        assertEquals(1, thanhCong.get(), "đúng một luồng được tạo đơn");
        assertEquals(1, thatBai.get(), "luồng còn lại phải bị từ chối");

        // Bằng chứng cuối cùng nằm ở CSDL, không phải ở số đếm trong bộ nhớ.
        long soVe = ticketRepository.findAll().stream()
                .filter(ve -> ve.getTrip() != null && ve.getSeat() != null)
                .filter(ve -> ve.getTrip().getId().equals(chuyen.getId()))
                .filter(ve -> ve.getSeat().getId().equals(gheTranhChap.getId()))
                .count();
        assertEquals(1, soVe, "một ghế trên một chuyến chỉ được ra đúng một vé");
    }

    @Test
    @DisplayName("Đặt lại ghế đã có vé thì bị từ chối, không cần tới lock tạm")
    void datLaiGheDaCoVe_BiTuChoi() {
        bookingService.createBooking(nguoiDungA.getEmail(), yeuCauDatGhe());

        // Phiên bản tất định của test trên: chốt chặn là existsByTripIdAndSeatId đọc trong
        // cùng giao dịch đã giữ khoá bi quan trên dòng ghế, không phải lock tạm.
        Exception ex = assertThrows(Exception.class,
                () -> bookingService.createBooking(nguoiDungB.getEmail(), yeuCauDatGhe()));
        assertTrue(ex.getMessage().contains("đã được đặt"), "thông báo phải nói rõ ghế đã có vé: " + ex.getMessage());
    }

    private BookingRequest yeuCauDatGhe() {
        BookingRequest request = new BookingRequest();
        request.setTripId(chuyen.getId());
        request.setSeatIds(List.of(gheTranhChap.getId()));
        request.setPassengerNames(List.of("Nguyen Van A"));
        return request;
    }

    private User taoNguoiDung(String email) {
        User user = new User();
        user.setEmail(email);
        user.setFullName("Nguoi Dat " + email);
        user.setPassword("password123");
        user.setRole("ROLE_USER");
        user.setPoints(0);
        return userRepository.save(user);
    }
}
