package com.booking.api.repository;

import com.booking.api.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @Query("SELECT t FROM Trip t " +
            "WHERE t.route.origin = :origin " +
            "AND t.route.destination = :destination " +
            "AND t.departureTime BETWEEN :start AND :end " +
            "AND (:vehicleType IS NULL OR t.vehicle.vehicleType = :vehicleType)")
    List<Trip> searchTrips(@Param("origin") String origin,
                           @Param("destination") String destination,
                           @Param("start") LocalDateTime start,
                           @Param("end") LocalDateTime end,
                           @Param("vehicleType") String vehicleType);

    @Query("SELECT t FROM Trip t " +
            "WHERE (:vehicleType IS NULL OR t.vehicle.vehicleType = :vehicleType) " +
            "AND (:keyword IS NULL OR LOWER(t.route.origin) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(t.route.destination) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR STR(t.id) LIKE CONCAT('%', :keyword, '%')) " +
            "ORDER BY t.departureTime ASC")
    Page<Trip> searchTripsForAdmin(@Param("vehicleType") String vehicleType,
                                   @Param("keyword") String keyword,
                                   Pageable pageable);

    @Query("SELECT t FROM Trip t WHERE t.departureTime >= :now ORDER BY t.departureTime ASC")
    Page<Trip> findUpcomingTrips(@Param("now") LocalDateTime now, Pageable pageable);

    @Query("SELECT t FROM Trip t " +
           "WHERE t.departureTime >= :startOfDay " +
           "AND t.departureTime <= :endOfDay " +
           "AND (:origin IS NULL OR :origin = '' OR LOWER(t.route.origin) LIKE LOWER(CONCAT('%', :origin, '%'))) " +
           "AND (:destination IS NULL OR :destination = '' OR LOWER(t.route.destination) LIKE LOWER(CONCAT('%', :destination, '%'))) " +
           "AND (:vehicleType IS NULL OR :vehicleType = '' OR LOWER(t.vehicle.vehicleType) = LOWER(:vehicleType)) " +
           "ORDER BY t.price ASC")
    List<Trip> searchTripsFlexible(@Param("origin") String origin,
                                   @Param("destination") String destination,
                                   @Param("vehicleType") String vehicleType,
                                   @Param("startOfDay") LocalDateTime startOfDay,
                                   @Param("endOfDay") LocalDateTime endOfDay,
                                   Pageable pageable);
}
