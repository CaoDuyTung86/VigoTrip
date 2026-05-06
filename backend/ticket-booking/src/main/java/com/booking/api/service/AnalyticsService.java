package com.booking.api.service;

import com.booking.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final BookingRepository bookingRepository;
    private final AIService aiService;

    @Transactional(readOnly = true)
    public String getProviderAIInsights(Long providerId) {
        // 1. Lấy dữ liệu doanh thu theo tháng
        List<Object[]> monthlyData = bookingRepository.getMonthlyRevenueByProvider(providerId);
        // 2. Lấy dữ liệu Top tuyến đường
        List<Object[]> routeData = bookingRepository.getTopRoutesByProvider(providerId);

        if (monthlyData.isEmpty() && routeData.isEmpty()) {
            return "Hiện chưa có đủ dữ liệu giao dịch để AI thực hiện phân tích chuyên sâu.";
        }

        // 3. Định dạng dữ liệu thành văn bản để gửi cho AI
        StringBuilder reportBuilder = new StringBuilder();
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        reportBuilder.append("BÁO CÁO DOANH THU NĂM 2026:\n");
        for (Object[] row : monthlyData) {
            reportBuilder.append(String.format("- Tháng %s: %s VND\n", row[0], df.format(row[1])));
        }

        reportBuilder.append("\nTOP 5 TUYẾN ĐƯỜNG HIỆU QUẢ NHẤT:\n");
        int count = 0;
        for (Object[] row : routeData) {
            if (count++ >= 5) break;
            reportBuilder.append(String.format("- %s -> %s: %s VND\n", row[0], row[1], df.format(row[2])));
        }

        // 4. Gọi AI để phân tích
        String systemInstruction = "Bạn là chuyên gia phân tích dữ liệu kinh doanh vận tải. " +
                "Dưới đây là báo cáo doanh thu của một nhà cung cấp dịch vụ trên Datxe.com. " +
                "Hãy phân tích ngắn gọn, chỉ ra xu hướng, điểm mạnh, điểm yếu và đưa ra 3 lời khuyên kinh doanh cụ thể để tăng doanh thu tháng tới. " +
                "Ngôn ngữ: Tiếng Việt. Phong cách: Chuyên nghiệp, súc tích.";

        return aiService.getAIAnalysis(systemInstruction, reportBuilder.toString());
    }
}
