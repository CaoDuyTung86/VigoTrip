package com.booking.api.controller;

import com.booking.api.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/provider/{providerId}/ai-insights")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROVIDER')")
    public ResponseEntity<Map<String, String>> getProviderAIInsights(@PathVariable Long providerId) {
        String insights = analyticsService.getProviderAIInsights(providerId);
        return ResponseEntity.ok(Map.of("insights", insights));
    }

    @GetMapping("/system/ai-insights")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ADMIN')")
    public ResponseEntity<Map<String, String>> getSystemAIInsights() {
        String insights = analyticsService.getSystemAIInsights();
        return ResponseEntity.ok(Map.of("insights", insights));
    }
}
