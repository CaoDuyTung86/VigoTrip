package com.booking.api.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class SeatLockServiceTest {

    private static final Long TRIP_ID = 1L;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private SeatLockService seatLockService;

    @Test
    @DisplayName("Ghế đang được người khác giữ thì không lock được")
    void lockSeat_Fail_WhenHeldByAnotherUser() {
        assertTrue(seatLockService.lockSeat(TRIP_ID, 10L, "a@example.com"));
        assertFalse(seatLockService.lockSeat(TRIP_ID, 10L, "b@example.com"));
        assertEquals("a@example.com", seatLockService.getLockedBy(10L));
    }

    @Test
    @DisplayName("Chính chủ lock lại ghế mình đang giữ thì được (gia hạn)")
    void lockSeat_Success_WhenSameUser() {
        assertTrue(seatLockService.lockSeat(TRIP_ID, 11L, "a@example.com"));
        assertTrue(seatLockService.lockSeat(TRIP_ID, 11L, "a@example.com"));
    }

    @Test
    @DisplayName("Danh tính lệch hoa thường vẫn là cùng một người")
    void lockSeat_Success_WhenSameUserDifferentCase() {
        assertTrue(seatLockService.lockSeat(TRIP_ID, 12L, "Nguoi.Dung@Gmail.com"));
        assertTrue(seatLockService.lockSeat(TRIP_ID, 12L, "nguoi.dung@gmail.com"));
    }

    @Test
    @DisplayName("Nhả được ghế của mình kể cả khi email lệch hoa thường")
    void unlockSeat_Success_WhenEmailCaseDiffers() {
        seatLockService.lockSeat(TRIP_ID, 13L, "Nguoi.Dung@Gmail.com");

        assertTrue(seatLockService.unlockSeat(13L, "nguoi.dung@gmail.com"));
        assertNull(seatLockService.getLockedBy(13L));
    }

    @Test
    @DisplayName("Không nhả được ghế người khác đang giữ")
    void unlockSeat_Fail_WhenDifferentUser() {
        seatLockService.lockSeat(TRIP_ID, 14L, "a@example.com");

        assertFalse(seatLockService.unlockSeat(14L, "b@example.com"));
        assertEquals("a@example.com", seatLockService.getLockedBy(14L));
    }

    @Test
    @DisplayName("Đổi danh tính giữa chừng: nhả bằng khoá cũ rồi giữ lại bằng email")
    void rekeyLock_Success_WhenGuestLogsIn() {
        String deviceKey = "sess_1786867631410_1hhgv221d13leu";
        assertTrue(seatLockService.lockSeat(TRIP_ID, 15L, deviceKey));

        // Đúng thứ tự mà useSeatLockRekey ở frontend thực hiện sau khi người dùng đăng nhập
        assertTrue(seatLockService.unlockSeat(15L, deviceKey));
        assertTrue(seatLockService.lockSeat(TRIP_ID, 15L, "nguoi.dung@gmail.com"));

        assertEquals("nguoi.dung@gmail.com", seatLockService.getLockedBy(15L));
    }
}
