package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private Long id;
    private LocalDateTime bookingDate;
    private Double totalPrice;
    private String status;

    // Trip info
    private String origin;
    private String destination;
    private LocalDateTime departureTime;
    private LocalDateTime arrivalTime;
    private String vehicleType;
    private String providerName;

    // Seats
    private List<String> seatNumbers;

    // Ticket details (passenger name + seat)
    private List<TicketDetail> ticketDetails;

    // Additional services
    private List<String> additionalServices;

    // Refund
    private Double refundAmount;

    // Refund status (for checking pending refund requests)
    private String refundStatus;

    private Boolean isCheckedIn;
    private LocalDateTime checkInDate;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TicketDetail {
        private Long ticketId;
        private String passengerName;
        private String seatNumber;
        private String seatType;
        private Double price;
        private String status;
    }
}
