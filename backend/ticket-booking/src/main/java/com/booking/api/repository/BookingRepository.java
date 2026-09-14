package com.booking.api.repository;

import com.booking.api.entity.Booking;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

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
           // Tài khoản đã tắt thư nhắc thì bỏ qua mà KHÔNG giành cờ reminderSent: khách bật lại
           // trước giờ đi thì lượt quét sau vẫn gửi. null = chưa từng chọn = bật.
           "AND (u.tripReminderOptIn IS NULL OR u.tripReminderOptIn = true) " +
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
     * Đếm mọi đơn đang ở một trạng thái. {@code countByStatus("PENDING")} là câu hỏi mà
     * {@link com.booking.api.service.PendingBookingSignal} cần để biết có được phép ngừng quét
     * hay không — hỏi cả đơn CHƯA quá hạn, khác hẳn findExpiredPendingBookings ở trên.
     */
    long countByStatus(String status);

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
     * Số đơn từng gắn mã này, tính cả đơn đã hủy. Dùng để chặn xóa cứng voucher:
     * dat_ve chỉ lưu voucher_code dạng chuỗi nên database không tự bảo vệ được, xóa voucher
     * đi là mất luôn thông tin "mã đó giảm bao nhiêu" khi cần đối soát hay khách khiếu nại.
     * Đơn đã hủy vẫn tính vì nó cũng là bản ghi lịch sử.
     */
    long countByVoucherCodeIgnoreCase(String voucherCode);

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

    // ─────────────────────────────────────────────────────────────────────────────
    // AI BI — truy vấn theo KỲ.
    //
    // Nhóm getMonthly*/getTop*/getRevenueBy* ở trên chỉ lọc được năm + tháng, và phần lớn
    // còn không lọc gì cả (all-time). Nhóm dưới đây nhận đúng một khoảng nửa mở
    // [from, to) do ReportPeriod tính ra, nên mọi con số trong một báo cáo chắc chắn cùng kỳ.
    //
    // Tất cả đều nhận :providerIds — phạm vi hệ thống thì truyền toàn bộ id nhà cung cấp,
    // phạm vi đối tác thì truyền đúng những hãng tài khoản đó sở hữu. Một đường code duy
    // nhất cho cả hai, khỏi phải nhân đôi truy vấn rồi lệch nhau lúc sửa.
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Các đơn đặt vé RIÊNG BIỆT chạm tới phạm vi đang xét, dạng (id, ngày đặt, tiền thực thu).
     *
     * Bắt buộc DISTINCT và cộng ở tầng Java thay vì SUM(b.totalPrice) trong câu lệnh:
     * đã JOIN sang tickets thì một đơn 3 vé sẽ ra 3 dòng, SUM sẽ tính tiền đơn đó 3 lần.
     * Đây đúng là lỗi đang có ở getMonthlyRevenueByProviderFiltered, khiến doanh thu nhà
     * cung cấp bị thổi lên theo số vé mỗi đơn.
     */
    @Query("SELECT DISTINCT b.id, b.bookingDate, b.totalPrice " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND b.bookingDate >= :from AND b.bookingDate < :to " +
           "AND t.trip.vehicle.provider.id IN :providerIds")
    List<Object[]> findScopedBookingRows(@Param("from") java.time.LocalDateTime from,
                                         @Param("to") java.time.LocalDateTime to,
                                         @Param("providerIds") List<Long> providerIds);

    /**
     * Tổng tiền dịch vụ bổ sung của một danh sách đơn.
     *
     * Nhận sẵn id đơn thay vì tự lọc lại theo kỳ và theo nhà cung cấp: danh sách đó đã do
     * {@link #findScopedBookingRows} chốt, hỏi lại lần nữa bằng một mệnh đề WHERE khác là
     * mở đường cho hai con số lệch nhau khi sau này ai đó sửa điều kiện ở một chỗ.
     *
     * Cũng vì thế mà câu lệnh này KHÔNG join sang tickets: đơn 3 vé mà join cả vé lẫn dịch
     * vụ sẽ ra 3xN dòng và tiền dịch vụ nở ra theo số vé — đúng lỗi mà findScopedBookingRows
     * đang phải dùng DISTINCT để tránh.
     */
    @Query("SELECT COALESCE(SUM(s.price), 0) FROM Booking b JOIN b.additionalServices s "
         + "WHERE b.id IN :bookingIds")
    java.math.BigDecimal sumServiceRevenueForBookings(@Param("bookingIds") List<Long> bookingIds);

    /**
     * Đếm đơn đặt trong một khoảng, không phân biệt trạng thái hay nhà cung cấp.
     *
     * Dùng làm chốt chặn chạy trùng cho seeder dữ liệu demo: tháng đó đã có đơn thì thôi,
     * khỏi sinh chồng lên. Cố tình KHÔNG lọc trạng thái — đơn PENDING hay CANCELLED cũng là
     * dấu hiệu tháng đó đã được đụng vào rồi.
     */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.bookingDate >= :from AND b.bookingDate < :to")
    long countByBookingDateInRange(@Param("from") java.time.LocalDateTime from,
                                   @Param("to") java.time.LocalDateTime to);

    /** Doanh thu vé + số vé theo từng nhà cung cấp trong kỳ. */
    @Query("SELECT t.trip.vehicle.provider.id, t.trip.vehicle.provider.providerName, " +
           "t.trip.vehicle.provider.providerType, SUM(t.price), COUNT(t) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND b.bookingDate >= :from AND b.bookingDate < :to " +
           "AND t.trip.vehicle.provider.id IN :providerIds " +
           "AND (t.status IS NULL OR t.status <> 'CANCELLED') " +
           "GROUP BY t.trip.vehicle.provider.id, t.trip.vehicle.provider.providerName, " +
           "t.trip.vehicle.provider.providerType " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> findRevenueByProviderInPeriod(@Param("from") java.time.LocalDateTime from,
                                                 @Param("to") java.time.LocalDateTime to,
                                                 @Param("providerIds") List<Long> providerIds);

    /**
     * Doanh thu vé theo loại phương tiện trong kỳ.
     *
     * Gom theo phuong_tien.vehicle_type chứ không theo nha_cung_cap.provider_type như bản cũ:
     * loại phương tiện là thứ chuyến đi thực sự chạy, cũng chính là tham số `type` mà màn
     * tìm kiếm dùng, nên số liệu khớp được với những gì khách nhìn thấy.
     */
    @Query("SELECT t.trip.vehicle.vehicleType, SUM(t.price), COUNT(t) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND b.bookingDate >= :from AND b.bookingDate < :to " +
           "AND t.trip.vehicle.provider.id IN :providerIds " +
           "AND (t.status IS NULL OR t.status <> 'CANCELLED') " +
           "GROUP BY t.trip.vehicle.vehicleType " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> findRevenueByVehicleTypeInPeriod(@Param("from") java.time.LocalDateTime from,
                                                    @Param("to") java.time.LocalDateTime to,
                                                    @Param("providerIds") List<Long> providerIds);

    /** Doanh thu vé + số vé theo tuyến trong kỳ, tuyến cao nhất đứng trước. */
    @Query("SELECT t.trip.route.origin, t.trip.route.destination, SUM(t.price), COUNT(t) " +
           "FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND b.bookingDate >= :from AND b.bookingDate < :to " +
           "AND t.trip.vehicle.provider.id IN :providerIds " +
           "AND (t.status IS NULL OR t.status <> 'CANCELLED') " +
           "GROUP BY t.trip.route.origin, t.trip.route.destination " +
           "ORDER BY SUM(t.price) DESC")
    List<Object[]> findTopRoutesInPeriod(@Param("from") java.time.LocalDateTime from,
                                         @Param("to") java.time.LocalDateTime to,
                                         @Param("providerIds") List<Long> providerIds,
                                         org.springframework.data.domain.Pageable pageable);

    /**
     * Ngày đặt vé gần nhất trong phạm vi — dùng để tự lùi về kỳ gần nhất CÓ dữ liệu khi kỳ
     * người dùng chọn còn trống, thay vì trả về một màn hình trắng.
     */
    @Query("SELECT MAX(b.bookingDate) FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND t.trip.vehicle.provider.id IN :providerIds")
    java.time.LocalDateTime findLatestBookingDate(@Param("providerIds") List<Long> providerIds);

    /**
     * Ngày đặt vé xa nhất trong phạm vi — cận dưới của dải kỳ có thể xem được.
     *
     * Đối xứng với {@link #findLatestBookingDate}, và cùng nhau chúng khoanh đúng đoạn thời
     * gian mà nút lùi/tiến kỳ được phép đi qua. Thiếu cận dưới thì nút "kỳ trước" đi lùi vô
     * hạn vào vùng rỗng: mỗi lần bấm là một lần backend lùi về kỳ gần nhất có dữ liệu, màn
     * hình đứng yên, còn con trỏ kỳ ở phía giao diện thì cứ trôi tiếp — bấm lùi năm lần rồi
     * phải bấm tiến đủ năm lần mới thấy màn hình nhúc nhích.
     *
     * <p>Cùng bộ lọc trạng thái với truy vấn ngày gần nhất: hai đầu của dải phải được đo
     * bằng cùng một thước, nếu không sẽ có kỳ nằm trong dải mà lại không có số liệu nào.
     */
    @Query("SELECT MIN(b.bookingDate) FROM Booking b JOIN b.tickets t " +
           "WHERE b.status IN ('CONFIRMED', 'PAID', 'COMPLETED') " +
           "AND t.trip.vehicle.provider.id IN :providerIds")
    java.time.LocalDateTime findEarliestBookingDate(@Param("providerIds") List<Long> providerIds);

    /**
     * Nạp đơn kèm khóa ghi trên dòng (SELECT ... FOR UPDATE).
     *
     * Dùng cho hai callback thanh toán của VNPay. Return (trình duyệt quay về) và IPN
     * (server-to-server) thường tới gần như cùng lúc cho cùng một giao dịch, mỗi cái một
     * transaction riêng. Chốt chống trùng hiện tại là một phép đọc rồi mới ghi
     * (existsByTransactionRef... rồi processSuccessfulPayment), nên nếu cả hai cùng đọc
     * TRƯỚC khi bên nào kịp commit thì cả hai đều thấy "chưa xử lý" và cùng xác nhận đơn:
     * khách nhận hai mail xác nhận giống hệt nhau và được tích điểm hai lần.
     *
     * Khóa dòng đơn hàng bắt lượt sau phải xếp hàng, tới lượt nó thì bản ghi thanh toán
     * của lượt trước đã commit, chốt chống trùng đọc ra đúng và trả ALREADY_PROCESSED.
     * Khóa nằm ở tầng CSDL nên vẫn đúng cả khi backend chạy nhiều instance.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    java.util.Optional<Booking> findByIdForUpdate(@Param("id") Long id);

    /**
     * Giành quyền gửi mail nhắc chuyến cho một đơn: trả về 1 nếu lượt gọi này là lượt đầu
     * tiên bật cờ, 0 nếu đơn đã được đánh dấu từ trước.
     *
     * Đặt cờ bằng một câu UPDATE có điều kiện thay vì "đọc rồi ghi" để hai tiến trình cùng
     * quét (hai instance backend, hoặc một lượt chạy chồng lên lượt trước sau khi deploy)
     * không thể cùng thấy cờ đang false và cùng gửi mail. Ai UPDATE được mới gửi.
     */
    @Modifying
    @Transactional
    @Query("UPDATE Booking b SET b.reminderSent = true " +
           "WHERE b.id = :id AND (b.reminderSent IS NULL OR b.reminderSent = false)")
    int claimReminder(@Param("id") Long id);
}
