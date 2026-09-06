package com.booking.api.integration;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Vehicle;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.VehicleRepository;
import com.booking.api.service.AdminService;
import com.booking.api.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sửa hãng hoặc phương tiện thì kết quả tìm chuyến đã cache phải bị dọn.
 *
 * TripService cache kết quả tìm chuyến ở "trips" (5 phút) và "calendar_prices" (10 phút), mà
 * DTO trong đó mang sẵn tên hãng và thông số xe. Trước đây chỉ thao tác trên Trip mới dọn cache,
 * còn sửa hãng/xe thì không — admin đổi tên hãng xong, khách vẫn thấy tên cũ tới 5 phút và
 * không ai đoán ra vì sao.
 *
 * Test đặt tay một mục vào cache rồi gọi service thật, nên nó kiểm tra cả việc proxy cache của
 * Spring có thực sự chạy hay không, chứ không chỉ kiểm tra có dán annotation.
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminCacheEvictionIntegrationTest {

    private static final String TRIP_CACHE_KEY = "HANSGN2026-09-02PLANE1";

    @Autowired private AdminService adminService;
    @Autowired private CacheManager cacheManager;
    @Autowired private ProviderRepository providerRepository;
    @Autowired private VehicleRepository vehicleRepository;

    @MockitoBean private EmailService emailService;

    private Provider provider;

    @BeforeEach
    void setUp() {
        provider = new Provider();
        provider.setProviderName("Ten Cu");
        provider.setProviderType("AIRLINE");
        provider = providerRepository.save(provider);
    }

    private void seedTripCache() {
        cache("trips").put(TRIP_CACHE_KEY, "ket qua tim chuyen cu");
        cache("calendar_prices").put(TRIP_CACHE_KEY, "bang gia cu");
        // Không có dòng này thì cả bộ test rỗng tuếch: nếu profile test dùng cache no-op,
        // mọi phép đọc đều trả null và "đã bị dọn" luôn đúng dù chẳng có gì bị dọn.
        assertThat(cache("trips").get(TRIP_CACHE_KEY)).isNotNull();
        assertThat(cache("calendar_prices").get(TRIP_CACHE_KEY)).isNotNull();
    }

    private Cache cache(String name) {
        Cache c = cacheManager.getCache(name);
        assertThat(c).as("cache %s phải được đăng ký trong CacheConfig", name).isNotNull();
        return c;
    }

    private void assertTripCachesCleared() {
        assertThat(cache("trips").get(TRIP_CACHE_KEY)).isNull();
        assertThat(cache("calendar_prices").get(TRIP_CACHE_KEY)).isNull();
    }

    @Test
    @DisplayName("Đổi tên hãng: kết quả tìm chuyến đã cache bị dọn ngay")
    void updatingProviderClearsTripCaches() {
        seedTripCache();

        Provider data = new Provider();
        data.setProviderName("Ten Moi");
        data.setProviderType("AIRLINE");
        adminService.updateProvider(provider.getId(), data);

        assertTripCachesCleared();
        assertThat(providerRepository.findById(provider.getId()).orElseThrow().getProviderName())
                .isEqualTo("Ten Moi");
    }

    @Test
    @DisplayName("Sửa phương tiện: kết quả tìm chuyến đã cache bị dọn ngay")
    void updatingVehicleClearsTripCaches() {
        Vehicle vehicle = new Vehicle();
        vehicle.setProvider(provider);
        vehicle.setVehicleType("PLANE");
        vehicle.setTotalSeats(180);
        vehicle = vehicleRepository.save(vehicle);

        seedTripCache();

        Vehicle data = new Vehicle();
        data.setVehicleType("PLANE");
        data.setTotalSeats(200);
        // providerId = null: chỉ đổi số ghế, giữ nguyên hãng hiện tại.
        adminService.updateVehicle(vehicle.getId(), null, data);

        assertTripCachesCleared();
    }

    @Test
    @DisplayName("Thêm phương tiện mới: cache cũ không được giữ lại che mất chuyến mới")
    void creatingVehicleClearsTripCaches() {
        seedTripCache();

        // Hãng do service tự nạp từ providerId — mapper không dựng được quan hệ này.
        Vehicle vehicle = new Vehicle();
        vehicle.setVehicleType("PLANE");
        vehicle.setTotalSeats(180);
        adminService.createVehicle(provider.getId(), vehicle);

        assertTripCachesCleared();
    }
}
