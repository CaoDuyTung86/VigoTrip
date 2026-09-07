package com.booking.api.integration;

import com.booking.api.controller.AdminController;
import com.booking.api.dto.AdminDTO.TripRequest;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.VehicleRepository;
import com.booking.api.service.AdminService;
import com.booking.api.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Các endpoint ghi của màn hình quản lý chuyến trả thẳng entity Trip ra JSON.
 *
 * Trip.route, Trip.vehicle và Vehicle.provider đều LAZY. Nếu service nạp chúng bằng findById
 * thường thì cái nằm trong trường là proxy Hibernate chứ không phải entity thật, và việc
 * serialize proxy đó chỉ chạy được khi session vẫn còn mở. Tắt open-in-view (hoặc bất cứ thứ
 * gì đóng session sớm) là cả bốn đường ghi — tạo, sửa, đổi giá, hoãn/huỷ — cùng trả 500
 * "Đã có lỗi xảy ra trên hệ thống", trong khi endpoint ĐỌC vẫn chạy bình thường vì
 * searchTripsForAdmin đã JOIN FETCH sẵn. Đúng triệu chứng "xem được danh sách nhưng không tạo
 * được chuyến mới".
 *
 * Test cố tình KHÔNG gắn @Transactional: không có transaction bao ngoài thì session đóng ngay
 * khi service trả về, tức là tái hiện đúng điều kiện khắc nghiệt nhất mà production có thể rơi
 * vào. Kết quả trả về phải serialize được mà không cần bất kỳ session nào còn sống.
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminTripWriteSerializationIntegrationTest {

    @Autowired private AdminController adminController;
    @Autowired private AdminService adminService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ProviderRepository providerRepository;
    @Autowired private RouteRepository routeRepository;
    @Autowired private VehicleRepository vehicleRepository;

    @MockitoBean private EmailService emailService;

    private Route route;
    private Vehicle vehicle;

    @BeforeEach
    void setUp() {
        Provider provider = new Provider();
        provider.setProviderName("Vietnam Airlines");
        provider.setProviderType("AIRLINE");
        provider = providerRepository.save(provider);

        Route r = new Route();
        r.setOrigin("Hà Nội (HAN)");
        r.setDestination("TP. Hồ Chí Minh (SGN)");
        route = routeRepository.save(r);

        Vehicle v = new Vehicle();
        v.setProvider(provider);
        v.setVehicleType("PLANE");
        v.setTotalSeats(180);
        vehicle = vehicleRepository.save(v);
    }

    /** Đúng thân JSON mà màn hình admin gửi lên khi bấm "Tạo chuyến đi mới". */
    private TripRequest newTripRequest() {
        TripRequest request = new TripRequest();
        request.setRouteId(route.getId());
        request.setVehicleId(vehicle.getId());
        request.setDepartureTime(LocalDateTime.now().plusDays(3));
        request.setArrivalTime(LocalDateTime.now().plusDays(3).plusHours(2));
        request.setPrice(new BigDecimal("1500000.00"));
        request.setStatus("ACTIVE");
        return request;
    }

    /** Serialize được, và mang đủ tuyến/hãng mà giao diện đọc tới. */
    private void assertSerializesWithDetails(Trip trip) {
        assertThatCode(() -> {
            String json = objectMapper.writeValueAsString(trip);
            assertThat(json).contains("Vietnam Airlines").contains("Hà Nội (HAN)");
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Tạo chuyến mới: chuyến trả về serialize được, không cần session còn mở")
    void createTrip_ReturnsSerializableTrip() {
        Trip created = adminController.createTrip(newTripRequest()).getBody();

        assertThat(created).isNotNull();
        assertThat(created.getId()).isNotNull();
        assertSerializesWithDetails(created);
    }

    @Test
    @DisplayName("Sửa chuyến: chuyến trả về serialize được kể cả khi không đổi tuyến/xe")
    void updateTrip_ReturnsSerializableTrip() {
        Long id = adminController.createTrip(newTripRequest()).getBody().getId();

        // routeId/vehicleId bỏ trống = giữ nguyên: đây là đường mà updateTrip không tự nạp lại
        // quan hệ, nên cũng là đường dễ để sót proxy nhất.
        TripRequest changes = new TripRequest();
        changes.setPrice(new BigDecimal("1750000.00"));

        assertSerializesWithDetails(adminController.updateTrip(id, changes).getBody());
    }

    @Test
    @DisplayName("Đổi giá nhanh: chuyến trả về serialize được")
    void updateTripPrice_ReturnsSerializableTrip() {
        Long id = adminController.createTrip(newTripRequest()).getBody().getId();

        assertSerializesWithDetails(adminService.updateTripPrice(id, 1900000d));
    }

    @Test
    @DisplayName("Huỷ chuyến: chuyến trả về serialize được")
    void cancelTrip_ReturnsSerializableTrip() {
        Long id = adminController.createTrip(newTripRequest()).getBody().getId();

        assertSerializesWithDetails(adminService.cancelTripByAdmin(id, "Thời tiết xấu"));
    }
}
