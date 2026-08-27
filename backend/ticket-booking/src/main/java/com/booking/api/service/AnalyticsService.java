package com.booking.api.service;

import com.booking.api.dto.AnalyticsSummaryResponse;
import com.booking.api.dto.AnalyticsSummaryResponse.NamedAmount;
import com.booking.api.dto.AnalyticsSummaryResponse.RouteAmount;
import com.booking.api.dto.AnalyticsSummaryResponse.TrendPoint;
import com.booking.api.enums.ReportPeriod;
import com.booking.api.enums.ReportScope;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Tầng BI: dựng số liệu theo kỳ rồi mới đưa AI viết nhận định.
 *
 * Bản cũ có hai lỗi khiến báo cáo AI không đáng tin:
 *
 * 1. Trộn kỳ. Tiêu đề ghi "BÁO CÁO (Tháng 8/2026)" nhưng chỉ mỗi biểu đồ doanh thu theo
 *    tháng là có lọc; top tuyến, doanh thu theo loại phương tiện, top nhà cung cấp và tổng
 *    số booking đều lấy ALL-TIME. AI đọc vào và kết luận về "tháng này" bằng số liệu từ
 *    đầu hệ thống.
 * 2. Hai nguồn số liệu. Giao diện lấy /api/admin/revenue (doanh thu all-time), nút Phân
 *    tích AI lại tự dựng báo cáo từ bộ truy vấn khác — con số AI nói ra mâu thuẫn được với
 *    biểu đồ ngay bên cạnh.
 *
 * Giờ chỉ còn một đường: {@link #getSummary} dựng {@link AnalyticsSummaryResponse}, giao
 * diện vẽ từ đó, và {@link #getInsights} cũng viết prompt từ đúng đối tượng đó.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private static final int TOP_N = 5;

    private final BookingRepository bookingRepository;
    private final ProviderRepository providerRepository;
    private final UserRepository userRepository;
    private final AIService aiService;

    // ─────────────────────────────────────────────────────────────────────────
    // Số liệu
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AnalyticsSummaryResponse getSummary(ReportScope scope,
                                               String email,
                                               ReportPeriod period,
                                               LocalDate anchor) {
        List<Long> providerIds = resolveProviderIds(scope, email);
        LocalDate requestedAnchor = anchor != null ? anchor : LocalDate.now();
        String requestedLabel = period.label(requestedAnchor);

        if (providerIds.isEmpty()) {
            // Tài khoản đối tác chưa được gán thương hiệu nào. Trả về khung rỗng thay vì ném
            // lỗi: màn hình vẫn dựng được và tự nói ra là chưa có gì để xem.
            return emptySummary(scope, period, requestedAnchor, requestedLabel);
        }

        List<Object[]> rows = scopedBookingRows(period, requestedAnchor, providerIds);

        // Kỳ được chọn trống -> nhảy về kỳ gần nhất CÓ giao dịch và báo rõ, thay vì để
        // người xem đối diện một màn hình trắng không rõ hỏng hay thật sự chưa có ai đặt.
        LocalDate effectiveAnchor = requestedAnchor;
        boolean fallbackApplied = false;
        if (rows.isEmpty()) {
            LocalDateTime latest = bookingRepository.findLatestBookingDate(providerIds);
            if (latest != null && !isWithin(period, requestedAnchor, latest.toLocalDate())) {
                effectiveAnchor = latest.toLocalDate();
                fallbackApplied = true;
                rows = scopedBookingRows(period, effectiveAnchor, providerIds);
            }
        }

        LocalDate periodStart = period.startOf(effectiveAnchor);
        LocalDate periodEnd = period.lastDayOf(effectiveAnchor);

        BigDecimal totalRevenue = sumAmount(rows, 2);
        long totalBookings = rows.size();

        LocalDate previousAnchor = period.previousAnchor(effectiveAnchor);
        List<Object[]> previousRows = scopedBookingRows(period, previousAnchor, providerIds);
        BigDecimal previousRevenue = sumAmount(previousRows, 2);
        long previousBookings = previousRows.size();

        LocalDateTime from = periodStart.atStartOfDay();
        LocalDateTime to = period.endExclusiveOf(effectiveAnchor).atStartOfDay();

        List<Object[]> providerRows = bookingRepository.findRevenueByProviderInPeriod(from, to, providerIds);
        List<Object[]> typeRows = bookingRepository.findRevenueByVehicleTypeInPeriod(from, to, providerIds);
        List<Object[]> routeRows = bookingRepository.findTopRoutesInPeriod(from, to, providerIds,
                PageRequest.of(0, TOP_N));

        BigDecimal ticketRevenue = sumAmount(providerRows, 3);
        long totalTickets = sumCount(providerRows, 4);

        BigDecimal serviceRevenue = sumServiceRevenue(rows);
        BigDecimal discountTotal = ticketRevenue.add(serviceRevenue).subtract(totalRevenue);

        return new AnalyticsSummaryResponse(
                scope.name(),
                period.name(),
                periodStart,
                periodEnd,
                period.label(effectiveAnchor),
                fallbackApplied,
                requestedLabel,
                totalBookings > 0,
                totalRevenue,
                ticketRevenue,
                serviceRevenue,
                discountTotal,
                totalBookings,
                totalTickets,
                previousRevenue,
                growthPct(previousRevenue, totalRevenue),
                previousBookings,
                growthPct(BigDecimal.valueOf(previousBookings), BigDecimal.valueOf(totalBookings)),
                period.label(previousAnchor),
                toNamedAmounts(typeRows, ticketRevenue, 0, 0, 1),
                toNamedAmounts(providerRows, ticketRevenue, 1, 2, 3),
                toRouteAmounts(routeRows),
                buildTrend(period, effectiveAnchor, rows));
    }

    private List<Object[]> scopedBookingRows(ReportPeriod period, LocalDate anchor, List<Long> providerIds) {
        return bookingRepository.findScopedBookingRows(
                period.startOf(anchor).atStartOfDay(),
                period.endExclusiveOf(anchor).atStartOfDay(),
                providerIds);
    }

    private static boolean isWithin(ReportPeriod period, LocalDate anchor, LocalDate date) {
        return !date.isBefore(period.startOf(anchor)) && date.isBefore(period.endExclusiveOf(anchor));
    }

    /**
     * Những nhà cung cấp mà người gọi được phép xem.
     *
     * Admin xem toàn bộ. Tài khoản đối tác chỉ xem đúng các thương hiệu mình sở hữu — trước
     * đây ROLE_PROVIDER đọc được doanh thu của cả đối thủ vì không có ràng buộc nào cả.
     */
    private List<Long> resolveProviderIds(ReportScope scope, String email) {
        if (scope == ReportScope.SYSTEM) {
            return providerRepository.findAllIds();
        }
        return userRepository.findByEmail(email)
                .map(u -> providerRepository.findIdsByOwnerUserId(u.getId()))
                .orElseGet(List::of);
    }

    public List<String> resolveOwnedProviderNames(String email) {
        return userRepository.findByEmail(email)
                .map(u -> providerRepository.findNamesByOwnerUserId(u.getId()))
                .orElseGet(List::of);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Nhận định AI — đọc đúng đối tượng số liệu mà giao diện đang vẽ
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public String getInsights(ReportScope scope, String email, ReportPeriod period, LocalDate anchor) {
        AnalyticsSummaryResponse s = getSummary(scope, email, period, anchor);

        if (!s.hasData()) {
            // Không gọi LLM khi không có gì để phân tích: vừa tốn ngân sách token vừa chỉ
            // nhận lại được một đoạn văn chung chung.
            return "Chưa có giao dịch nào trong " + s.requestedPeriodLabel()
                    + " để phân tích. Hãy chọn kỳ khác hoặc quay lại sau khi có đơn đặt vé.";
        }

        return aiService.getAIAnalysis(systemInstruction(scope), buildReport(scope, s));
    }

    private String buildReport(ReportScope scope, AnalyticsSummaryResponse s) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        StringBuilder r = new StringBuilder();
        r.append(scope == ReportScope.SYSTEM
                ? "BÁO CÁO TỔNG QUAN HỆ THỐNG VIGOTRIP\n"
                : "BÁO CÁO KINH DOANH ĐỐI TÁC VIGOTRIP\n");
        r.append("Kỳ báo cáo: ").append(s.periodLabel())
                .append(" (").append(s.periodStart()).append(" đến ").append(s.periodEnd()).append(")\n");
        if (s.fallbackApplied()) {
            r.append("LƯU Ý: người dùng chọn ").append(s.requestedPeriodLabel())
                    .append(" nhưng kỳ đó chưa có giao dịch, số liệu dưới đây là của ")
                    .append(s.periodLabel()).append(".\n");
        }
        r.append('\n');

        r.append("TỔNG QUAN:\n");
        r.append("- Doanh thu thực thu: ").append(df.format(s.totalRevenue())).append(" VND\n");
        r.append("- Doanh thu vé (dùng để bóc tách bên dưới): ")
                .append(df.format(s.ticketRevenue())).append(" VND\n");
        r.append("- Tiền dịch vụ bổ sung: ").append(df.format(s.serviceRevenue())).append(" VND\n");
        r.append(s.discountTotal().signum() >= 0
                        ? "- Giảm giá hạng thành viên & voucher: -"
                        : "- Điều chỉnh (vé huỷ lẻ đã hoàn): +")
                .append(df.format(s.discountTotal().abs())).append(" VND\n");
        r.append("- Đẳng thức đối soát: ").append(df.format(s.ticketRevenue()))
                .append(" + ").append(df.format(s.serviceRevenue()))
                .append(s.discountTotal().signum() >= 0 ? " - " : " + ")
                .append(df.format(s.discountTotal().abs()))
                .append(" = ").append(df.format(s.totalRevenue())).append(" VND\n");
        r.append("- Số đơn đặt vé: ").append(s.totalBookings())
                .append(" đơn / ").append(s.totalTickets()).append(" vé\n");
        r.append("- Kỳ liền trước (").append(s.previousPeriodLabel()).append("): ")
                .append(df.format(s.previousRevenue())).append(" VND, ")
                .append(s.previousBookings()).append(" đơn\n");
        r.append("- Tăng trưởng doanh thu: ").append(formatGrowth(s.revenueGrowthPct())).append('\n');
        r.append("- Tăng trưởng số đơn: ").append(formatGrowth(s.bookingGrowthPct())).append("\n\n");

        appendNamed(r, df, "DOANH THU THEO LOẠI PHƯƠNG TIỆN", s.revenueByVehicleType());
        appendNamed(r, df, scope == ReportScope.SYSTEM
                ? "DOANH THU THEO NHÀ CUNG CẤP"
                : "DOANH THU THEO THƯƠNG HIỆU BẠN VẬN HÀNH", s.revenueByProvider());

        if (!s.topRoutes().isEmpty()) {
            r.append("TOP TUYẾN HIỆU QUẢ NHẤT:\n");
            for (RouteAmount route : s.topRoutes()) {
                r.append("- ").append(route.origin()).append(" -> ").append(route.destination())
                        .append(": ").append(df.format(route.amount())).append(" VND (")
                        .append(route.tickets()).append(" vé)\n");
            }
            r.append('\n');
        }

        r.append("GHI CHÚ ĐỌC SỐ: doanh thu thực thu gồm cả dịch vụ cộng thêm và đã trừ voucher, ")
                .append("nên luôn lệch so với doanh thu vé — phần lệch đã được bóc rõ ở đẳng thức đối ")
                .append("soát bên trên, KHÔNG được gọi đó là sai số hay lỗi làm tròn. Mọi tỷ trọng đã ")
                .append("tính trên doanh thu vé, vì dịch vụ bổ sung không quy được về từng hãng hay ")
                .append("từng tuyến.\n");
        return r.toString();
    }

    private static void appendNamed(StringBuilder r, DecimalFormat df, String title, List<NamedAmount> items) {
        if (items.isEmpty()) {
            return;
        }
        r.append(title).append(":\n");
        for (NamedAmount item : items) {
            r.append("- ").append(item.name());
            if (item.type() != null && !item.type().isBlank()) {
                r.append(" (").append(item.type()).append(')');
            }
            r.append(": ").append(df.format(item.amount()))
                    .append(" VND (").append(String.format(Locale.US, "%.1f", item.sharePct())).append("%)\n");
        }
        r.append('\n');
    }

    private static String formatGrowth(Double pct) {
        if (pct == null) {
            return "không so sánh được (kỳ trước không có doanh thu)";
        }
        return String.format(Locale.US, "%+.1f%%", pct);
    }

    private String systemInstruction(ReportScope scope) {
        String common = "Ngôn ngữ: Tiếng Việt. Ngắn gọn, dùng Markdown (##, -, **bold**). "
                + "Không dùng từ hoa mỹ. TUYỆT ĐỐI chỉ dùng con số có trong dữ liệu được cung cấp, "
                + "không tự suy ra số liệu mới. Nếu dữ liệu quá ít để kết luận, hãy nói thẳng là "
                + "chưa đủ dữ liệu thay vì suy đoán.";

        if (scope == ReportScope.SYSTEM) {
            return "Bạn là chuyên gia phân tích kinh doanh của VigoTrip. Viết báo cáo gồm 4 phần:\n"
                    + "## 1. Tổng quan doanh thu & tăng trưởng so với kỳ trước\n"
                    + "## 2. Hiệu suất theo loại phương tiện & nhà cung cấp\n"
                    + "## 3. Điểm sáng & rủi ro\n"
                    + "## 4. 3 hành động cụ thể cho kỳ tới\n" + common;
        }
        return "Bạn là chuyên gia phân tích kinh doanh, đang tư vấn cho MỘT đối tác vận tải của "
                + "VigoTrip về chính hoạt động của họ. Viết báo cáo gồm 3 phần:\n"
                + "## 1. Kết quả kinh doanh kỳ này so với kỳ trước\n"
                + "## 2. Tuyến và loại phương tiện đang hiệu quả nhất\n"
                + "## 3. 3 đề xuất cụ thể để tăng doanh thu\n"
                + "Không nhắc tới số liệu của đối tác khác. " + common;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tiện ích
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Biểu đồ xu hướng trong kỳ, đã điền sẵn mọi ô kể cả ô bằng 0.
     *
     * Nếu chỉ trả về những ngày có giao dịch thì đường biểu diễn sẽ nối thẳng qua các ngày
     * trống và trông như thể ngày nào cũng bán được vé.
     */
    private List<TrendPoint> buildTrend(ReportPeriod period, LocalDate anchor, List<Object[]> rows) {
        boolean byDay = period.trendBucket() == ReportPeriod.TrendBucket.DAY;
        LocalDate start = period.startOf(anchor);
        LocalDate endExclusive = period.endExclusiveOf(anchor);

        Map<LocalDate, BigDecimal> amounts = new LinkedHashMap<>();
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        for (LocalDate d = start; d.isBefore(endExclusive); d = byDay ? d.plusDays(1) : d.plusMonths(1)) {
            amounts.put(d, BigDecimal.ZERO);
            counts.put(d, 0L);
        }

        for (Object[] row : rows) {
            LocalDateTime bookedAt = (LocalDateTime) row[1];
            if (bookedAt == null) {
                continue;
            }
            LocalDate bucket = byDay ? bookedAt.toLocalDate() : bookedAt.toLocalDate().withDayOfMonth(1);
            if (!amounts.containsKey(bucket)) {
                continue;
            }
            amounts.merge(bucket, toBigDecimal(row[2]), BigDecimal::add);
            counts.merge(bucket, 1L, Long::sum);
        }

        List<TrendPoint> trend = new ArrayList<>(amounts.size());
        amounts.forEach((bucket, amount) -> trend.add(new TrendPoint(
                bucket,
                byDay ? bucket.getDayOfMonth() + "/" + bucket.getMonthValue() : "Th " + bucket.getMonthValue(),
                amount,
                counts.getOrDefault(bucket, 0L))));
        return trend;
    }

    private static List<NamedAmount> toNamedAmounts(List<Object[]> rows, BigDecimal total,
                                                    int nameIdx, int typeIdx, int amountIdx) {
        List<NamedAmount> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            BigDecimal amount = toBigDecimal(row[amountIdx]);
            result.add(new NamedAmount(
                    String.valueOf(row[nameIdx]),
                    typeIdx == nameIdx ? null : String.valueOf(row[typeIdx]),
                    amount,
                    sharePct(amount, total)));
        }
        return result;
    }

    private static List<RouteAmount> toRouteAmounts(List<Object[]> rows) {
        List<RouteAmount> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new RouteAmount(
                    String.valueOf(row[0]),
                    String.valueOf(row[1]),
                    toBigDecimal(row[2]),
                    row[3] != null ? ((Number) row[3]).longValue() : 0L));
        }
        return result;
    }

    /**
     * Tiền dịch vụ bổ sung của đúng những đơn đã lọt vào kỳ.
     *
     * Danh sách rỗng thì trả 0 mà không hỏi cơ sở dữ liệu: {@code IN ()} là cú pháp không
     * hợp lệ ở PostgreSQL, để rơi xuống truy vấn sẽ nổ ngay ở kỳ chưa có đơn nào.
     */
    private BigDecimal sumServiceRevenue(List<Object[]> bookingRows) {
        List<Long> ids = new ArrayList<>(bookingRows.size());
        for (Object[] row : bookingRows) {
            if (row[0] != null) {
                ids.add(((Number) row[0]).longValue());
            }
        }
        if (ids.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = bookingRepository.sumServiceRevenueForBookings(ids);
        return total != null ? total : BigDecimal.ZERO;
    }

    private static BigDecimal sumAmount(List<Object[]> rows, int idx) {
        BigDecimal total = BigDecimal.ZERO;
        for (Object[] row : rows) {
            total = total.add(toBigDecimal(row[idx]));
        }
        return total;
    }

    private static long sumCount(List<Object[]> rows, int idx) {
        long total = 0;
        for (Object[] row : rows) {
            if (row[idx] != null) {
                total += ((Number) row[idx]).longValue();
            }
        }
        return total;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bd) {
            return bd;
        }
        return BigDecimal.valueOf(((Number) value).doubleValue());
    }

    private static double sharePct(BigDecimal amount, BigDecimal total) {
        if (total == null || total.signum() == 0) {
            return 0d;
        }
        return amount.multiply(BigDecimal.valueOf(100))
                .divide(total, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    /** {@code null} khi kỳ trước bằng 0 — chia cho 0 thì mọi thứ đều là "tăng vô hạn", vô nghĩa. */
    private static Double growthPct(BigDecimal previous, BigDecimal current) {
        if (previous == null || previous.signum() == 0) {
            return null;
        }
        return current.subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static AnalyticsSummaryResponse emptySummary(ReportScope scope, ReportPeriod period,
                                                         LocalDate anchor, String requestedLabel) {
        return new AnalyticsSummaryResponse(
                scope.name(), period.name(),
                period.startOf(anchor), period.lastDayOf(anchor),
                requestedLabel, false, requestedLabel, false,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L, 0L,
                BigDecimal.ZERO, null, 0L, null, period.label(period.previousAnchor(anchor)),
                List.of(), List.of(), List.of(), List.of());
    }
}
