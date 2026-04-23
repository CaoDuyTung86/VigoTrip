package com.booking.api.repository;

import com.booking.api.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByVehicleId(Long vehicleId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT s FROM Seat s WHERE s.id = :id")
    java.util.Optional<Seat> findByIdWithLock(@org.springframework.data.repository.query.Param("id") Long id);
}

