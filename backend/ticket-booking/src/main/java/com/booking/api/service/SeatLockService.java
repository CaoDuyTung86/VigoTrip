package com.booking.api.service;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.booking.api.controller.SeatStatusController.SeatStatusUpdate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class SeatLockService {

    private final SimpMessagingTemplate messagingTemplate;

    // Map of seatId -> SeatLock
    private final Map<Long, SeatLock> locks = new ConcurrentHashMap<>();

    private static final int LOCK_TIMEOUT_MINUTES = 10;

    public boolean lockSeat(Long tripId, Long seatId, String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            userId = "anonymous";
        }
        SeatLock existingLock = locks.get(seatId);
        if (existingLock != null && existingLock.getExpiresAt().isAfter(LocalDateTime.now()) && !existingLock.getUserId().equalsIgnoreCase(userId)) {
            // Already locked by someone else
            return false;
        }
        
        // Lock it
        SeatLock newLock = new SeatLock(seatId, tripId, userId, LocalDateTime.now(), LocalDateTime.now().plusMinutes(LOCK_TIMEOUT_MINUTES));
        locks.put(seatId, newLock);
        return true;
    }

    public boolean unlockSeat(Long seatId, String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            userId = "anonymous";
        }
        SeatLock existingLock = locks.get(seatId);
        if (existingLock != null && existingLock.getUserId().equalsIgnoreCase(userId)) {
            locks.remove(seatId);
            return true;
        }
        return false;
    }

    public String getLockedBy(Long seatId) {
        SeatLock existingLock = locks.get(seatId);
        if (existingLock != null && existingLock.getExpiresAt().isAfter(LocalDateTime.now())) {
            return existingLock.getUserId();
        }
        return null;
    }

    @Scheduled(fixedRate = 10000) // Every 10 seconds
    public void releaseExpiredLocks() {
        LocalDateTime now = LocalDateTime.now();
        locks.entrySet().removeIf(entry -> {
            boolean expired = entry.getValue().getExpiresAt().isBefore(now);
            if (expired) {
                // Broadcast release
                SeatStatusUpdate update = new SeatStatusUpdate(
                    entry.getValue().getTripId(), 
                    entry.getValue().getSeatId(), 
                    "AVAILABLE", 
                    null
                );
                messagingTemplate.convertAndSend("/topic/seat-status", update);
            }
            return expired;
        });
    }

    public void removeLockBySeatId(Long seatId) {
        locks.remove(seatId);
    }

    @Data
    @AllArgsConstructor
    public static class SeatLock {
        private Long seatId;
        private Long tripId;
        private String userId;
        private LocalDateTime lockedAt;
        private LocalDateTime expiresAt;
    }
}
