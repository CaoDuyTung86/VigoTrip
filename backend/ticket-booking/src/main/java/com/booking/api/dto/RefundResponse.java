package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundResponse {

    private Long id;
    private Long bookingId;
    private String userName;
    private String origin;
    private String destination;
    private String vehicleType;
    private String providerName;
    private BigDecimal totalPrice;
    private BigDecimal refundAmount;
    private String reason;
    private String status;
    private String providerNote;
    private LocalDateTime requestedAt;
    private LocalDateTime refundDate;
}
