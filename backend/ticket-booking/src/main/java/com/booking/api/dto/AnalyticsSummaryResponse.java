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
 * @param serviceRevenue  tổng tiền DỊCH VỤ BỔ SUNG của các đơn trong kỳ
 * @param discountTotal   phần chênh còn lại: giảm giá hạng thành viên + voucher
 * @param fallbackApplied kỳ được yêu cầu không có giao dịch nên đã tự lùi về kỳ gần nhất có dữ liệu
 *
 * <p>{@code totalRevenue} và {@code ticketRevenue} lệch nhau là bình thường, không phải lỗi
 * làm tròn: tiền thực thu còn gồm dịch vụ cộng thêm và đã trừ voucher, trong khi các phần
 * bóc tách (theo nhà cung cấp / loại phương tiện / tuyến) chỉ quy được về giá vé. Vì vậy
 * mọi tỷ trọng đều tính trên {@code ticketRevenue} để cộng lại luôn tròn 100%.
 *
 * <p>Trước đây khoản lệch đó nằm im, người xem thấy hai con số cạnh nhau mà không có gì
 * giải thích. Nay nó được bóc thành đẳng thức đóng:
 *
 * <pre>ticketRevenue + serviceRevenue - discountTotal = totalRevenue</pre>
 *
 * <p>{@code discountTotal} là số DẪN XUẤT chứ không phải cộng từ một cột giảm giá nào —
 * hệ thống không lưu lại số tiền đã giảm của từng đơn, chỉ lưu tổng tiền sau khi giảm.
 * Hệ quả cần biết: nếu một đơn bị huỷ lẻ vài vé thì {@code ticketRevenue} tụt đi (truy vấn
 * đã loại vé CANCELLED) trong khi {@code totalRevenue} giữ nguyên, nên phần tiền vé đã hoàn
 * cũng rơi vào đây và {@code discountTotal} có thể âm. Âm nghĩa là "thu nhiều hơn giá trị
 * hàng còn hiệu lực", không phải lỗi tính toán.
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
        BigDecimal serviceRevenue,
        BigDecimal discountTotal,
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
