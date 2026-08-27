package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Payment;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PaymentRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Seeder này sinh dữ liệu để CHỮA ba khuyết tật của tập dữ liệu thử nghiệm: kỳ liền trước
 * rỗng nên không có gì để so sánh, đơn dồn hết vào một hai ngày nên biểu đồ diễn biến chỉ
 * còn một cột, và đơn nào cũng đúng một vé nên số vé luôn bằng số đơn.
 *
 * Test khoá lại đúng ba thứ đó — nếu sinh ra một tập dữ liệu vẫn mắc nguyên các khuyết tật
 * cũ thì seeder không có lý do tồn tại. Kèm theo là hai điều kiện an toàn: mặc định không
 * chạy, và đã có dữ liệu thì không sinh chồng.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DemoBookingSeederTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private AdditionalServiceRepository additionalServiceRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private DemoBookingSeeder seeder;

    private final List<Booking> saved = new ArrayList<>();
    private long nextBookingId = 1L;

    @BeforeEach
    void setUp() {
        nextBookingId = 1L;
        saved.clear();

        when(bookingRepository.countByBookingDateInRange(any(), any())).thenReturn(0L);
        when(tripRepository.findByVehicleTypeForSeeding(anyString(), any()))
                .thenAnswer(inv -> tripsOf(inv.getArgument(0)));
        when(seatRepository.findByVehicleId(anyLong())).thenAnswer(inv -> seatsOf(inv.getArgument(0)));
        when(ticketRepository.existsByTripIdAndSeatId(anyLong(), anyLong())).thenReturn(false);
        when(userRepository.findAll())
                .thenAnswer(inv -> List.of(customer(1L, "Khách A"), customer(2L, "Khách B")));
        when(additionalServiceRepository.findAll()).thenReturn(List.of(
                service(1L, "Hành lý ký gửi 20kg", 250_000),
                service(2L, "Bảo hiểm du lịch cơ bản", 49_000),
                service(3L, "Taxi đưa đón sân bay (Xanh SM)", 199_000)));

        // Hibernate gán khoá chính lên chính đối tượng được truyền vào khi INSERT với
        // GenerationType.IDENTITY, nên seeder đọc được booking.getId() ngay sau save.
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking booking = inv.getArgument(0);
            booking.setId(nextBookingId++);
            saved.add(booking);
            return booking;
        });
    }

    private void enable() {
        ReflectionTestUtils.setField(seeder, "enabled", true);
    }

    private void runSeeder() throws Exception {
        seeder.seedDemoBookings().run();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // An toàn
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Mặc định tắt: không có cờ thì không đụng gì vào cơ sở dữ liệu")
    void macDinhKhongChay() throws Exception {
        runSeeder();

        verify(bookingRepository, never()).save(any());
        verify(bookingRepository, never()).countByBookingDateInRange(any(), any());
    }

    @Test
    @DisplayName("Tháng liền trước đã đủ dày thì bỏ qua, khởi động lại bao nhiêu lần cũng không sinh chồng")
    void khongSinhChongLenDuLieuCoSan() throws Exception {
        enable();
        YearMonth current = YearMonth.from(LocalDate.now());
        when(bookingRepository.countByBookingDateInRange(
                eq(current.minusMonths(1).atDay(1).atStartOfDay()),
                eq(current.atDay(1).atStartOfDay()))).thenReturn(40L);

        runSeeder();

        verify(bookingRepository, never()).save(any());
    }

    /**
     * Đây là tình huống đã xảy ra thật trên bản deploy: tháng liền trước còn đúng 2 đơn sót
     * lại từ lúc phát triển, chốt chặn cũ ({@code > 0}) coi thế là xong việc và bỏ qua, nên
     * màn Thống kê doanh thu vẫn giữ nguyên biểu đồ hai cột dựng đứng và donut một màu —
     * đúng những khuyết tật seeder được viết ra để chữa.
     */
    @Test
    @DisplayName("Vài đơn lẻ sót lại KHÔNG chặn seeder: vẫn bù cho đủ dày")
    void vaiDonLeVanBuTiep() throws Exception {
        enable();
        YearMonth current = YearMonth.from(LocalDate.now());
        when(bookingRepository.countByBookingDateInRange(
                eq(current.minusMonths(1).atDay(1).atStartOfDay()),
                eq(current.atDay(1).atStartOfDay()))).thenReturn(2L);

        runSeeder();

        YearMonth previous = current.minusMonths(1);
        long sinhChoKyTruoc = savedBookings().stream()
                .filter(b -> YearMonth.from(b.getBookingDate()).equals(previous))
                .count();
        assertTrue(sinhChoKyTruoc > 0,
                "2 đơn sót lại không được phép làm seeder im lặng bỏ qua cả tháng");
    }

    @Test
    @DisplayName("Chưa có chuyến nào thì dừng sạch sẽ thay vì nổ lỗi lúc khởi động")
    void khongCoChuyenThiBoQua() throws Exception {
        enable();
        when(tripRepository.findByVehicleTypeForSeeding(anyString(), any())).thenReturn(List.of());

        runSeeder();

        verify(bookingRepository, never()).save(any());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ba khuyết tật mà seeder sinh ra để chữa
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Kỳ liền trước có dữ liệu, nên phần so sánh tăng trưởng không còn hiện dấu gạch")
    void lapDayKyLienTruoc() throws Exception {
        enable();
        runSeeder();

        YearMonth previous = YearMonth.from(LocalDate.now()).minusMonths(1);
        long inPrevious = savedBookings().stream()
                .filter(b -> YearMonth.from(b.getBookingDate()).equals(previous))
                .count();
        assertTrue(inPrevious >= 5, "Kỳ liền trước phải đủ đơn để so sánh, đang có " + inPrevious);
    }

    @Test
    @DisplayName("Đơn rải ra nhiều ngày, không dồn thành một cột dựng đứng giữa tháng phẳng")
    void raiDeuNgayTrongThang() throws Exception {
        enable();
        runSeeder();

        YearMonth current = YearMonth.from(LocalDate.now());
        Set<LocalDate> daysThisMonth = savedBookings().stream()
                .map(b -> b.getBookingDate().toLocalDate())
                .filter(d -> YearMonth.from(d).equals(current))
                .collect(Collectors.toSet());

        assertTrue(daysThisMonth.size() >= 5,
                "Phải rơi vào ít nhất 5 ngày khác nhau, đang là " + daysThisMonth.size());
    }

    @Test
    @DisplayName("Có đơn nhiều vé, nhờ đó số vé khác số đơn và lỗi nhân đôi doanh thu tái hiện được")
    void coDonNhieuVe() throws Exception {
        enable();
        runSeeder();

        List<Booking> bookings = savedBookings();
        long multiTicket = bookings.stream().filter(b -> b.getTickets().size() > 1).count();
        int totalTickets = bookings.stream().mapToInt(b -> b.getTickets().size()).sum();

        assertTrue(multiTicket > 0, "Phải có đơn từ 2 vé trở lên");
        assertTrue(totalTickets > bookings.size(), "Tổng số vé phải lớn hơn tổng số đơn");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dữ liệu sinh ra phải hợp lệ
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Không có đơn nào đặt ở tương lai — ngày mai chưa xảy ra thì chưa có doanh thu")
    void khongDatVeOTuongLai() throws Exception {
        enable();
        runSeeder();

        LocalDateTime endOfToday = LocalDate.now().plusDays(1).atStartOfDay();
        assertTrue(savedBookings().stream().allMatch(b -> b.getBookingDate().isBefore(endOfToday)),
                "Có đơn rơi vào ngày chưa tới");
    }

    @Test
    @DisplayName("Một ghế của một chuyến chỉ bán đúng một lần trong cả lượt sinh")
    void khongBanTrungGhe() throws Exception {
        enable();
        runSeeder();

        Set<String> seen = new HashSet<>();
        for (Booking booking : savedBookings()) {
            for (Ticket ticket : booking.getTickets()) {
                String key = ticket.getTrip().getId() + ":" + ticket.getSeat().getId();
                assertTrue(seen.add(key), "Ghế bị bán trùng: " + key);
            }
        }
    }

    @Test
    @DisplayName("Tổng tiền đơn luôn khớp tiền vé cộng tiền dịch vụ, trừ đi phần giảm giá")
    void tongTienKhopVoiVeVaDichVu() throws Exception {
        enable();
        runSeeder();

        for (Booking booking : savedBookings()) {
            BigDecimal tickets = booking.getTickets().stream()
                    .map(Ticket::getPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal services = booking.getAdditionalServices().stream()
                    .map(AdditionalService::getPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal gross = tickets.add(services);

            // Giảm giá theo hạng thành viên tối đa 15%, và không đơn nào được thu quá giá gốc.
            assertTrue(booking.getTotalPrice().compareTo(gross) <= 0,
                    "Thu nhiều hơn giá gốc: " + booking.getTotalPrice() + " > " + gross);
            assertTrue(booking.getTotalPrice().compareTo(gross.multiply(BigDecimal.valueOf(0.85))) >= 0,
                    "Giảm quá mức hạng cao nhất: " + booking.getTotalPrice() + " < 85% của " + gross);
        }
    }

    @Test
    @DisplayName("Mỗi đơn kèm đúng một dòng thanh toán thành công, khỏi thành đơn thủng ở màn đối soát")
    void moiDonCoMotDongThanhToan() throws Exception {
        enable();
        runSeeder();

        List<Booking> bookings = savedBookings();
        ArgumentCaptor<Payment> payments = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository, times(bookings.size())).save(payments.capture());

        for (Payment payment : payments.getAllValues()) {
            assertEquals("SUCCESS", payment.getPaymentStatus());
            assertFalse(payment.getTransactionRef().endsWith("null"), "Thiếu khoá chính đơn khi ghi thanh toán");
        }
    }

    @Test
    @DisplayName("Xe khách và tàu hoả không bán dịch vụ đưa đón sân bay")
    void khongBanDuaDonSanBayChoXeVaTau() throws Exception {
        enable();
        runSeeder();

        for (Booking booking : savedBookings()) {
            String mode = booking.getTickets().get(0).getTrip().getVehicle().getVehicleType();
            if ("PLANE".equals(mode)) {
                continue;
            }
            assertTrue(booking.getAdditionalServices().stream()
                            .noneMatch(s -> s.getServiceName().toLowerCase().contains("sân bay")),
                    "Đơn " + mode + " lại kèm dịch vụ đưa đón sân bay");
        }
    }

    @Test
    @DisplayName("Cùng một hạt giống thì sinh ra cùng một bộ số, để báo cáo và màn hình không lệch nhau")
    void ketQuaTaiLapDuoc() throws Exception {
        enable();
        runSeeder();
        List<String> first = fingerprint(savedBookings());

        // Dựng lại từ đầu y như một lần khởi động khác của ứng dụng.
        nextBookingId = 1L;
        DemoBookingSeeder other = new DemoBookingSeeder(bookingRepository, ticketRepository, tripRepository,
                seatRepository, userRepository, paymentRepository, additionalServiceRepository, passwordEncoder);
        ReflectionTestUtils.setField(other, "enabled", true);
        other.seedDemoBookings().run();

        List<Booking> all = savedBookings();
        List<String> second = fingerprint(all.subList(first.size(), all.size()));
        assertEquals(first, second, "Cùng hạt giống phải ra cùng dữ liệu");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Đồ nghề
    // ─────────────────────────────────────────────────────────────────────────

    private List<Booking> savedBookings() {
        return saved;
    }

    private static List<String> fingerprint(List<Booking> bookings) {
        return bookings.stream()
                .map(b -> b.getBookingDate() + "|" + b.getTotalPrice() + "|" + b.getTickets().size())
                .toList();
    }

    private static User customer(long id, String name) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        user.setEmail("khach" + id + "@example.com");
        user.setRole("ROLE_USER");
        user.setPoints(0);
        return user;
    }

    private static AdditionalService service(long id, String name, int price) {
        return new AdditionalService(id, name, BigDecimal.valueOf(price));
    }

    /** Ba chuyến mỗi loại, giá khác nhau để cơ cấu doanh thu không phẳng. */
    private static List<Trip> tripsOf(String vehicleType) {
        int basePrice = switch (vehicleType) {
            case "PLANE" -> 1_800_000;
            case "TRAIN" -> 700_000;
            default -> 350_000;
        };
        long baseId = switch (vehicleType) {
            case "PLANE" -> 100L;
            case "TRAIN" -> 200L;
            default -> 300L;
        };

        Provider provider = new Provider();
        provider.setId(baseId);
        provider.setProviderName(vehicleType + " Co.");

        List<Trip> trips = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Vehicle vehicle = new Vehicle();
            vehicle.setId(baseId + i);
            vehicle.setVehicleType(vehicleType);
            vehicle.setProvider(provider);

            Trip trip = new Trip();
            trip.setId(baseId + i);
            trip.setVehicle(vehicle);
            trip.setPrice(BigDecimal.valueOf(basePrice + i * 100_000L));
            trip.setDepartureTime(LocalDateTime.now().plusDays(i + 1L));
            trips.add(trip);
        }
        return trips;
    }

    /** 40 ghế phổ thông + 4 ghế hạng cao, để kiểm tra seeder có bỏ qua hạng cao thật không. */
    private static List<Seat> seatsOf(long vehicleId) {
        List<Seat> seats = new ArrayList<>();
        for (int i = 1; i <= 44; i++) {
            Seat seat = new Seat();
            seat.setId(vehicleId * 1000 + i);
            seat.setSeatNumber("S" + i);
            seat.setSeatType(i <= 4 ? "BUSINESS" : "ECONOMY");
            seats.add(seat);
        }
        return seats;
    }
}
