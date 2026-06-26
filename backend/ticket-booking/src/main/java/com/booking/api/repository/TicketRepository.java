package com.booking.api.repository;

import com.booking.api.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    @Query("SELECT COUNT(t) > 0 FROM Ticket t WHERE t.trip.id = :tripId AND t.seat.id = :seatId AND (t.status IS NULL OR t.status <> 'CANCELLED') AND t.booking.status NOT IN ('CANCELLED', 'FAILED')")
    boolean existsByTripIdAndSeatId(@Param("tripId") Long tripId, @Param("seatId") Long seatId);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.trip.id = :tripId AND (t.status IS NULL OR t.status <> 'CANCELLED') AND t.booking.status NOT IN ('CANCELLED', 'FAILED')")
    long countByTripId(@Param("tripId") Long tripId);
}
