package com.booking.api.repository;

import com.booking.api.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    java.util.Optional<Booking> findByIdAndUserEmail(Long id, String email);

    @Query("SELECT DISTINCT b FROM Booking b " +
           "LEFT JOIN FETCH b.tickets t " +
           "LEFT JOIN FETCH t.trip tr " +
           "LEFT JOIN FETCH tr.route " +
           "LEFT JOIN FETCH tr.vehicle v " +
           "LEFT JOIN FETCH v.provider " +
           "WHERE b.user.id = :userId ORDER BY b.bookingDate DESC")
    List<Booking> findByUserIdWithDetails(@Param("userId") Long userId);

    @Query("SELECT DISTINCT b FROM Booking b " +
           "LEFT JOIN FETCH b.tickets t " +
           "LEFT JOIN FETCH t.trip tr " +
           "LEFT JOIN FETCH tr.route " +
           "LEFT JOIN FETCH tr.vehicle v " +
           "LEFT JOIN FETCH v.provider " +
           "WHERE b.user.email = :email ORDER BY b.bookingDate DESC")
    List<Booking> findByUserEmailWithDetails(@Param("email") String email);

    @Query("SELECT DISTINCT b FROM Booking b " +
           "JOIN FETCH b.user u " +
           "JOIN FETCH b.tickets t " +
           "JOIN FETCH t.trip tr " +
           "JOIN FETCH tr.route " +
           "WHERE b.status = 'CONFIRMED' " +
           "AND (b.reminderSent IS NULL OR b.reminderSent = false) " +
           "AND tr.departureTime > :now " +
           "AND tr.departureTime <= :cutoffTime")
    List<Booking> findConfirmedBookingsForReminder(@Param("now") java.time.LocalDateTime now,
                                                   @Param("cutoffTime") java.time.LocalDateTime cutoffTime);

    List<Booking> findByUserIdOrderByBookingDateDesc(Long userId);
    List<Booking> findByUserEmailOrderByBookingDateDesc(String email);

    @Query("SELECT DISTINCT b FROM Booking b JOIN b.tickets t WHERE t.trip.id = :tripId AND b.status IN ('CONFIRMED', 'PAID')")
    List<Booking> findActiveBookingsByTripId(@Param("tripId") Long tripId);

    /**
     * Đơn PENDING quá hạn giữ chỗ VÀ không có phiên thanh toán nào đang mở.
     * Điều kiện paymentExpiresAt là để không dọn mất đơn khi người dùng đang ở cổng
     * thanh toán — nếu hủy lúc đó thì tiền vẫn bị trừ mà đơn đã CANCELLED.
     */
    @Query("SELECT b FROM Booking b WHERE b.status = 'PENDING' AND b.bookingDate < :cutoffTime " +
           "AND (b.paymentExpiresAt IS NULL OR b.paymentExpiresAt < :now)")
    List<Booking> findExpiredPendingBookings(@Param("cutoffTime") java.time.LocalDateTime cutoffTime,
                                             @Param("now") java.time.LocalDateTime now);

    /**
     * Ứng viên "có thể là no-show": đã thanh toán, chưa check-in, chưa bị đánh dấu no-show,
     * và chuyến đã khởi hành. Lọc thô theo departureTime ở đây, mốc chính xác
     * (Trip.getLateCheckInCutoff — có cộng thêm buffer theo giờ đến) được NoShowScheduler
     * tính lại ở tầng Java để dùng chung đúng một công thức với BookingService.checkIn().
     */
    @Query("SELECT DISTINCT b FROM Booking b " +
           "JOIN FETCH b.tickets t " +
           "JOIN FETCH t.trip tr " +
           "WHERE b.status IN ('CONFIRMED', 'PAID') " +
           "AND (b.isCheckedIn IS NULL OR b.isCheckedIn = false) " +
           "AND (b.noShow IS NULL OR b.noShow = false) " +
           "AND tr.departureTime < :now")
    List<Booking> findNoShowCandidates(@Param("now") java.time.LocalDateTime now);

    @Query("SELECT SUM(b.totalPrice) FROM Booking b JOIN b.tickets t WHERE t.trip.vehicle.provider.id = :providerId AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED')")
    Double calculateTotalRevenueByProvider(@Param("providerId") Long providerId);

    /**
     * Đơn ở các trạng thái này coi như KHÔNG tiêu mã giảm giá, nên mã được dùng lại:
     * CANCELLED (người dùng hủy / hết hạn giữ chỗ) và FAILED (thanh toán thất bại).
     * Danh sách này phải khớp với bộ lọc của index uq_booking_user_voucher_active
     * (xem VoucherUsageConstraintInitializer).
     */
    List<String> VOUCHER_RELEASING_STATUSES = List.of("CANCELLED", "FAILED");

    boolean existsByUserIdAndVoucherCodeAndStatusNotIn(Long userId, String voucherCode, List<String> statuses);

    /**
     * Các mã giảm giá người dùng đang thực sự chiếm ở những đơn còn hiệu lực — dùng để chặn
     * dùng lại cùng một mã cho chuyến khác (mỗi mã chỉ dùng được 1 lần / tài khoản).
     */
    @Query("SELECT DISTINCT UPPER(b.voucherCode) FROM Booking b " +
           "WHERE b.user.id = :userId AND b.voucherCode IS NOT NULL " +
           "AND b.status NOT IN ('CANCELLED', 'FAILED')")
    List<String> findUsedVoucherCodesByUserId(@Param("userId") Long userId);

    @Query("SELECT DISTINCT b FROM Booking b " +
           "LEFT JOIN FETCH b.tickets t " +
           "LEFT JOIN FETCH t.trip tr " +
           "LEFT JOIN FETCH tr.route " +
           "LEFT JOIN FETCH tr.vehicle v " +
           "LEFT JOIN FETCH v.provider " +
           "WHERE b.isCheckedIn = true ORDER BY b.checkInDate DESC")
    List<Booking> findRecentCheckInsAdmin(org.springframework.data.domain.Pageable pageable);

    // Thống kê doanh thu theo tháng trong năm hiện tại cho Provider
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE t.trip.vehicle.provider.id = :providerId " +
           "AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND YEAR(b.bookingDate) = YEAR(CURRENT_DATE) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueByProvider(@Param("providerId") Long providerId);

    // Thống kê Top 5 tuyến đường có doanh thu cao nhất của Provider
    @Query("SELECT t.trip.route.origin, t.trip.route.destination, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE t.trip.vehicle.provider.id = :providerId " +
           "AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.route.origin, t.trip.route.destination " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopRoutesByProvider(@Param("providerId") Long providerId);

    // Thống kê doanh thu theo tháng toàn hệ thống trong năm hiện tại
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND YEAR(b.bookingDate) = YEAR(CURRENT_DATE) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueSystem();

    // Thống kê doanh thu theo loại phương tiện toàn hệ thống
    @Query("SELECT t.trip.vehicle.provider.providerType, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.vehicle.provider.providerType")
    List<Object[]> getRevenueByVehicleTypeSystem();

    // Top 5 tuyến đường doanh thu cao nhất toàn hệ thống
    @Query("SELECT t.trip.route.origin, t.trip.route.destination, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.route.origin, t.trip.route.destination " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopSystemRoutes();

    // Top 5 nhà cung cấp doanh thu cao nhất toàn hệ thống
    @Query("SELECT t.trip.vehicle.provider.providerName, t.trip.vehicle.provider.providerType, SUM(t.price) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "GROUP BY t.trip.vehicle.provider.providerName, t.trip.vehicle.provider.providerType " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> getTopProviderRevenues();

    // Thống kê doanh thu theo năm/tháng tùy chọn cho Provider
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE t.trip.vehicle.provider.id = :providerId " +
           "AND b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND (:targetYear IS NULL OR YEAR(b.bookingDate) = :targetYear) " +
           "AND (:targetMonth IS NULL OR MONTH(b.bookingDate) = :targetMonth) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueByProviderFiltered(@Param("providerId") Long providerId,
                                                       @Param("targetYear") Integer targetYear,
                                                       @Param("targetMonth") Integer targetMonth);

    // Thống kê doanh thu theo năm/tháng tùy chọn toàn hệ thống
    @Query("SELECT MONTH(b.bookingDate) as month, SUM(b.totalPrice) as total " +
           "FROM Booking b " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND (:targetYear IS NULL OR YEAR(b.bookingDate) = :targetYear) " +
           "AND (:targetMonth IS NULL OR MONTH(b.bookingDate) = :targetMonth) " +
           "GROUP BY MONTH(b.bookingDate) " +
           "ORDER BY MONTH(b.bookingDate)")
    List<Object[]> getMonthlyRevenueSystemFiltered(@Param("targetYear") Integer targetYear,
                                                    @Param("targetMonth") Integer targetMonth);
}
