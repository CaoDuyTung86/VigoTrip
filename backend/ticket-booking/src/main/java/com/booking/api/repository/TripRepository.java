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

    /**
     * Danh sách chuyến đi cho màn hình quản trị.
     *
     * CAST(:keyword AS String) là phần bắt buộc, không phải cho đẹp. Khi không có từ khoá
     * tìm kiếm, tham số được bind là NULL không kèm kiểu; PostgreSQL (Neon) gặp
     * lower('%' || $n || '%') với toàn toán hạng "unknown" thì suy ra đây là phép nối bytea
     * và báo `ERROR: function lower(bytea) does not exist` -> 500 trên /api/admin/trips.
     * SQL Server không bị nên lỗi chỉ xuất hiện sau khi chuyển sang Postgres.
     *
     * JOIN FETCH route / vehicle / provider vì endpoint trả thẳng entity Trip ra JSON và
     * giao diện đọc route.origin/destination cùng vehicle.provider.providerName; nạp sẵn
     * ở đây thì khỏi N+1 và khỏi phụ thuộc vào open-in-view.
     *
     * countQuery viết tay vì câu đếm không được phép mang theo JOIN FETCH.
     */
    @Query(value = "SELECT t FROM Trip t " +
            "LEFT JOIN FETCH t.route " +
            "LEFT JOIN FETCH t.vehicle v " +
            "LEFT JOIN FETCH v.provider " +
            "WHERE (CAST(:vehicleType AS String) IS NULL OR t.vehicle.vehicleType = CAST(:vehicleType AS String)) " +
            "AND (CAST(:keyword AS String) IS NULL " +
            "OR LOWER(t.route.origin) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) " +
            "OR LOWER(t.route.destination) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) " +
            "OR STR(t.id) LIKE CONCAT('%', CAST(:keyword AS String), '%')) " +
            "ORDER BY t.departureTime ASC",
            countQuery = "SELECT COUNT(t) FROM Trip t " +
            "WHERE (CAST(:vehicleType AS String) IS NULL OR t.vehicle.vehicleType = CAST(:vehicleType AS String)) " +
            "AND (CAST(:keyword AS String) IS NULL " +
            "OR LOWER(t.route.origin) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) " +
            "OR LOWER(t.route.destination) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) " +
            "OR STR(t.id) LIKE CONCAT('%', CAST(:keyword AS String), '%'))")
    Page<Trip> searchTripsForAdmin(@Param("vehicleType") String vehicleType,
                                   @Param("keyword") String keyword,
                                   Pageable pageable);

    @Query("SELECT t FROM Trip t WHERE t.departureTime >= :now ORDER BY t.departureTime ASC")
    Page<Trip> findUpcomingTrips(@Param("now") LocalDateTime now, Pageable pageable);

    /**
     * Một nhúm chuyến của đúng một loại phương tiện, để seeder dữ liệu demo có chỗ gắn vé vào.
     *
     * Bắt buộc có Pageable: cửa sổ tồn kho 30 ngày đang cỡ hơn chục nghìn chuyến, kéo hết về
     * chỉ để bốc ra vài chục cái là phí RAM. JOIN FETCH sẵn vehicle/provider vì seeder cần đọc
     * loại phương tiện và giá của từng chuyến — không fetch thì mỗi chuyến một truy vấn con.
     */
    @Query("SELECT t FROM Trip t JOIN FETCH t.vehicle v JOIN FETCH v.provider "
         + "WHERE v.vehicleType = :vehicleType ORDER BY t.departureTime ASC")
    List<Trip> findByVehicleTypeForSeeding(@Param("vehicleType") String vehicleType, Pageable pageable);

    /**
     * Ảnh chụp "tồn kho" chuyến trong một cửa sổ thời gian: (route_id, loại phương tiện, giờ chạy).
     *
     * TripSupplyService dùng để biết (tuyến, phương tiện, ngày) nào đã có chuyến rồi mà bỏ qua.
     * Cố tình chỉ chiếu ra 3 cột thay vì SELECT t: cửa sổ 30 ngày đang cỡ hơn chục nghìn hàng,
     * nạp cả entity kèm route/vehicle sẽ vừa tốn RAM vừa dính N+1 trong khi chỉ cần đúng khoá.
     * Gom theo ngày làm ở tầng Java, không CAST sang date trong JPQL, để câu này chạy giống nhau
     * trên cả SQL Server lẫn PostgreSQL (Neon).
     */
    @Query("SELECT t.route.id, t.vehicle.vehicleType, t.departureTime FROM Trip t " +
            "WHERE t.departureTime >= :from AND t.departureTime < :to")
    List<Object[]> findSupplySlots(@Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to);

    @Query("SELECT t FROM Trip t " +
           "WHERE t.departureTime >= :startOfDay " +
           "AND t.departureTime <= :endOfDay " +
           // CAST vì lý do giống searchTripsForAdmin: chatbot gọi hàm này với origin/
           // destination/vehicleType có thể null, và PostgreSQL không suy được kiểu của
           // tham số null nằm trong LOWER()/CONCAT().
           "AND (CAST(:origin AS String) IS NULL OR CAST(:origin AS String) = '' " +
           "OR LOWER(t.route.origin) LIKE LOWER(CONCAT('%', CAST(:origin AS String), '%'))) " +
           "AND (CAST(:destination AS String) IS NULL OR CAST(:destination AS String) = '' " +
           "OR LOWER(t.route.destination) LIKE LOWER(CONCAT('%', CAST(:destination AS String), '%'))) " +
           "AND (CAST(:vehicleType AS String) IS NULL OR CAST(:vehicleType AS String) = '' " +
           "OR LOWER(t.vehicle.vehicleType) = LOWER(CAST(:vehicleType AS String))) " +
           "ORDER BY t.price ASC")
    List<Trip> searchTripsFlexible(@Param("origin") String origin,
                                   @Param("destination") String destination,
                                   @Param("vehicleType") String vehicleType,
                                   @Param("startOfDay") LocalDateTime startOfDay,
                                   @Param("endOfDay") LocalDateTime endOfDay,
                                   Pageable pageable);
}
