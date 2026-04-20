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
}
