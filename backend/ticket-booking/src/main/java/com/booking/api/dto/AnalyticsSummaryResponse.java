package com.booking.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Toàn bộ số liệu của một kỳ báo cáo, ở dạng có cấu trúc.
 *
 * Giao diện và phần AI dùng CHUNG đối tượng này. Trước đây màn Thống kê doanh thu gọi
 * /api/admin/revenue (doanh thu all-time theo nhà cung cấp) còn nút "Phân tích AI" lại
 * dựng báo cáo riêng từ một bộ truy vấn khác, nên con số AI đọc ra có thể mâu thuẫn với
 * chính biểu đồ mà người dùng đang nhìn. Một nguồn duy nhất thì hết cửa lệch.
 *
 * @param totalRevenue    tổng tiền THỰC THU trong kỳ, cộng từ Booking.totalPrice
 * @param ticketRevenue   tổng tiền VÉ trong kỳ, cộng từ Ticket.price
 * @param fallbackApplied kỳ được yêu cầu không có giao dịch nên đã tự lùi về kỳ gần nhất có dữ liệu
 *
 * <p>{@code totalRevenue} và {@code ticketRevenue} lệch nhau là bình thường, không phải lỗi
 * làm tròn: tiền thực thu còn gồm dịch vụ cộng thêm và đã trừ voucher, trong khi các phần
 * bóc tách (theo nhà cung cấp / loại phương tiện / tuyến) chỉ quy được về giá vé. Vì vậy
 * mọi tỷ trọng đều tính trên {@code ticketRevenue} để cộng lại luôn tròn 100%.
 */
public record AnalyticsSummaryResponse(
        String scope,
        String period,
        LocalDate periodStart,
        LocalDate periodEnd,
        String periodLabel,
        boolean fallbackApplied,
        String requestedPeriodLabel,
        boolean hasData,

        BigDecimal totalRevenue,
        BigDecimal ticketRevenue,
        long totalBookings,
        long totalTickets,

        BigDecimal previousRevenue,
        Double revenueGrowthPct,
        long previousBookings,
        Double bookingGrowthPct,
        String previousPeriodLabel,

        List<NamedAmount> revenueByVehicleType,
        List<NamedAmount> revenueByProvider,
        List<RouteAmount> topRoutes,
        List<TrendPoint> trend) {

    /** Doanh thu của một nhóm có tên (nhà cung cấp hoặc loại phương tiện). */
    public record NamedAmount(String name, String type, BigDecimal amount, double sharePct) {
    }

    /** Doanh thu của một tuyến. */
    public record RouteAmount(String origin, String destination, BigDecimal amount, long tickets) {
    }

    /**
     * Một cột của biểu đồ xu hướng.
     *
     * @param bucketStart ngày đầu của ô chia (ngày hoặc tháng, tuỳ kỳ)
     * @param label       nhãn hiển thị sẵn, để giao diện khỏi tự định dạng lại theo múi giờ
     */
    public record TrendPoint(LocalDate bucketStart, String label, BigDecimal amount, long bookings) {
    }
}
