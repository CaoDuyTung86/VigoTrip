package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class TripCalendarPriceResponse {

    private LocalDate date;
    private BigDecimal minPrice;
    private boolean available;
}

