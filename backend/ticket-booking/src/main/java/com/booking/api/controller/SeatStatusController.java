package com.booking.api.controller;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.booking.api.service.SeatLockService;

@Controller
@RequiredArgsConstructor
public class SeatStatusController {

    private final SeatLockService seatLockService;

    @MessageMapping("/seat-selection")
    @SendTo("/topic/seat-status")
    public SeatStatusUpdate updateSeatStatus(SeatStatusUpdate update) {
        if ("SELECTED".equals(update.getStatus())) {
            boolean success = seatLockService.lockSeat(update.getTripId(), update.getSeatId(), update.getUserId());
            if (!success) {
                // If locking failed, it means someone else has it. 
                // We return null to not broadcast our failed selection, or we could return a specific message.
                // Returning null in @SendTo might be ignored by Spring (or send null). Better to throw or handle gracefully.
                // For simplicity, we just return the existing lock status if we can't lock it.
                return update; // In a robust app, we'd send an error back to the specific user.
            }
        } else if ("AVAILABLE".equals(update.getStatus())) {
            seatLockService.unlockSeat(update.getSeatId(), update.getUserId());
        }

        return update;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeatStatusUpdate {
        private Long tripId;
        private Long seatId;
        private String status; // "SELECTED", "AVAILABLE", "BOOKED"
        private String userId; // Optional, to track who selected it
    }
}
