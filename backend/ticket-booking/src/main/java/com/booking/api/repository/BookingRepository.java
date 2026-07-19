package com.booking.api.repository;

import com.booking.api.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByUserIdOrderByBookingDateDesc(Long userId);
    List<Booking> findByUserEmailOrderByBookingDateDesc(String email);

    @Query("SELECT DISTINCT b FROM Booking b JOIN b.tickets t WHERE t.trip.id = :tripId AND b.status IN ('CONFIRMED', 'PAID')")
    List<Booking> findActiveBookingsByTripId(@Param("tripId") Long tripId);

    List<Booking> findByStatusAndBookingDateBefore(String status, java.time.LocalDateTime cutoffTime);

    @Query("SELECT SUM(b.totalPrice) FROM Booking b JOIN b.tickets t WHERE t.trip.vehicle.provider.id = :providerId AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED')")
    Double calculateTotalRevenueByProvider(@Param("providerId") Long providerId);

    boolean existsByUserIdAndVoucherCodeAndStatusNot(Long userId, String voucherCode, String status);

    @Query("SELECT b FROM Booking b WHERE b.isCheckedIn = true ORDER BY b.checkInDate DESC")
    List<Booking> findRecentCheckInsAdmin(org.springframework.data.domain.Pageable pageable);

    // Thống kê doanh thu theo tháng trong năm hiện tại cho Provider
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE t.trip.vehicle.provider.id = :providerId " +
           "AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND YEAR(b.bookingDate) = YEAR(CURRENT_DATE) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueByProvider(@Param("providerId") Long providerId);

    // Thống kê Top 5 tuyến đường có doanh thu cao nhất của Provider
    @Query("SELECT t.trip.route.origin, t.trip.route.destination, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE t.trip.vehicle.provider.id = :providerId " +
           "AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.route.origin, t.trip.route.destination " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopRoutesByProvider(@Param("providerId") Long providerId);

    // Thống kê doanh thu theo tháng toàn hệ thống trong năm hiện tại
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND YEAR(b.bookingDate) = YEAR(CURRENT_DATE) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueSystem();

    // Thống kê doanh thu theo loại phương tiện toàn hệ thống
    @Query("SELECT t.trip.vehicle.provider.providerType, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.vehicle.provider.providerType")
    List<Object[]> getRevenueByVehicleTypeSystem();

    // Top 5 tuyến đường doanh thu cao nhất toàn hệ thống
    @Query("SELECT t.trip.route.origin, t.trip.route.destination, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.route.origin, t.trip.route.destination " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopSystemRoutes();

    // Top 5 nhà cung cấp doanh thu cao nhất toàn hệ thống
    @Query("SELECT t.trip.vehicle.provider.providerName, t.trip.vehicle.provider.providerType, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.vehicle.provider.providerName, t.trip.vehicle.provider.providerType " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopProviderRevenues();
}
