package com.booking.api.repository;

import com.booking.api.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    List<Vehicle> findByProviderId(Long providerId);

    long countByProviderId(Long providerId);

    /**
     * Danh sách phương tiện kèm sẵn hãng, dùng cho màn hình admin.
     *
     * Vehicle.provider là liên kết LAZY: nếu trả thẳng kết quả của findAll() ra JSON thì
     * Jackson gặp proxy chưa nạp và cả request thành 500 — màn hình quản lý chuyến đi mất
     * luôn danh sách phương tiện. JOIN FETCH nạp hãng ngay trong một câu truy vấn, vừa
     * serialize được vừa tránh N+1.
     */
    @Query("SELECT v FROM Vehicle v JOIN FETCH v.provider")
    List<Vehicle> findAllWithProvider();

    @Query("SELECT v FROM Vehicle v JOIN FETCH v.provider WHERE v.provider.id = :providerId")
    List<Vehicle> findByProviderIdWithProvider(@Param("providerId") Long providerId);
}
