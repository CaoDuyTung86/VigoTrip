package com.booking.api.repository;

import com.booking.api.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteRepository extends JpaRepository<Route, Long> {

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT r.origin FROM Route r")
    java.util.List<String> findDistinctOrigins();

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT r.destination FROM Route r")
    java.util.List<String> findDistinctDestinations();
}
