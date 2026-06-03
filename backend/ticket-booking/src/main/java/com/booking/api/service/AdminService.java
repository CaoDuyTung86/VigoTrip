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
        routeRepository.deleteById(id);
    }

    // ==================== PROVIDER ====================

    @Transactional(readOnly = true)
    public List<Provider> getAllProviders() {
        return providerRepository.findAll();
    }

    @Transactional
    public Provider createProvider(Provider provider) {
        return providerRepository.save(provider);
    }

    @Transactional
    public Provider updateProvider(Long id, Provider providerData) {
        Provider provider = providerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhà cung cấp với ID: " + id));
        provider.setProviderName(providerData.getProviderName());
        provider.setProviderType(providerData.getProviderType());
        provider.setContactInfo(providerData.getContactInfo());
        return providerRepository.save(provider);
    }

    @Transactional
    public void deleteProvider(Long id) {
        if (!providerRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy nhà cung cấp với ID: " + id);
        }
        providerRepository.deleteById(id);
    }

    // ==================== VEHICLE ====================

    @Transactional(readOnly = true)
    public List<Vehicle> getAllVehicles() {
        return vehicleRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Vehicle> getVehiclesByProvider(Long providerId) {
        return vehicleRepository.findByProviderId(providerId);
    }

    @Transactional
    public Vehicle createVehicle(Vehicle vehicle) {
        return vehicleRepository.save(vehicle);
    }

    @Transactional
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
    public void deleteVehicle(Long id) {
        if (!vehicleRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy phương tiện với ID: " + id);
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
        trip.setPrice(price);
        return tripRepository.save(trip);
    }

    @Transactional
    @CacheEvict(value = {"trips", "calendar_prices"}, allEntries = true)
    public void deleteTrip(Long id) {
        if (!tripRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy chuyến đi với ID: " + id);
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
                emailService.sendTripDelayEmail(booking.getUser().getEmail(), route, oldDeparture, newDeparture, reason);
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
            double refundAmount = booking.getTotalPrice() != null ? booking.getTotalPrice() : 0;

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
                emailService.sendTripCancelledEmail(booking.getUser().getEmail(), booking.getId(), route, refundAmount);
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
            Double revenue = bookingRepository.calculateTotalRevenueByProvider(p.getId());
            if (revenue == null) revenue = 0.0;
            result.add(new ProviderRevenueDTO(p.getId(), p.getProviderName(), p.getProviderType(), revenue));
        }
        return result;
    }
}
