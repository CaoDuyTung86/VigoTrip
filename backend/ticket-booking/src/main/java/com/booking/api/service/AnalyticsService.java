package com.booking.api.service;

import com.booking.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final BookingRepository bookingRepository;
    private final AIService aiService;

    @Transactional(readOnly = true)
    public String getProviderAIInsights(Long providerId) {
        return getProviderAIInsights(providerId, null, null);
    }

    @Transactional(readOnly = true)
    public String getProviderAIInsights(Long providerId, Integer year, Integer month) {
        int targetYear = year != null ? year : LocalDateTime.now().getYear();
        List<Object[]> monthlyData = bookingRepository.getMonthlyRevenueByProviderFiltered(providerId, targetYear, month);
        List<Object[]> routeData = bookingRepository.getTopRoutesByProvider(providerId);

        if (monthlyData.isEmpty() && routeData.isEmpty()) {
            return "Hiện chưa có đủ dữ liệu giao dịch để AI thực hiện phân tích chuyên sâu cho khoảng thời gian này.";
        }

        StringBuilder reportBuilder = new StringBuilder();
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        double totalProviderRevenue = 0;
        String filterPeriod = month != null ? String.format("Tháng %d/%d", month, targetYear) : String.format("Năm %d", targetYear);
        reportBuilder.append(String.format("BÁO CÁO DOANH THU THỐNG KÊ (%s):\n", filterPeriod));

        for (Object[] row : monthlyData) {
            double monthRev = row[1] != null ? ((Number) row[1]).doubleValue() : 0.0;
            totalProviderRevenue += monthRev;
            reportBuilder.append(String.format("- Tháng %s: %s VND\n", row[0], df.format(monthRev)));
        }
        reportBuilder.append(String.format("TỔNG DOANH THU: %s VND\n\n", df.format(totalProviderRevenue)));

        reportBuilder.append("TOP TUYẾN ĐƯỜNG HIỆU QUẢ NHẤT:\n");
        int count = 0;
        for (Object[] row : routeData) {
            if (count++ >= 5) break;
            double routeRev = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
            reportBuilder.append(String.format("- %s -> %s: %s VND\n", row[0], row[1], df.format(routeRev)));
        }

        String systemInstruction = "Bạn là chuyên gia phân tích dữ liệu kinh doanh (Chief BI Analyst) vận tải hành khách của Datxe.com. " +
                "Dữ liệu SQL Aggregation đã được tổng hợp từ cơ sở dữ liệu (Bảng dat_ve, ve, chuyen_di, tuyen_duong, nha_cung_cap). " +
                "Hãy phân tích gồm: (1) Nhận định tổng quan tình hình doanh thu, (2) Điểm sáng từ các tuyến đường hot, " +
                "(3) 3 đề xuất hành động cụ thể để tối ưu doanh thu trong kỳ tiếp theo. " +
                "Ngôn ngữ: Tiếng Việt. Phong cách: Chuyên nghiệp, súc tích, dùng định dạng Markdown.";

        return aiService.getAIAnalysis(systemInstruction, reportBuilder.toString());
    }

    @Transactional(readOnly = true)
    public String getSystemAIInsights() {
        return getSystemAIInsights(null, null);
    }

    @Transactional(readOnly = true)
    public String getSystemAIInsights(Integer year, Integer month) {
        int targetYear = year != null ? year : LocalDateTime.now().getYear();
        List<Object[]> monthlyData = bookingRepository.getMonthlyRevenueSystemFiltered(targetYear, month);
        List<Object[]> typeData = bookingRepository.getRevenueByVehicleTypeSystem();

        long totalBookings = bookingRepository.count();
        List<Object[]> topRoutes = bookingRepository.getTopSystemRoutes();
        List<Object[]> providerRevenues = bookingRepository.getTopProviderRevenues();

        StringBuilder reportBuilder = new StringBuilder();
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        String filterPeriod = month != null ? String.format("Tháng %d/%d", month, targetYear) : String.format("Năm %d", targetYear);

        reportBuilder.append(String.format("BÁO CÁO TỔNG QUAN HE THONG DATXE.COM (%s):\n\n", filterPeriod));
        reportBuilder.append(String.format("TỔNG SỐ BOOKING TOÀN HỆ THỐNG: %d đặt chỗ\n\n", totalBookings));

        double totalSystem = 0;
        if (!monthlyData.isEmpty()) {
            reportBuilder.append("DOANH THU THEO THÁNG:\n");
            for (Object[] row : monthlyData) {
                double monthRevenue = row[1] != null ? ((Number) row[1]).doubleValue() : 0.0;
                totalSystem += monthRevenue;
                reportBuilder.append(String.format("- Tháng %s: %s VND\n", row[0], df.format(monthRevenue)));
            }
            reportBuilder.append(String.format("TỔNG DOANH THU: %s VND\n\n", df.format(totalSystem)));
        }

        if (!typeData.isEmpty()) {
            reportBuilder.append("DOANH THU THEO LOẠI PHƯƠNG TIỆN:\n");
            for (Object[] row : typeData) {
                String type = String.valueOf(row[0]);
                double rev = row[1] != null ? ((Number) row[1]).doubleValue() : 0.0;
                double pct = totalSystem > 0 ? (rev / totalSystem) * 100 : 100;
                reportBuilder.append(String.format("- %s: %s VND (%.1f%% thị phần)\n", type, df.format(rev), pct));
            }
            reportBuilder.append("\n");
        }

        if (!topRoutes.isEmpty()) {
            reportBuilder.append("TOP 5 TUYẾN ĐƯỜNG HOT NHẤT:\n");
            int i = 0;
            for (Object[] row : topRoutes) {
                if (i++ >= 5) break;
                double routeRev = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
                reportBuilder.append(String.format("- %s -> %s: %s VND\n", row[0], row[1], df.format(routeRev)));
            }
            reportBuilder.append("\n");
        }

        if (!providerRevenues.isEmpty()) {
            reportBuilder.append("TOP 5 NHÀ CUNG CẤP DOANH THU CAO NHẤT:\n");
            int i = 0;
            for (Object[] row : providerRevenues) {
                if (i++ >= 5) break;
                double provRev = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
                reportBuilder.append(String.format("- %s (%s): %s VND\n", row[0], row[1], df.format(provRev)));
            }
        }

        String systemInstruction = "Bạn là Giám đốc phân tích kinh doanh (Chief BI Officer) của nền tảng đặt vé Datxe.com. " +
                "Dữ liệu được trích xuất từ câu lệnh SQL Aggregation chuyên sâu trên hệ thống SQL Server. " +
                "Hãy viết báo cáo điều hành (Executive Summary) gồm:\n" +
                "## 1. Tổng quan tình hình doanh thu & tăng trưởng\n" +
                "## 2. Phân tích hiệu suất từng loại phương tiện & Nhà cung cấp\n" +
                "## 3. Điểm sáng & Cơ hội mở rộng\n" +
                "## 4. 3 Chiến lược đề xuất để tăng trưởng trong kỳ tới\n" +
                "Ngôn ngữ: Tiếng Việt. Dùng Markdown formatting (##, -, **bold**). Chuyên nghiệp và súc tích.";

        return aiService.getAIAnalysis(systemInstruction, reportBuilder.toString());
    }
}
