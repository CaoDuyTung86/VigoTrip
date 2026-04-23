package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SeatResponse {

    private Long id;
    private String seatNumber;
    private String seatType;
    private boolean booked;
    private String tempLockedBy;
}

