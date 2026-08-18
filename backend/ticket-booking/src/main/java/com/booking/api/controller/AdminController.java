package com.booking.api.controller;

import com.booking.api.dto.AdminDTO.*;
import com.booking.api.dto.ProviderRevenueDTO;
import com.booking.api.dto.TripUpdateRequest;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.entity.User;
import com.booking.api.dto.UserResponse;
import com.booking.api.mapper.AdminMapper;
import com.booking.api.service.AdminService;
import com.booking.api.service.UserService;
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
    private final AdminMapper adminMapper;
    private final UserService userService;

    // ==================== ROUTE ====================

    @GetMapping("/routes")
    public ResponseEntity<List<Route>> getAllRoutes() {
        return ResponseEntity.ok(adminService.getAllRoutes());
    }

    @PostMapping("/routes")
    public ResponseEntity<Route> createRoute(@RequestBody RouteRequest request) {
        return ResponseEntity.ok(adminService.createRoute(adminMapper.toEntity(request)));
    }

    @PutMapping("/routes/{id}")
    public ResponseEntity<Route> updateRoute(@PathVariable Long id, @RequestBody RouteRequest request) {
        return ResponseEntity.ok(adminService.updateRoute(id, adminMapper.toEntity(request)));
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
    public ResponseEntity<Provider> createProvider(@RequestBody ProviderRequest request) {
        return ResponseEntity.ok(adminService.createProvider(adminMapper.toEntity(request)));
    }

    @PutMapping("/providers/{id}")
    public ResponseEntity<Provider> updateProvider(@PathVariable Long id, @RequestBody ProviderRequest request) {
        return ResponseEntity.ok(adminService.updateProvider(id, adminMapper.toEntity(request)));
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
    public ResponseEntity<Vehicle> createVehicle(@RequestBody VehicleRequest request) {
        return ResponseEntity.ok(adminService.createVehicle(adminMapper.toEntity(request)));
    }

    @PutMapping("/vehicles/{id}")
    public ResponseEntity<Vehicle> updateVehicle(@PathVariable Long id, @RequestBody VehicleRequest request) {
        return ResponseEntity.ok(adminService.updateVehicle(id, adminMapper.toEntity(request)));
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
    public ResponseEntity<Trip> createTrip(@RequestBody TripRequest request) {
        return ResponseEntity.ok(adminService.createTrip(adminMapper.toEntity(request)));
    }

    @PutMapping("/trips/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable Long id, @RequestBody TripRequest request) {
        return ResponseEntity.ok(adminService.updateTrip(id, adminMapper.toEntity(request)));
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

    // ==================== USER MANAGEMENT ====================

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<User> users = adminService.getAllUsers();
        List<UserResponse> responses = users.stream().map(userService::toResponse).toList();
        return ResponseEntity.ok(responses);
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String role = body.get("role");
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("Vai trò không được để trống");
        }
        User updated = adminService.updateUserRole(id, role);
        return ResponseEntity.ok(userService.toResponse(updated));
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<UserResponse> toggleUserStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        Boolean enabled = body.get("enabled");
        if (enabled == null) {
            throw new IllegalArgumentException("Trạng thái enabled không được để trống");
        }
        User updated = adminService.toggleUserStatus(id, enabled);
        return ResponseEntity.ok(userService.toResponse(updated));
    }
}
