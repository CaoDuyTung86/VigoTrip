package com.booking.api.service;

import com.booking.api.realtime.SeatIdentity;
import com.booking.api.realtime.SeatStatusBroadcaster;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class SeatLockServiceTest {

    private static final Long TRIP_ID = 1L;

    private static final String NGUOI_A = SeatIdentity.ofUser("a@example.com");
    private static final String NGUOI_B = SeatIdentity.ofUser("b@example.com");
    private static final String KHACH = SeatIdentity.ofGuest("sess_1700000000_fake_device");

    @Mock
    private SeatStatusBroadcaster broadcaster;

    @InjectMocks
    private SeatLockService seatLockService;

    @Test
    @DisplayName("Ghế đang được người khác giữ thì không lock được")
    void lockSeat_Fail_WhenHeldByAnotherUser() {
        assertTrue(seatLockService.lockSeat(TRIP_ID, 10L, NGUOI_A));
        assertFalse(seatLockService.lockSeat(TRIP_ID, 10L, NGUOI_B));
        assertEquals(NGUOI_A, seatLockService.getLockedBy(10L));
    }

    @Test
    @DisplayName("Chính chủ lock lại ghế mình đang giữ thì được (gia hạn)")
    void lockSeat_Success_WhenSameUser() {
        assertTrue(seatLockService.lockSeat(TRIP_ID, 11L, NGUOI_A));
        assertTrue(seatLockService.lockSeat(TRIP_ID, 11L, NGUOI_A));
    }

    @Test
    @DisplayName("Không nhả được ghế người khác đang giữ")
    void unlockSeat_Fail_WhenDifferentUser() {
        seatLockService.lockSeat(TRIP_ID, 14L, NGUOI_A);

        assertFalse(seatLockService.unlockSeat(14L, NGUOI_B));
        assertEquals(NGUOI_A, seatLockService.getLockedBy(14L));
    }

    @Test
    @DisplayName("isHeldByOther phân biệt đúng ghế của mình và ghế người khác")
    void isHeldByOther() {
        seatLockService.lockSeat(TRIP_ID, 16L, NGUOI_A);

        assertFalse(seatLockService.isHeldByOther(16L, NGUOI_A));
        assertTrue(seatLockService.isHeldByOther(16L, NGUOI_B));
        assertFalse(seatLockService.isHeldByOther(99L, NGUOI_B), "ghế trống thì không của ai cả");
    }

    /**
     * Nhóm test khoá lại đúng lỗ hổng cũ: danh tính giữ ghế là chuỗi client tự khai, nên
     * một phiên khách gửi userId là email người khác sẽ nhả được ghế của họ.
     *
     * <p>Chặn thật nằm ở tầng trên ({@code StompAuthChannelInterceptor} suy ra danh tính từ
     * JWT, xem {@code StompAuthChannelInterceptorTest}), còn ở đây khoá lại phần hệ quả:
     * hai không gian danh tính không bao giờ đụng nhau, nên dù khách có đặt khoá thiết bị
     * bằng đúng email nạn nhân cũng không chạm được vào ghế của họ.
     */
    @Nested
    @DisplayName("Danh tính khách và danh tính tài khoản không lẫn vào nhau")
    class IdentityIsolation {

        @Test
        @DisplayName("Khách lấy khoá thiết bị trùng email nạn nhân vẫn không nhả được ghế")
        void guestCannotUnlockUserSeat() {
            String nanNhan = SeatIdentity.ofUser("nan.nhan@gmail.com");
            seatLockService.lockSeat(TRIP_ID, 20L, nanNhan);

            String khachMaoDanh = SeatIdentity.ofGuest("sess_nan.nhan@gmail.com");
            assertFalse(seatLockService.unlockSeat(20L, khachMaoDanh));
            assertFalse(seatLockService.lockSeat(TRIP_ID, 20L, khachMaoDanh));
            assertEquals(nanNhan, seatLockService.getLockedBy(20L));
        }

        @Test
        @DisplayName("Email đã chuẩn hoá nên hoa thường không tạo ra hai danh tính khác nhau")
        void identityIsCaseInsensitiveForUsers() {
            seatLockService.lockSeat(TRIP_ID, 21L, SeatIdentity.ofUser("Nguoi.Dung@Gmail.com"));

            assertTrue(seatLockService.unlockSeat(21L, SeatIdentity.ofUser("nguoi.dung@gmail.com")));
            assertNull(seatLockService.getLockedBy(21L));
        }
    }

    @Nested
    @DisplayName("Chuyển chủ ghế khi khách đăng nhập giữa chừng")
    class Handover {

        @Test
        @DisplayName("Chuyển được ghế từ danh tính khách sang tài khoản vừa đăng nhập")
        void transferLock_Success() {
            seatLockService.lockSeat(TRIP_ID, 30L, KHACH);

            assertTrue(seatLockService.transferLock(30L, KHACH, NGUOI_A));
            assertEquals(NGUOI_A, seatLockService.getLockedBy(30L));
        }

        @Test
        @DisplayName("Không chuyển được ghế đang do người khác giữ")
        void transferLock_Fail_WhenHeldBySomeoneElse() {
            seatLockService.lockSeat(TRIP_ID, 31L, NGUOI_B);

            assertFalse(seatLockService.transferLock(31L, KHACH, NGUOI_A));
            assertEquals(NGUOI_B, seatLockService.getLockedBy(31L));
        }

        @Test
        @DisplayName("Không chuyển được ghế chưa ai giữ")
        void transferLock_Fail_WhenSeatFree() {
            assertFalse(seatLockService.transferLock(32L, KHACH, NGUOI_A));
            assertNull(seatLockService.getLockedBy(32L));
        }
    }

    @Test
    @DisplayName("Một danh tính không giữ quá 20 ghế cùng lúc")
    void lockSeat_Fail_WhenIdentityExceedsCap() {
        // Không có trần thì một phiên chỉ cần gửi liên tiếp vài trăm frame là giữ sạch ghế
        // của mọi chuyến trong 10 phút — không cướp được vé của ai, nhưng đủ để không ai
        // đặt được vé nữa.
        for (long seatId = 100L; seatId < 120L; seatId++) {
            assertTrue(seatLockService.lockSeat(TRIP_ID, seatId, NGUOI_A), "ghế " + seatId);
        }

        assertFalse(seatLockService.lockSeat(TRIP_ID, 120L, NGUOI_A));
        // Gia hạn ghế đang giữ vẫn được, vì không làm tăng tổng số ghế đang giữ.
        assertTrue(seatLockService.lockSeat(TRIP_ID, 100L, NGUOI_A));
        // Trần tính theo từng danh tính, không phải trần chung của hệ thống.
        assertTrue(seatLockService.lockSeat(TRIP_ID, 120L, NGUOI_B));
    }
}
