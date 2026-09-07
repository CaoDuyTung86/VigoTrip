package com.booking.api.controller;

import com.booking.api.dto.AdminDTO.*;
import com.booking.api.dto.ProviderRevenueDTO;
import com.booking.api.dto.TripUpdateRequest;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.entity.Voucher;
import com.booking.api.entity.User;
import com.booking.api.dto.UserResponse;
import com.booking.api.mapper.AdminMapper;
import com.booking.api.service.AdminService;
import com.booking.api.service.UserService;
import com.booking.api.service.VoucherService;
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
    private final VoucherService voucherService;

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

    // providerId truyền riêng vì AdminMapper bỏ qua quan hệ provider — xem createTrip bên dưới.
    @PostMapping("/vehicles")
    public ResponseEntity<Vehicle> createVehicle(@RequestBody VehicleRequest request) {
        return ResponseEntity.ok(adminService.createVehicle(
                request.getProviderId(), adminMapper.toEntity(request)));
    }

    @PutMapping("/vehicles/{id}")
    public ResponseEntity<Vehicle> updateVehicle(@PathVariable Long id, @RequestBody VehicleRequest request) {
        return ResponseEntity.ok(adminService.updateVehicle(
                id, request.getProviderId(), adminMapper.toEntity(request)));
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

    // routeId/vehicleId phải truyền riêng: AdminMapper bỏ qua hai quan hệ này nên
    // entity trả về từ toEntity() luôn có route/vehicle null.
    @PostMapping("/trips")
    public ResponseEntity<Trip> createTrip(@RequestBody TripRequest request) {
        return ResponseEntity.ok(adminService.createTrip(
                request.getRouteId(), request.getVehicleId(), adminMapper.toEntity(request)));
    }

    @PutMapping("/trips/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable Long id, @RequestBody TripRequest request) {
        return ResponseEntity.ok(adminService.updateTrip(
                id, request.getRouteId(), request.getVehicleId(), adminMapper.toEntity(request)));
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

    // ==================== VOUCHER ====================

    @GetMapping("/vouchers")
    public ResponseEntity<List<Voucher>> getAllVouchers() {
        return ResponseEntity.ok(voucherService.getAllVouchers());
    }

    /**
     * Danh sách voucher đang hoạt động và còn hiệu lực — dùng cho giao diện chỉ xem của tài khoản provider.
     */
    @GetMapping("/vouchers/active")
    public ResponseEntity<List<Voucher>> getActiveVouchers() {
        return ResponseEntity.ok(voucherService.getActiveVouchers());
    }

    @PostMapping("/vouchers")
    public ResponseEntity<Voucher> createVoucher(@RequestBody VoucherRequest request) {
        return ResponseEntity.ok(voucherService.createVoucher(adminMapper.toEntity(request), request.getProviderId()));
    }

    @PutMapping("/vouchers/{id}")
    public ResponseEntity<Voucher> updateVoucher(@PathVariable Long id, @RequestBody VoucherRequest request) {
        return ResponseEntity.ok(voucherService.updateVoucher(id, adminMapper.toEntity(request), request.getProviderId()));
    }

    /**
     * Bật/tắt voucher — cách "gỡ" voucher mặc định. Giữ lại bản ghi để đơn cũ còn tra được,
     * khác với DELETE bên dưới là xóa hẳn.
     */
    @PatchMapping("/vouchers/{id}/active")
    public ResponseEntity<Voucher> setVoucherActive(@PathVariable Long id, @RequestParam boolean active) {
        return ResponseEntity.ok(voucherService.setVoucherActive(id, active));
    }

    /**
     * Số đơn đã gắn mã của voucher. Giao diện hỏi trước khi mở hộp thoại xóa để biết nên mời
     * admin xóa hẳn hay chỉ tắt.
     */
    @GetMapping("/vouchers/{id}/usage")
    public ResponseEntity<Map<String, Object>> getVoucherUsage(@PathVariable Long id) {
        long bookings = voucherService.countBookingsUsingVoucher(id);
        return ResponseEntity.ok(Map.of("bookingCount", bookings, "deletable", bookings == 0));
    }

    @DeleteMapping("/vouchers/{id}")
    public ResponseEntity<Void> deleteVoucher(@PathVariable Long id) {
        voucherService.deleteVoucher(id);
        return ResponseEntity.noContent().build();
    }
}
