package com.booking.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdminDTO {

    @Data
    public static class RouteRequest {
        private String origin;
        private String destination;
    }

    @Data
    public static class ProviderRequest {
        private String providerName;
        private String providerType; // BUS, TRAIN, FLIGHT
        private String contactInfo;
    }

    @Data
    public static class VehicleRequest {
        private String vehicleType;
        private Integer totalSeats;
        private Long providerId;
    }

    @Data
    public static class TripRequest {
        private Long routeId;
        private Long vehicleId;
        private LocalDateTime departureTime;
        private LocalDateTime arrivalTime;
        private BigDecimal price;
        private String status;
    }
}
