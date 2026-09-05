package com.booking.api.service;

import com.booking.api.dto.ProviderRevenueDTO;
import com.booking.api.dto.TripUpdateRequest;
import com.booking.api.entity.*;
import com.booking.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final RouteRepository routeRepository;
    private final VehicleRepository vehicleRepository;
    private final ProviderRepository providerRepository;
    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final TicketRepository ticketRepository;
    private final VoucherRepository voucherRepository;
    private final EmailService emailService;

    // ==================== ROUTE ====================

    @Transactional(readOnly = true)
    @Cacheable(value = "routes")
    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @Transactional
    @CacheEvict(value = "routes", allEntries = true)
    public Route createRoute(Route route) {
        return routeRepository.save(route);
    }

    @Transactional
    @CacheEvict(value = "routes", allEntries = true)
    public Route updateRoute(Long id, Route routeData) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tuyến đường với ID: " + id));
        route.setOrigin(routeData.getOrigin());
        route.setDestination(routeData.getDestination());
        return routeRepository.save(route);
    }

    @Transactional
    @CacheEvict(value = "routes", allEntries = true)
    public void deleteRoute(Long id) {
        if (!routeRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy tuyến đường với ID: " + id);
        }
        // Route.trips là cascade ALL + orphanRemoval, và Trip.tickets cũng vậy: xóa một tuyến
        // là xóa sạch chuyến của tuyến đó kèm mọi vé đã bán, im lặng và không hoàn tác được.
        long tripCount = tripRepository.countByRouteId(id);
        if (tripCount > 0) {
            throw new IllegalArgumentException(String.format(
                    "Không thể xóa tuyến đường này: đang có %d chuyến thuộc tuyến. "
                            + "Hãy xóa hoặc chuyển các chuyến đó trước khi xóa tuyến.", tripCount));
        }
        routeRepository.deleteById(id);
    }

    // ==================== PROVIDER ====================

    @Transactional(readOnly = true)
    public List<Provider> getAllProviders() {
        return providerRepository.findAll();
    }

    // Tên hãng và thông số xe nằm trong kết quả tìm chuyến đã cache (TripService: "trips" 5 phút,
    // "calendar_prices" 10 phút). Không dọn cache ở đây thì khách còn thấy tên hãng cũ, số ghế cũ
    // sau khi admin đã sửa — sửa xong nhìn không thấy đổi gì là bug rất khó tin là do cache.
    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Provider createProvider(Provider provider) {
        return providerRepository.save(provider);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Provider updateProvider(Long id, Provider providerData) {
        Provider provider = providerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhà cung cấp với ID: " + id));
        provider.setProviderName(providerData.getProviderName());
        provider.setProviderType(providerData.getProviderType());
        provider.setContactInfo(providerData.getContactInfo());
        return providerRepository.save(provider);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public void deleteProvider(Long id) {
        if (!providerRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy nhà cung cấp với ID: " + id);
        }
        // Provider.vehicles cascade xuống Vehicle.trips rồi Trip.tickets — xóa một hãng là cuốn
        // theo toàn bộ đội xe, lịch chạy và vé đã bán của hãng đó.
        long vehicleCount = vehicleRepository.countByProviderId(id);
        long voucherCount = voucherRepository.countByProviderId(id);
        if (vehicleCount > 0 || voucherCount > 0) {
            StringBuilder reason = new StringBuilder("Không thể xóa hãng này: đang có ");
            if (vehicleCount > 0) {
                reason.append(vehicleCount).append(" phương tiện");
            }
            if (vehicleCount > 0 && voucherCount > 0) {
                reason.append(" và ");
            }
            if (voucherCount > 0) {
                reason.append(voucherCount).append(" mã giảm giá");
            }
            reason.append(" gắn với hãng. Hãy gỡ những mục đó trước khi xóa hãng.");
            throw new IllegalArgumentException(reason.toString());
        }
        providerRepository.deleteById(id);
    }

    // ==================== VEHICLE ====================

    @Transactional(readOnly = true)
    public List<Vehicle> getAllVehicles() {
        return vehicleRepository.findAllWithProvider();
    }

    @Transactional(readOnly = true)
    public List<Vehicle> getVehiclesByProvider(Long providerId) {
        return vehicleRepository.findByProviderIdWithProvider(providerId);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Vehicle createVehicle(Vehicle vehicle) {
        return vehicleRepository.save(vehicle);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Vehicle updateVehicle(Long id, Vehicle vehicleData) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phương tiện với ID: " + id));
        vehicle.setVehicleType(vehicleData.getVehicleType());
        vehicle.setTotalSeats(vehicleData.getTotalSeats());
        if (vehicleData.getProvider() != null) {
            vehicle.setProvider(vehicleData.getProvider());
        }
        return vehicleRepository.save(vehicle);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public void deleteVehicle(Long id) {
        if (!vehicleRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy phương tiện với ID: " + id);
        }
        // Vehicle.trips cascade ALL: xóa xe là xóa luôn mọi chuyến nó đang chạy, kèm vé của khách.
        long tripCount = tripRepository.countByVehicleId(id);
        if (tripCount > 0) {
            throw new IllegalArgumentException(String.format(
                    "Không thể xóa phương tiện này: đang có %d chuyến sử dụng nó. "
                            + "Hãy xóa hoặc đổi phương tiện cho các chuyến đó trước.", tripCount));
        }
        vehicleRepository.deleteById(id);
    }

    // ==================== TRIP ====================

    @Transactional(readOnly = true)
    public Page<Trip> getPaginatedTrips(String vehicleType, String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (keyword != null && keyword.trim().isEmpty()) {
            keyword = null;
        }
        return tripRepository.searchTripsForAdmin(vehicleType, keyword, pageable);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Trip createTrip(Trip trip) {
        return tripRepository.save(trip);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Trip updateTrip(Long id, Trip tripData) {
        Trip trip = tripRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + id));

        if (tripData.getRoute() != null) {
            trip.setRoute(tripData.getRoute());
        }
        if (tripData.getVehicle() != null) {
            trip.setVehicle(tripData.getVehicle());
        }
        if (tripData.getDepartureTime() != null) {
            trip.setDepartureTime(tripData.getDepartureTime());
        }
        if (tripData.getArrivalTime() != null) {
            trip.setArrivalTime(tripData.getArrivalTime());
        }
        if (tripData.getPrice() != null) {
            trip.setPrice(tripData.getPrice());
        }
        if (tripData.getStatus() != null) {
            trip.setStatus(tripData.getStatus());
        }

        return tripRepository.save(trip);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Trip updateTripPrice(Long id, Double price) {
        Trip trip = tripRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + id));
        trip.setPrice(price != null ? java.math.BigDecimal.valueOf(price) : null);
        return tripRepository.save(trip);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public void deleteTrip(Long id) {
        if (!tripRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + id);
        }
        // Chuyến đã bán vé thì việc cần làm là HỦY (có hoàn tiền và báo cho khách), không phải xóa
        // — xóa chỉ làm vé bốc hơi khỏi CSDL còn tiền thì đã thu rồi. countByTripId chỉ tính vé
        // còn hiệu lực, nên chuyến mà mọi đơn đều đã hủy vẫn xóa được bình thường.
        long ticketCount = ticketRepository.countByTripId(id);
        if (ticketCount > 0) {
            throw new IllegalArgumentException(String.format(
                    "Không thể xóa chuyến này: đã có %d vé được đặt. "
                            + "Hãy dùng chức năng hủy chuyến để hoàn tiền và báo cho khách.", ticketCount));
        }
        tripRepository.deleteById(id);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Trip delayTrip(Long tripId, TripUpdateRequest request) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + tripId));

        String route = trip.getRoute().getOrigin() + " → " + trip.getRoute().getDestination();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
        String oldDeparture = trip.getDepartureTime() != null ? trip.getDepartureTime().format(fmt) : "N/A";

        if (request.getNewDepartureTime() != null) {
            trip.setDepartureTime(request.getNewDepartureTime());
        }
        if (request.getNewArrivalTime() != null) {
            trip.setArrivalTime(request.getNewArrivalTime());
        }
        trip.setStatus("DELAYED");
        tripRepository.save(trip);

        String newDeparture = trip.getDepartureTime() != null ? trip.getDepartureTime().format(fmt) : "N/A";
        String reason = request.getReason();

        // Gửi email cho tất cả hành khách
        List<Booking> bookings = bookingRepository.findActiveBookingsByTripId(tripId);
        for (Booking booking : bookings) {
            try {
                emailService.sendTripDelayEmail(booking.resolveNotificationEmail(), route, oldDeparture, newDeparture, reason);
            } catch (Exception e) {
                log.error("Failed to send delay email to {}", booking.getUser().getEmail(), e);
            }
        }

        log.info("Trip {} delayed. {} passengers notified.", tripId, bookings.size());
        return trip;
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public Trip cancelTripByAdmin(Long tripId, String reason) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + tripId));

        String route = trip.getRoute().getOrigin() + " → " + trip.getRoute().getDestination();
        trip.setStatus("CANCELLED");
        tripRepository.save(trip);

        // Hủy tất cả booking và hoàn tiền 100%, gửi email
        List<Booking> bookings = bookingRepository.findActiveBookingsByTripId(tripId);
        for (Booking booking : bookings) {
            java.math.BigDecimal refundAmount = booking.getTotalPrice() != null
                    ? booking.getTotalPrice() : java.math.BigDecimal.ZERO;

            Refund refund = new Refund();
            refund.setBooking(booking);
            refund.setRefundAmount(refundAmount);
            refund.setRefundDate(java.time.LocalDateTime.now());
            refund.setStatus("COMPLETED");

            if (booking.getRefunds() == null) {
                booking.setRefunds(new ArrayList<>());
            }
            booking.getRefunds().add(refund);
            booking.setStatus("CANCELLED");

            try {
                emailService.sendTripCancelledEmail(booking.resolveNotificationEmail(), booking.getId(), route, refundAmount.doubleValue());
            } catch (Exception e) {
                log.error("Failed to send cancel email to {}", booking.getUser().getEmail(), e);
            }
        }
        bookingRepository.saveAll(bookings);

        log.info("Trip {} cancelled by admin. {} bookings refunded.", tripId, bookings.size());
        return trip;
    }

    @Transactional(readOnly = true)
    public List<ProviderRevenueDTO> getProviderRevenue() {
        List<Provider> providers = providerRepository.findAll();
        List<ProviderRevenueDTO> result = new ArrayList<>();
        for (Provider p : providers) {
            Double revenueDouble = bookingRepository.calculateTotalRevenueByProvider(p.getId());
            java.math.BigDecimal revenue = revenueDouble != null
                    ? java.math.BigDecimal.valueOf(revenueDouble) : java.math.BigDecimal.ZERO;
            result.add(new ProviderRevenueDTO(p.getId(), p.getProviderName(), p.getProviderType(), revenue));
        }
        return result;
    }

    // ==================== USER MANAGEMENT ====================

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateUserRole(Long userId, String newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));
        user.setRole(newRole);
        return userRepository.save(user);
    }

    @Transactional
    public User toggleUserStatus(Long userId, Boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));
        user.setEnabled(enabled);
        // Xóa mã xác thực ở CẢ hai chiều, không chỉ khi kích hoạt.
        //
        // enabled = false mang hai nghĩa chồng nhau: "chưa xác thực email" và "bị khóa".
        // AuthService phân biệt chúng bằng chính verificationCode (còn mã = đang chờ xác
        // thực). Nếu khóa một tài khoản chưa xác thực mà để nguyên mã, tài khoản đó vẫn
        // nằm ở nhánh "chưa xác thực" — người bị khóa xin mã mới rồi tự kích hoạt lại.
        user.setVerificationCode(null);
        return userRepository.save(user);
    }
}
