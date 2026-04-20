package com.booking.api.controller;

import com.booking.api.dto.ProviderRevenueDTO;
import com.booking.api.dto.TripUpdateRequest;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // ==================== ROUTE ====================

    @GetMapping("/routes")
    public ResponseEntity<List<Route>> getAllRoutes() {
        return ResponseEntity.ok(adminService.getAllRoutes());
    }

    @PostMapping("/routes")
    public ResponseEntity<Route> createRoute(@RequestBody Route route) {
        return ResponseEntity.ok(adminService.createRoute(route));
    }

    @PutMapping("/routes/{id}")
    public ResponseEntity<Route> updateRoute(@PathVariable Long id, @RequestBody Route route) {
        return ResponseEntity.ok(adminService.updateRoute(id, route));
    }

    @DeleteMapping("/routes/{id}")
    public ResponseEntity<Void> deleteRoute(@PathVariable Long id) {
        adminService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== PROVIDER ====================

    @GetMapping("/providers")
    public ResponseEntity<List<Provider>> getAllProviders() {
        return ResponseEntity.ok(adminService.getAllProviders());
    }

    @PostMapping("/providers")
    public ResponseEntity<Provider> createProvider(@RequestBody Provider provider) {
        return ResponseEntity.ok(adminService.createProvider(provider));
    }

    @PutMapping("/providers/{id}")
    public ResponseEntity<Provider> updateProvider(@PathVariable Long id, @RequestBody Provider provider) {
        return ResponseEntity.ok(adminService.updateProvider(id, provider));
    }

    @DeleteMapping("/providers/{id}")
    public ResponseEntity<Void> deleteProvider(@PathVariable Long id) {
        adminService.deleteProvider(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== VEHICLE ====================

    @GetMapping("/vehicles")
    public ResponseEntity<List<Vehicle>> getAllVehicles() {
        return ResponseEntity.ok(adminService.getAllVehicles());
    }

    @GetMapping("/vehicles/provider/{providerId}")
    public ResponseEntity<List<Vehicle>> getVehiclesByProvider(@PathVariable Long providerId) {
        return ResponseEntity.ok(adminService.getVehiclesByProvider(providerId));
    }

    @PostMapping("/vehicles")
    public ResponseEntity<Vehicle> createVehicle(@RequestBody Vehicle vehicle) {
        return ResponseEntity.ok(adminService.createVehicle(vehicle));
    }

    @PutMapping("/vehicles/{id}")
    public ResponseEntity<Vehicle> updateVehicle(@PathVariable Long id, @RequestBody Vehicle vehicle) {
        return ResponseEntity.ok(adminService.updateVehicle(id, vehicle));
    }

    @DeleteMapping("/vehicles/{id}")
    public ResponseEntity<Void> deleteVehicle(@PathVariable Long id) {
        adminService.deleteVehicle(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== TRIP ====================

    @GetMapping("/trips")
    public ResponseEntity<Page<Trip>> getTrips(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(adminService.getPaginatedTrips(type, search, page, size));
    }

    @PostMapping("/trips")
    public ResponseEntity<Trip> createTrip(@RequestBody Trip trip) {
        return ResponseEntity.ok(adminService.createTrip(trip));
    }

    @PutMapping("/trips/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable Long id, @RequestBody Trip trip) {
        return ResponseEntity.ok(adminService.updateTrip(id, trip));
    }

    @PutMapping("/trips/{id}/price")
    public ResponseEntity<Trip> updateTripPrice(@PathVariable Long id, @RequestBody Double price) {
        return ResponseEntity.ok(adminService.updateTripPrice(id, price));
    }

    @PutMapping("/trips/{id}/delay")
    public ResponseEntity<Trip> delayTrip(@PathVariable Long id, @Valid @RequestBody TripUpdateRequest request) {
        return ResponseEntity.ok(adminService.delayTrip(id, request));
    }

    @PutMapping("/trips/{id}/cancel")
    public ResponseEntity<Trip> cancelTrip(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "Không có lý do");
        return ResponseEntity.ok(adminService.cancelTripByAdmin(id, reason));
    }

    @DeleteMapping("/trips/{id}")
    public ResponseEntity<Void> deleteTrip(@PathVariable Long id) {
        adminService.deleteTrip(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== REVENUE ====================

    @GetMapping("/revenue")
    public ResponseEntity<List<ProviderRevenueDTO>> getProviderRevenue() {
        return ResponseEntity.ok(adminService.getProviderRevenue());
    }
}

