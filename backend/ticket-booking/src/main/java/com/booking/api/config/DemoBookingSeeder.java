package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Payment;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PaymentRepository;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Sinh lịch sử đặt vé cho hai kỳ gần nhất, phục vụ demo màn hình BI.
 *
 * Dữ liệu thử nghiệm tích luỹ trong lúc phát triển không mang hình dạng của dữ liệu thật,
 * và ba chỗ lệch dưới đây làm hỏng đúng những thứ màn Thống kê doanh thu muốn cho xem:
 *
 * <ol>
 *   <li><b>Kỳ liền trước rỗng.</b> Tháng trước không có đơn nào thì mọi ô tăng trưởng đều
 *       hiện "—" và phần nhận định AI buộc phải viết "không so sánh được" — toàn bộ phần
 *       so sánh kỳ coi như tàng hình.</li>
 *   <li><b>Đơn dồn vào một hai ngày.</b> Biểu đồ diễn biến thành một cột dựng đứng giữa
 *       một tháng phẳng lì, trông giống biểu đồ hỏng hơn là giống mùa vụ.</li>
 *   <li><b>Đơn nào cũng đúng một vé.</b> Số vé luôn bằng số đơn nên hai chỉ số đó thành
 *       một, và lỗi nhân đôi doanh thu khi JOIN sang bảng vé không thể tái hiện được: đơn
 *       một vé thì cộng một lần hay ba lần cũng ra cùng kết quả.</li>
 * </ol>
 *
 * <p><b>Mặc định TẮT.</b> Bật bằng {@code DEMO_SEED_BOOKINGS=true}. Đây là dữ liệu bịa,
 * không được để nó tự chạy trên môi trường thật chỉ vì ai đó quên một biến môi trường.
 *
 * <p><b>Chạy đúng một lần.</b> Chốt chặn là "tháng liền trước đã có đơn nào chưa" chứ không
 * phải một cờ lưu riêng: seeder tồn tại để lấp đúng khoảng trống đó, nên khoảng trống được
 * lấp rồi cũng chính là dấu hiệu nó đã chạy. Container khởi động lại bao nhiêu lần cũng
 * không sinh chồng.
 *
 * <p>Mọi con số đều đi qua đúng công thức mà {@link com.booking.api.service.BookingService}
 * dùng cho đơn thật — tiền vé, tiền dịch vụ, giảm giá theo điểm tích luỹ — nên tập dữ liệu
 * này không sống theo một bộ luật riêng.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class DemoBookingSeeder {

    /**
     * Hạt giống cố định, KHÔNG đổi.
     *
     * Chạy lại trên một cơ sở dữ liệu mới phải ra đúng bộ số cũ; đổi hạt giống là mọi con
     * số đã chụp vào báo cáo hay slide sẽ khác với con số đang chiếu trên màn hình.
     */
    private static final long RANDOM_SEED = 20260827L;

    private static final int BOOKINGS_PREVIOUS_MONTH = 9;
    private static final int BOOKINGS_CURRENT_MONTH = 12;

    /** Số chuyến bốc về mỗi loại phương tiện để làm nguồn gắn vé. */
    private static final int TRIP_POOL_SIZE = 80;

    /**
     * Tỷ lệ đơn theo loại phương tiện, khai bằng số lần lặp cho dễ chỉnh.
     *
     * Máy bay nhiều hơn để cơ cấu doanh thu giống thị trường thật: giá vé máy bay gấp nhiều
     * lần vé xe và vé tàu, nên chỉ cần nhỉnh hơn về số đơn là đã áp đảo về tiền.
     */
    private static final String[] MODE_DRAW = {
            "PLANE", "PLANE", "PLANE", "PLANE",
            "TRAIN", "TRAIN", "TRAIN",
            "BUS", "BUS", "BUS",
    };

    /** Phần lớn đơn một vé, còn lại là đơn gia đình 2-3 vé. */
    private static final int[] TICKETS_DRAW = { 1, 1, 1, 1, 2, 2, 3 };

    /** Số dịch vụ bổ sung mỗi đơn. Phải có cả số 0, nếu không tiền dịch vụ sẽ phình vô lý. */
    private static final int[] SERVICES_DRAW = { 0, 0, 0, 0, 1, 1, 1, 2 };

    /** Khách đi xe khách và tàu hoả không mua đưa đón sân bay. */
    private static final String AIRPORT_ONLY_SERVICE = "sân bay";

    private static final String[] DEMO_CUSTOMER_NAMES = {
            "Nguyễn Minh Anh", "Trần Quốc Bảo", "Lê Thị Cẩm Tú", "Phạm Hoàng Duy",
    };

    private final BookingRepository bookingRepository;
    private final TicketRepository ticketRepository;
    private final TripRepository tripRepository;
    private final SeatRepository seatRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final AdditionalServiceRepository additionalServiceRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo.seed-bookings:false}")
    private boolean enabled;

    @Bean
    @Order(4)
    CommandLineRunner seedDemoBookings() {
        return args -> {
            if (!enabled) {
                return;
            }

            YearMonth current = YearMonth.from(LocalDate.now());
            YearMonth previous = current.minusMonths(1);

            long alreadyThere = bookingRepository.countByBookingDateInRange(
                    previous.atDay(1).atStartOfDay(), current.atDay(1).atStartOfDay());
            if (alreadyThere > 0) {
                log.info("[DemoBookingSeeder] {} đã có {} đơn, bỏ qua để không sinh chồng.",
                        previous, alreadyThere);
                return;
            }

            Map<String, List<Trip>> tripPools = loadTripPools();
            if (tripPools.isEmpty()) {
                log.warn("[DemoBookingSeeder] Chưa có chuyến nào để gắn vé — TripSupplyService "
                        + "phải chạy xong trước. Bỏ qua lần này.");
                return;
            }

            List<User> customers = resolveCustomers();
            if (customers.isEmpty()) {
                log.warn("[DemoBookingSeeder] Không có tài khoản khách nào để đứng tên đơn, bỏ qua.");
                return;
            }

            List<AdditionalService> catalog = additionalServiceRepository.findAll();
            Random random = new Random(RANDOM_SEED);
            Map<Long, List<Seat>> seatCache = new HashMap<>();
            Set<String> seatsTakenInRun = new HashSet<>();

            int created = seedMonth(previous, BOOKINGS_PREVIOUS_MONTH,
                    tripPools, customers, catalog, random, seatCache, seatsTakenInRun);
            created += seedMonth(current, BOOKINGS_CURRENT_MONTH,
                    tripPools, customers, catalog, random, seatCache, seatsTakenInRun);

            log.info("[DemoBookingSeeder] Đã sinh {} đơn demo cho {} và {}.", created, previous, current);
        };
    }

    /**
     * Sinh đơn cho một tháng, rải đều ngày.
     *
     * Ngày đặt tính bằng cách chia đều cửa sổ rồi xê dịch ngẫu nhiên trong biên hẹp, chứ
     * không bốc ngẫu nhiên hoàn toàn: bốc thuần ngẫu nhiên với chỉ hơn chục điểm thì rất
     * hay dồn cục — mà dồn cục đúng là cái hình dạng seeder này sinh ra để tránh.
     *
     * <p>Tháng đang chạy dở thì cắt cửa sổ ở hôm nay: một đơn "đặt" vào ngày mai vừa vô lý
     * vừa đội doanh thu của một ngày chưa xảy ra.
     */
    private int seedMonth(YearMonth month, int count,
                          Map<String, List<Trip>> tripPools, List<User> customers,
                          List<AdditionalService> catalog, Random random,
                          Map<Long, List<Seat>> seatCache, Set<String> seatsTakenInRun) {
        LocalDate today = LocalDate.now();
        int lastDay = month.equals(YearMonth.from(today))
                ? Math.min(today.getDayOfMonth(), month.lengthOfMonth())
                : month.lengthOfMonth();
        if (lastDay < 1) {
            return 0;
        }

        int created = 0;
        for (int i = 0; i < count; i++) {
            int spread = 1 + (int) ((i + 0.5) * lastDay / count);
            int day = clamp(spread + random.nextInt(5) - 2, 1, lastDay);
            LocalDateTime bookedAt = month.atDay(day)
                    .atTime(7 + random.nextInt(15), random.nextInt(60));

            if (seedOneBooking(bookedAt, tripPools, customers, catalog, random, seatCache, seatsTakenInRun)) {
                created++;
            }
        }
        return created;
    }

    /** @return false nếu chuyến bốc trúng không còn ghế phổ thông trống, đơn đó bị bỏ qua. */
    private boolean seedOneBooking(LocalDateTime bookedAt,
                                   Map<String, List<Trip>> tripPools, List<User> customers,
                                   List<AdditionalService> catalog, Random random,
                                   Map<Long, List<Seat>> seatCache, Set<String> seatsTakenInRun) {
        String mode = pickMode(tripPools, random);
        List<Trip> pool = tripPools.get(mode);
        Trip trip = pool.get(random.nextInt(pool.size()));
        if (trip.getPrice() == null || trip.getVehicle() == null) {
            return false;
        }

        int wanted = TICKETS_DRAW[random.nextInt(TICKETS_DRAW.length)];
        List<Seat> seats = pickFreeSeats(trip, wanted, seatCache, seatsTakenInRun);
        if (seats.isEmpty()) {
            return false;
        }

        User user = customers.get(random.nextInt(customers.size()));

        List<Ticket> tickets = new ArrayList<>(seats.size());
        BigDecimal ticketTotal = BigDecimal.ZERO;
        for (Seat seat : seats) {
            Ticket ticket = new Ticket();
            ticket.setTrip(trip);
            ticket.setSeat(seat);
            ticket.setPrice(trip.getPrice());
            ticket.setPassengerName(user.getFullName());
            ticket.setStatus("ACTIVE");
            tickets.add(ticket);
            ticketTotal = ticketTotal.add(trip.getPrice());
        }

        List<AdditionalService> services = pickServices(mode, catalog, random);
        BigDecimal serviceTotal = services.stream()
                .map(s -> s.getPrice() != null ? s.getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Giảm giá theo hạng thành viên dùng lại đúng bảng của BookingService thay vì chép
        // sang đây một bảng thứ hai — chép ra là sớm muộn hai bảng cũng lệch nhau.
        BigDecimal gross = ticketTotal.add(serviceTotal);
        double discountPercent = UserService.getDiscount(user.getPoints() != null ? user.getPoints() : 0);
        BigDecimal total = gross;
        if (discountPercent > 0) {
            BigDecimal discount = gross.multiply(BigDecimal.valueOf(discountPercent / 100.0))
                    .setScale(2, RoundingMode.HALF_UP);
            total = gross.subtract(discount);
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setBookingDate(bookedAt);
        booking.setStatus("CONFIRMED");
        booking.setTotalPrice(total);
        booking.setAdditionalServices(services);
        booking.setIsCheckedIn(false);
        for (Ticket ticket : tickets) {
            ticket.setBooking(booking);
        }
        booking.setTickets(tickets);
        bookingRepository.save(booking);

        // Đơn CONFIRMED mà không có dòng thanh toán nào sẽ hiện ra như đơn thủng ở màn quản
        // lý thanh toán và ở phần đối soát hoàn tiền, nên ghi kèm luôn.
        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setPaymentMethod("VNPAY");
        payment.setPaymentDate(bookedAt.plusMinutes(2));
        payment.setAmount(total);
        payment.setPaymentStatus("SUCCESS");
        payment.setTransactionRef("DEMO" + booking.getId());
        paymentRepository.save(payment);

        awardPoints(user, total);
        return true;
    }

    /**
     * Tích điểm y như luồng thanh toán thật, và phải làm ngay sau từng đơn.
     *
     * Sinh đơn theo đúng thứ tự thời gian rồi cộng điểm dần khiến các đơn về sau tự nhiên
     * rơi vào hạng có giảm giá. Đó là cách duy nhất để phần "giảm giá & voucher" trên thanh
     * đối soát có số thật, thay vì bịa ra một khoản giảm giá không nguồn gốc.
     */
    private void awardPoints(User user, BigDecimal total) {
        int earned = total.divide(BigDecimal.valueOf(10000), 0, RoundingMode.DOWN).intValue();
        user.setPoints((user.getPoints() != null ? user.getPoints() : 0) + earned);
        userRepository.save(user);
    }

    /** Bốc loại phương tiện theo tỷ lệ, nhưng chỉ trong những loại thực sự có chuyến. */
    private String pickMode(Map<String, List<Trip>> tripPools, Random random) {
        for (int attempt = 0; attempt < MODE_DRAW.length; attempt++) {
            String mode = MODE_DRAW[random.nextInt(MODE_DRAW.length)];
            if (tripPools.containsKey(mode)) {
                return mode;
            }
        }
        return tripPools.keySet().iterator().next();
    }

    /**
     * Chỉ lấy ghế hạng phổ thông.
     *
     * Ghế BUSINESS/VIP/SLEEPER có bảng phụ thu riêng nằm trong BookingService; chép lại vào
     * đây là dựng thêm một chỗ nữa để sai. Bỏ qua chúng thì giá vé seed ra luôn đúng bằng
     * giá chuyến, khỏi cần biết tới bảng phụ thu nào.
     */
    private List<Seat> pickFreeSeats(Trip trip, int wanted,
                                     Map<Long, List<Seat>> seatCache, Set<String> seatsTakenInRun) {
        List<Seat> seats = seatCache.computeIfAbsent(trip.getVehicle().getId(),
                vehicleId -> seatRepository.findByVehicleId(vehicleId).stream()
                        .filter(seat -> "ECONOMY".equalsIgnoreCase(seat.getSeatType()))
                        .toList());

        List<Seat> chosen = new ArrayList<>(wanted);
        for (Seat seat : seats) {
            if (chosen.size() == wanted) {
                break;
            }
            String key = trip.getId() + ":" + seat.getId();
            if (seatsTakenInRun.contains(key)
                    || ticketRepository.existsByTripIdAndSeatId(trip.getId(), seat.getId())) {
                continue;
            }
            seatsTakenInRun.add(key);
            chosen.add(seat);
        }
        return chosen;
    }

    private List<AdditionalService> pickServices(String mode, List<AdditionalService> catalog, Random random) {
        if (catalog.isEmpty()) {
            return List.of();
        }
        List<AdditionalService> allowed = "PLANE".equals(mode)
                ? catalog
                : catalog.stream()
                        .filter(s -> s.getServiceName() == null
                                || !s.getServiceName().toLowerCase().contains(AIRPORT_ONLY_SERVICE))
                        .toList();
        if (allowed.isEmpty()) {
            return List.of();
        }

        int wanted = Math.min(SERVICES_DRAW[random.nextInt(SERVICES_DRAW.length)], allowed.size());
        List<AdditionalService> chosen = new ArrayList<>(wanted);
        while (chosen.size() < wanted) {
            AdditionalService candidate = allowed.get(random.nextInt(allowed.size()));
            // Cùng một dịch vụ hai lần trong một đơn sẽ đụng khoá của bảng nối dat_ve_dich_vu.
            if (chosen.stream().noneMatch(s -> s.getId().equals(candidate.getId()))) {
                chosen.add(candidate);
            }
        }
        return chosen;
    }

    private Map<String, List<Trip>> loadTripPools() {
        Map<String, List<Trip>> pools = new LinkedHashMap<>();
        for (String mode : new String[] { "PLANE", "TRAIN", "BUS" }) {
            List<Trip> trips = tripRepository.findByVehicleTypeForSeeding(mode, PageRequest.of(0, TRIP_POOL_SIZE));
            if (!trips.isEmpty()) {
                pools.put(mode, trips);
            }
        }
        return pools;
    }

    /**
     * Tài khoản đứng tên các đơn demo.
     *
     * Ưu tiên dùng lại khách đã có sẵn, chỉ tạo mới khi cơ sở dữ liệu chưa có ai — để không
     * đẻ thêm tài khoản rác lên môi trường vốn đã có người dùng thật. Tài khoản tạo mới nhận
     * mật khẩu ngẫu nhiên không ai biết: chúng chỉ để đứng tên đơn chứ không phải để đăng
     * nhập, nên không được trở thành một cửa vào hệ thống.
     */
    private List<User> resolveCustomers() {
        List<User> existing = userRepository.findAll().stream()
                .filter(u -> "ROLE_USER".equals(u.getRole()))
                .limit(8)
                .toList();
        if (!existing.isEmpty()) {
            return existing;
        }

        List<User> created = new ArrayList<>(DEMO_CUSTOMER_NAMES.length);
        for (int i = 0; i < DEMO_CUSTOMER_NAMES.length; i++) {
            User user = new User();
            user.setFullName(DEMO_CUSTOMER_NAMES[i]);
            user.setEmail("khach.demo" + (i + 1) + "@vigotrip.local");
            user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
            user.setRole("ROLE_USER");
            user.setEnabled(true);
            user.setPoints(0);
            created.add(userRepository.save(user));
        }
        log.info("[DemoBookingSeeder] Đã tạo {} tài khoản khách demo để đứng tên đơn.", created.size());
        return created;
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
