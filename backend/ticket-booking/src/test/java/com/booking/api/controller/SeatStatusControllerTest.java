package com.booking.api.controller;

import com.booking.api.realtime.SeatIdentity;
import com.booking.api.realtime.SeatStatusBroadcaster;
import com.booking.api.security.StompPrincipal;
import com.booking.api.service.SeatLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Kiểm chứng rằng đầu vào WebSocket lấy danh tính từ phiên (Principal do
 * {@code StompAuthChannelInterceptor} cấp) chứ không từ thân thông điệp.
 *
 * <p>Dùng {@link SeatLockService} thật thay vì mock: điều cần khoá lại ở đây là hệ quả trên
 * trạng thái lock, không phải việc controller có gọi đúng phương thức nào hay không.
 */
@ExtendWith(MockitoExtension.class)
class SeatStatusControllerTest {

    private static final Long TRIP_ID = 7L;
    private static final Long SEAT_ID = 42L;
    private static final String DEVICE_KEY = "sess_1700000000_fake_device";

    private static final StompPrincipal NAN_NHAN =
            new StompPrincipal(SeatIdentity.ofUser("nan.nhan@gmail.com"), "sess_nan_nhan");
    private static final StompPrincipal KE_TAN_CONG =
            new StompPrincipal(SeatIdentity.ofGuest("sess_ke_tan_cong"), "sess_ke_tan_cong");

    @Mock
    private SeatStatusBroadcaster broadcaster;

    private SeatLockService seatLockService;
    private SeatStatusController controller;

    @BeforeEach
    void setUp() {
        seatLockService = new SeatLockService(broadcaster);
        controller = new SeatStatusController(seatLockService, broadcaster);
    }

    private SeatStatusController.SeatSelectionCommand command(Long seatId, String status) {
        SeatStatusController.SeatSelectionCommand cmd = new SeatStatusController.SeatSelectionCommand();
        cmd.setTripId(TRIP_ID);
        cmd.setSeatId(seatId);
        cmd.setStatus(status);
        return cmd;
    }

    @Test
    @DisplayName("Giữ ghế thành công thì phát trên kênh riêng của chuyến")
    void lockSeat_BroadcastsOnTripTopic() {
        controller.updateSeatStatus(command(SEAT_ID, "SELECTED"), NAN_NHAN);

        assertEquals(NAN_NHAN.getName(), seatLockService.getLockedBy(SEAT_ID));
        verify(broadcaster).selected(TRIP_ID, SEAT_ID, NAN_NHAN.getName());
    }

    @Test
    @DisplayName("Giữ hụt thì chỉ báo riêng người vừa bấm, không phát cho cả phòng")
    void lockFailed_IsSentOnlyToRequester() {
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, NAN_NHAN.getName());

        controller.updateSeatStatus(command(SEAT_ID, "SELECTED"), KE_TAN_CONG);

        // Bản cũ phát LOCK_FAILED cho cả phòng, làm giao diện của người không liên quan
        // nhấp nháy vô cớ.
        verify(broadcaster).lockFailedTo(KE_TAN_CONG.getName(), TRIP_ID, SEAT_ID);
        verify(broadcaster, never()).selected(TRIP_ID, SEAT_ID, KE_TAN_CONG.getName());
    }

    @Test
    @DisplayName("LỖ HỔNG CŨ: người khác không nhả được ghế mình đang giữ")
    void unlockSeat_CannotReleaseSomeoneElsesSeat() {
        // Bản cũ đọc userId từ thân thông điệp, nên chỉ cần gửi
        // {"seatId":42,"status":"AVAILABLE","userId":"nan.nhan@gmail.com"} là nhả được ghế
        // nạn nhân đang giữ. Giờ danh tính lấy từ phiên, kẻ tấn công có khai gì cũng vô ích.
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, NAN_NHAN.getName());

        controller.updateSeatStatus(command(SEAT_ID, "AVAILABLE"), KE_TAN_CONG);

        assertEquals(NAN_NHAN.getName(), seatLockService.getLockedBy(SEAT_ID));
        verify(broadcaster, never()).available(TRIP_ID, SEAT_ID);
    }

    @Test
    @DisplayName("Chính chủ nhả ghế thì ghế trống trở lại")
    void unlockSeat_OwnerCanRelease() {
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, NAN_NHAN.getName());

        controller.updateSeatStatus(command(SEAT_ID, "AVAILABLE"), NAN_NHAN);

        assertNull(seatLockService.getLockedBy(SEAT_ID));
        verify(broadcaster).available(TRIP_ID, SEAT_ID);
    }

    @Test
    @DisplayName("Nhận lại ghế đã giữ lúc chưa đăng nhập")
    void handover_TransfersGuestSeatsToAccount() {
        StompPrincipal sauKhiDangNhap =
                new StompPrincipal(SeatIdentity.ofUser("khach@gmail.com"), DEVICE_KEY);
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, SeatIdentity.ofGuest(DEVICE_KEY));

        controller.handoverSeats(handover(List.of(SEAT_ID)), sauKhiDangNhap);

        assertEquals(sauKhiDangNhap.getName(), seatLockService.getLockedBy(SEAT_ID));
        verify(broadcaster).selected(TRIP_ID, SEAT_ID, sauKhiDangNhap.getName());
    }

    @Test
    @DisplayName("Không nhận được ghế của phiên khách khác")
    void handover_CannotClaimAnotherGuestsSeats() {
        StompPrincipal keTanCongDaDangNhap =
                new StompPrincipal(SeatIdentity.ofUser("ke.tan.cong@gmail.com"), "sess_cua_no");
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, SeatIdentity.ofGuest(DEVICE_KEY));

        controller.handoverSeats(handover(List.of(SEAT_ID)), keTanCongDaDangNhap);

        assertEquals(SeatIdentity.ofGuest(DEVICE_KEY), seatLockService.getLockedBy(SEAT_ID));
        verify(broadcaster).lockFailedTo(keTanCongDaDangNhap.getName(), TRIP_ID, SEAT_ID);
    }

    @Test
    @DisplayName("Phiên khách không gọi được handover")
    void handover_RequiresAuthenticatedSession() {
        controller.handoverSeats(handover(List.of(SEAT_ID)), KE_TAN_CONG);

        verifyNoInteractions(broadcaster);
    }

    @Test
    @DisplayName("whoami trả mã chủ sở hữu của chính phiên gọi")
    void whoami_SendsIdentityToCaller() {
        controller.whoami(NAN_NHAN);

        verify(broadcaster).sendIdentityTo(NAN_NHAN.getName());
    }

    private SeatStatusController.SeatHandoverCommand handover(List<Long> seatIds) {
        SeatStatusController.SeatHandoverCommand cmd = new SeatStatusController.SeatHandoverCommand();
        cmd.setTripId(TRIP_ID);
        cmd.setSeatIds(seatIds);
        return cmd;
    }
}
