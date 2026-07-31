package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProviderRevenueDTO {
    private Long providerId;
    private String providerName;
    private String providerType;
    private BigDecimal totalRevenue;
}
