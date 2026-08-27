package com.booking.api.service;

import com.booking.api.dto.AnalyticsSummaryResponse;
import com.booking.api.entity.User;
import com.booking.api.enums.ReportPeriod;
import com.booking.api.enums.ReportScope;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Báo cáo BI cũ trộn kỳ: tiêu đề ghi "Tháng 8/2026" nhưng top tuyến, doanh thu theo loại
 * phương tiện, top nhà cung cấp và tổng số booking đều lấy ALL-TIME, nên AI kết luận về
 * "tháng này" bằng số liệu từ đầu hệ thống. Đối tác thì xem được doanh thu của mọi hãng
 * vì không có ràng buộc sở hữu nào.
 *
 * Test khoá lại: mọi truy vấn dùng đúng một khoảng thời gian, phạm vi đối tác bị thu hẹp
 * thật, và kỳ trống thì tự lùi kèm cờ báo chứ không trả màn hình trắng.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnalyticsServiceTest {

    private static final String PROVIDER_EMAIL = "provider@gmail.com";
    private static final List<Long> ALL_PROVIDERS = List.of(1L, 2L, 3L);
    private static final List<Long> OWNED = List.of(1L, 2L);

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ProviderRepository providerRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AIService aiService;

    @InjectMocks
    private AnalyticsService analyticsService;

    @Captor
    private ArgumentCaptor<String> promptCaptor;

    @Captor
    private ArgumentCaptor<List<Long>> idsCaptor;

    private void givenNoBreakdowns() {
        when(bookingRepository.findRevenueByProviderInPeriod(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findRevenueByVehicleTypeInPeriod(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findTopRoutesInPeriod(any(), any(), anyList(), any())).thenReturn(List.of());
    }

    private void givenProviderAccount() {
        User user = new User();
        user.setId(9L);
        user.setEmail(PROVIDER_EMAIL);
        when(userRepository.findByEmail(PROVIDER_EMAIL)).thenReturn(Optional.of(user));
        when(providerRepository.findIdsByOwnerUserId(9L)).thenReturn(OWNED);
    }

    private static Object[] bookingRow(long id, LocalDateTime at, double amount) {
        return new Object[] { id, at, BigDecimal.valueOf(amount) };
    }

    @Test
    @DisplayName("Mọi truy vấn bóc tách đều dùng đúng khoảng thời gian của kỳ đang xem")
    void getSummary_moiTruyVanCungMotKy() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(bookingRow(1L, LocalDateTime.of(2026, 8, 10, 9, 0), 1_000_000)));

        analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 15));

        LocalDateTime from = LocalDate.of(2026, 8, 1).atStartOfDay();
        LocalDateTime to = LocalDate.of(2026, 9, 1).atStartOfDay();
        verify(bookingRepository).findRevenueByProviderInPeriod(eq(from), eq(to), eq(ALL_PROVIDERS));
        verify(bookingRepository).findRevenueByVehicleTypeInPeriod(eq(from), eq(to), eq(ALL_PROVIDERS));
        verify(bookingRepository).findTopRoutesInPeriod(eq(from), eq(to), eq(ALL_PROVIDERS), any());
    }

    @Test
    @DisplayName("Kỳ trống thì tự lùi về kỳ gần nhất có dữ liệu và bật cờ báo")
    void getSummary_tuLuiVeKyCoDuLieu() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        LocalDateTime latest = LocalDateTime.of(2026, 8, 20, 8, 0);
        when(bookingRepository.findLatestBookingDate(anyList())).thenReturn(latest);

        LocalDateTime septemberStart = LocalDate.of(2026, 9, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            return from.equals(septemberStart)
                    ? List.of()
                    : List.<Object[]>of(bookingRow(1L, latest, 2_000_000));
        });

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 9, 5));

        assertTrue(s.fallbackApplied());
        assertEquals("Tháng 9/2026", s.requestedPeriodLabel());
        assertEquals("Tháng 8/2026", s.periodLabel());
        assertEquals(LocalDate.of(2026, 8, 1), s.periodStart());
        assertEquals(LocalDate.of(2026, 8, 31), s.periodEnd());
        assertTrue(s.hasData());
    }

    @Test
    @DisplayName("Tăng trưởng so kỳ trước; kỳ trước bằng 0 thì trả null thay vì vô cực")
    void getSummary_tinhTangTruong() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();

        LocalDateTime augustStart = LocalDate.of(2026, 8, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            if (from.equals(augustStart)) {
                return List.<Object[]>of(bookingRow(1L, LocalDateTime.of(2026, 8, 3, 9, 0), 1_500_000));
            }
            // Tháng 7: 1.000.000 -> tăng 50%
            return List.<Object[]>of(bookingRow(2L, LocalDateTime.of(2026, 7, 3, 9, 0), 1_000_000));
        });

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 15));

        assertEquals(0, BigDecimal.valueOf(1_500_000).compareTo(s.totalRevenue()));
        assertEquals(0, BigDecimal.valueOf(1_000_000).compareTo(s.previousRevenue()));
        assertEquals(50.0, s.revenueGrowthPct(), 0.001);
        assertEquals("Tháng 7/2026", s.previousPeriodLabel());
    }

    @Test
    @DisplayName("Kỳ trước không có doanh thu thì không bịa ra phần trăm tăng trưởng")
    void getSummary_kyTruocBangKhong() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        LocalDateTime augustStart = LocalDate.of(2026, 8, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            return from.equals(augustStart)
                    ? List.<Object[]>of(bookingRow(1L, LocalDateTime.of(2026, 8, 3, 9, 0), 1_500_000))
                    : List.of();
        });

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 15));

        assertNull(s.revenueGrowthPct());
    }

    @Test
    @DisplayName("Đối tác chỉ được hỏi số liệu của những hãng mình sở hữu")
    void getSummary_phamViDoiTacBiThuHep() {
        givenProviderAccount();
        givenNoBreakdowns();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findLatestBookingDate(anyList())).thenReturn(null);

        analyticsService.getSummary(ReportScope.PROVIDER, PROVIDER_EMAIL,
                ReportPeriod.QUARTER, LocalDate.of(2026, 8, 15));

        // Quý 3/2026 = 01/07 đến hết 30/09, và chỉ với 2 hãng thuộc sở hữu.
        verify(bookingRepository).findRevenueByProviderInPeriod(
                eq(LocalDate.of(2026, 7, 1).atStartOfDay()),
                eq(LocalDate.of(2026, 10, 1).atStartOfDay()),
                eq(OWNED));
        verify(providerRepository, never()).findAllIds();
    }

    @Test
    @DisplayName("Tài khoản đối tác chưa được gán hãng nào thì trả khung rỗng, không nổ lỗi")
    void getSummary_doiTacChuaSoHuuGi() {
        User user = new User();
        user.setId(9L);
        when(userRepository.findByEmail(PROVIDER_EMAIL)).thenReturn(Optional.of(user));
        when(providerRepository.findIdsByOwnerUserId(9L)).thenReturn(List.of());

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.PROVIDER, PROVIDER_EMAIL,
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 15));

        assertFalse(s.hasData());
        assertEquals(0, BigDecimal.ZERO.compareTo(s.totalRevenue()));
        assertTrue(s.revenueByProvider().isEmpty());
        verify(bookingRepository, never()).findScopedBookingRows(any(), any(), anyList());
    }

    @Test
    @DisplayName("Không có dữ liệu thì không gọi LLM — đỡ tốn ngân sách token")
    void getInsights_khongGoiLlmKhiRong() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findLatestBookingDate(anyList())).thenReturn(null);

        String insights = analyticsService.getInsights(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 9, 5));

        assertTrue(insights.contains("Tháng 9/2026"));
        verify(aiService, never()).getAIAnalysis(any(), any());
    }

    @Test
    @DisplayName("Biểu đồ xu hướng điền đủ mọi ô, kể cả ngày không bán được vé")
    void getSummary_trendDienDuOTrong() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(bookingRow(1L, LocalDateTime.of(2026, 2, 10, 9, 0), 500_000)));

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 2, 15));

        assertEquals(28, s.trend().size(), "Tháng 2/2026 có 28 ngày");
        assertEquals(1, s.trend().stream().filter(p -> p.amount().signum() > 0).count());
    }

    @Test
    @DisplayName("Bản tóm tắt gửi cho AI mang đúng số liệu của kỳ, kèm cảnh báo khi đã tự lùi kỳ")
    void getInsights_promptTrungKhopVoiSoLieu() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        LocalDateTime latest = LocalDateTime.of(2026, 8, 20, 8, 0);
        when(bookingRepository.findLatestBookingDate(anyList())).thenReturn(latest);

        LocalDateTime augustStart = LocalDate.of(2026, 8, 1).atStartOfDay();
        LocalDateTime julyStart = LocalDate.of(2026, 7, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            if (from.equals(augustStart)) {
                return List.<Object[]>of(bookingRow(1L, latest, 1_500_000));
            }
            if (from.equals(julyStart)) {
                return List.<Object[]>of(bookingRow(2L, LocalDateTime.of(2026, 7, 4, 9, 0), 1_000_000));
            }
            return List.of();
        });

        analyticsService.getInsights(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 9, 5));

        verify(aiService).getAIAnalysis(any(), promptCaptor.capture());
        String prompt = promptCaptor.getValue();

        // Đây chính là lỗi cũ: tiêu đề một kỳ, thân bài là số liệu all-time. Prompt phải
        // tự nói rõ đang đọc kỳ nào và vì sao khác kỳ người dùng bấm.
        assertTrue(prompt.contains("Tháng 8/2026"), prompt);
        assertTrue(prompt.contains("Tháng 9/2026"), "Phải nêu kỳ người dùng đã chọn");
        assertTrue(prompt.contains("chưa có giao dịch"), "Phải cảnh báo là số liệu của kỳ khác");
        assertTrue(prompt.contains("1.500.000"), "Doanh thu kỳ này");
        assertTrue(prompt.contains("1.000.000"), "Doanh thu kỳ trước để đối chiếu");
        assertTrue(prompt.contains("+50.0%"), "Tăng trưởng phải tính sẵn, không để AI tự nhẩm");
    }

    @Test
    @DisplayName("Khoản lệch giữa thực thu và tiền vé được bóc thành dịch vụ + giảm giá, khép kín đẳng thức")
    void getSummary_docSoatDichVuVaGiamGia() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        when(bookingRepository.findRevenueByVehicleTypeInPeriod(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findTopRoutesInPeriod(any(), any(), anyList(), any())).thenReturn(List.of());

        LocalDateTime augustStart = LocalDate.of(2026, 8, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            return from.equals(augustStart)
                    ? List.<Object[]>of(
                            bookingRow(17L, LocalDateTime.of(2026, 8, 24, 9, 0), 7_359_650),
                            bookingRow(23L, LocalDateTime.of(2026, 8, 24, 10, 0), 5_944_300))
                    : List.of();
        });
        when(bookingRepository.findRevenueByProviderInPeriod(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(
                        new Object[] { 1L, "Vietnam Airlines", "AIRLINE", BigDecimal.valueOf(13_250_000), 2L }));
        when(bookingRepository.sumServiceRevenueForBookings(anyList()))
                .thenReturn(BigDecimal.valueOf(1_324_000));

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 27));

        // Chỉ hỏi tiền dịch vụ của đúng những đơn đã lọt vào kỳ. Lọc lại theo ngày bằng một
        // mệnh đề WHERE riêng là mở đường cho hai con số lệch nhau khi sửa điều kiện một chỗ.
        verify(bookingRepository).sumServiceRevenueForBookings(idsCaptor.capture());
        assertEquals(List.of(17L, 23L), idsCaptor.getValue());

        assertEquals(0, BigDecimal.valueOf(1_324_000).compareTo(s.serviceRevenue()));
        // 13.250.000 vé + 1.324.000 dịch vụ - 1.270.050 giảm giá = 13.303.950 thực thu
        assertEquals(0, BigDecimal.valueOf(1_270_050).compareTo(s.discountTotal()));
        assertEquals(0, s.ticketRevenue().add(s.serviceRevenue()).subtract(s.discountTotal())
                .compareTo(s.totalRevenue()), "Đẳng thức đối soát phải khép kín");
    }

    @Test
    @DisplayName("Kỳ không có đơn nào thì không hỏi tiền dịch vụ — IN () là cú pháp không hợp lệ")
    void getSummary_khongHoiDichVuKhiKyRong() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        givenNoBreakdowns();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findLatestBookingDate(anyList())).thenReturn(null);

        AnalyticsSummaryResponse s = analyticsService.getSummary(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 9, 5));

        verify(bookingRepository, never()).sumServiceRevenueForBookings(anyList());
        assertEquals(0, BigDecimal.ZERO.compareTo(s.serviceRevenue()));
        assertEquals(0, BigDecimal.ZERO.compareTo(s.discountTotal()));
    }

    @Test
    @DisplayName("Prompt gửi AI mang sẵn đẳng thức đối soát, khỏi để AI tự nhẩm phần lệch")
    void getInsights_promptCoDangThucDoiSoat() {
        when(providerRepository.findAllIds()).thenReturn(ALL_PROVIDERS);
        when(bookingRepository.findRevenueByVehicleTypeInPeriod(any(), any(), anyList())).thenReturn(List.of());
        when(bookingRepository.findTopRoutesInPeriod(any(), any(), anyList(), any())).thenReturn(List.of());
        LocalDateTime augustStart = LocalDate.of(2026, 8, 1).atStartOfDay();
        when(bookingRepository.findScopedBookingRows(any(), any(), anyList())).thenAnswer(inv -> {
            LocalDateTime from = inv.getArgument(0);
            return from.equals(augustStart)
                    ? List.<Object[]>of(bookingRow(3L, LocalDateTime.of(2026, 8, 2, 9, 0), 2_980_000))
                    : List.of();
        });
        when(bookingRepository.findRevenueByProviderInPeriod(any(), any(), anyList()))
                .thenReturn(List.<Object[]>of(
                        new Object[] { 1L, "Phương Trang (FUTA)", "BUS", BigDecimal.valueOf(2_800_000), 1L }));
        when(bookingRepository.sumServiceRevenueForBookings(anyList()))
                .thenReturn(BigDecimal.valueOf(180_000));

        analyticsService.getInsights(ReportScope.SYSTEM, "admin@gmail.com",
                ReportPeriod.MONTH, LocalDate.of(2026, 8, 27));

        verify(aiService).getAIAnalysis(any(), promptCaptor.capture());
        String prompt = promptCaptor.getValue();
        assertTrue(prompt.contains("2.800.000 + 180.000 - 0 = 2.980.000"), prompt);
        assertTrue(prompt.contains("Tiền dịch vụ bổ sung: 180.000"), prompt);
    }
}
