package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class TripSearchResponse {

    private Long id;
    private String origin;
    private String destination;
    private LocalDateTime departureTime;
    private LocalDateTime arrivalTime;
    private BigDecimal price;
    private String vehicleType;
    private Long providerId;
    private String providerName;
    private Integer totalSeats;
    private Integer availableSeats;
}

