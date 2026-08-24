package com.booking.api.controller;

import com.booking.api.dto.AnalyticsSummaryResponse;
import com.booking.api.enums.ReportPeriod;
import com.booking.api.enums.ReportScope;
import com.booking.api.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * API cho màn hình BI.
 *
 * Phân quyền nằm ở đây chứ không ở SecurityConfig vì nó phụ thuộc THAM SỐ chứ không phụ
 * thuộc đường dẫn: cùng một URL, admin gọi được scope=SYSTEM còn đối tác thì không.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /** Số liệu có cấu trúc để giao diện vẽ biểu đồ. */
    @GetMapping("/summary")
    public ResponseEntity<AnalyticsSummaryResponse> getSummary(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "SYSTEM") ReportScope scope,
            @RequestParam(defaultValue = "MONTH") ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate anchor) {
        ReportScope effective = enforceScope(userDetails, scope);
        return ResponseEntity.ok(
                analyticsService.getSummary(effective, userDetails.getUsername(), period, resolveAnchor(anchor)));
    }

    /** Nhận định AI, viết từ đúng bộ số liệu mà /summary trả về. */
    @GetMapping("/insights")
    public ResponseEntity<Map<String, String>> getInsights(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "SYSTEM") ReportScope scope,
            @RequestParam(defaultValue = "MONTH") ReportPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate anchor) {
        ReportScope effective = enforceScope(userDetails, scope);
        String insights = analyticsService.getInsights(
                effective, userDetails.getUsername(), period, resolveAnchor(anchor));
        return ResponseEntity.ok(Map.of("insights", insights));
    }

    /**
     * Người đang đăng nhập được xem những gì — để giao diện biết có nên hiện bộ chuyển
     * "Toàn hệ thống / Của tôi" hay không, thay vì gọi thử rồi ăn 403.
     */
    @GetMapping("/scope")
    public ResponseEntity<Map<String, Object>> getScope(@AuthenticationPrincipal UserDetails userDetails) {
        boolean admin = isAdmin(userDetails);
        List<String> owned = analyticsService.resolveOwnedProviderNames(userDetails.getUsername());
        return ResponseEntity.ok(Map.of(
                "admin", admin,
                "canViewSystem", admin,
                "ownedProviders", owned));
    }

    /** Mặc định xem kỳ chứa ngày hôm nay. */
    private static LocalDate resolveAnchor(LocalDate anchor) {
        return anchor != null ? anchor : LocalDate.now();
    }

    /**
     * Đối tác hỏi scope=SYSTEM thì từ chối thẳng chứ không âm thầm hạ xuống PROVIDER: hạ
     * ngầm sẽ khiến họ tưởng con số đang xem là của toàn hệ thống.
     */
    private ReportScope enforceScope(UserDetails userDetails, ReportScope requested) {
        if (requested == ReportScope.SYSTEM && !isAdmin(userDetails)) {
            throw new AccessDeniedException("Tài khoản đối tác chỉ xem được số liệu của chính mình.");
        }
        return requested;
    }

    private static boolean isAdmin(UserDetails userDetails) {
        return userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> "ROLE_ADMIN".equals(a) || "ADMIN".equals(a));
    }
}
