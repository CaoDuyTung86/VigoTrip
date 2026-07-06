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
                update.setStatus("LOCK_FAILED");
                return update; 
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
        private String status; 
        private String userId; 
    }
}
