package com.booking.api.controller;

import com.booking.api.realtime.SeatIdentity;
import com.booking.api.realtime.SeatStatusBroadcaster;
import com.booking.api.realtime.SeatStatusMessage;
import com.booking.api.security.StompPrincipal;
import com.booking.api.service.SeatLockService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.List;

/**
 * Đầu vào WebSocket cho việc chọn/nhả ghế.
 *
 * <p><b>Điểm khác cốt lõi so với bản cũ:</b> danh tính lấy từ {@link StompPrincipal} — do
 * {@code StompAuthChannelInterceptor} suy ra một lần lúc CONNECT — chứ không còn đọc từ
 * trường {@code userId} trong thân thông điệp. Client vẫn gửi lên trường đó thì cũng bị bỏ
 * qua, nên không mạo danh được nữa.
 */
@Controller
@RequiredArgsConstructor
public class SeatStatusController {

    private final SeatLockService seatLockService;
    private final SeatStatusBroadcaster broadcaster;

    @MessageMapping("/seat-selection")
    public void updateSeatStatus(SeatSelectionCommand command, StompPrincipal principal) {
        String identity = principal.getName();

        if (SeatStatusMessage.SELECTED.equals(command.getStatus())) {
            if (seatLockService.lockSeat(command.getTripId(), command.getSeatId(), identity)) {
                broadcaster.selected(command.getTripId(), command.getSeatId(), identity);
            } else {
                // Báo riêng cho người vừa bấm hụt. Bản cũ phát LOCK_FAILED cho cả phòng,
                // khiến giao diện của những người không liên quan cũng nhấp nháy.
                broadcaster.lockFailedTo(identity, command.getTripId(), command.getSeatId());
            }
        } else if (SeatStatusMessage.AVAILABLE.equals(command.getStatus())
                && seatLockService.unlockSeat(command.getSeatId(), identity)) {
            broadcaster.available(command.getTripId(), command.getSeatId());
        }
    }

    /**
     * Chuyển ghế đang giữ dưới danh tính khách sang tài khoản vừa đăng nhập.
     *
     * <p>Phiên này được phép nhận vì chính nó đã khai khoá thiết bị đó ở frame CONNECT —
     * tức nó vốn là phiên khách đang giữ mấy ghế này, chỉ vừa đăng nhập xong.
     */
    @MessageMapping("/seat-handover")
    public void handoverSeats(SeatHandoverCommand command, StompPrincipal principal) {
        String identity = principal.getName();
        if (!SeatIdentity.isUser(identity) || principal.guestKey() == null || command.getSeatIds() == null) {
            return;
        }

        String guestIdentity = SeatIdentity.ofGuest(principal.guestKey());
        List<Long> failed = new ArrayList<>();
        for (Long seatId : command.getSeatIds()) {
            // Ghế đã mang sẵn danh tính mới (đăng nhập rồi chọn tiếp) thì coi như xong.
            if (identity.equals(seatLockService.getLockedBy(seatId))
                    || seatLockService.transferLock(seatId, guestIdentity, identity)) {
                broadcaster.selected(command.getTripId(), seatId, identity);
            } else {
                failed.add(seatId);
            }
        }

        for (Long seatId : failed) {
            broadcaster.lockFailedTo(identity, command.getTripId(), seatId);
        }
    }

    /**
     * Trả cho phiên gọi mã chủ sở hữu của chính nó.
     *
     * <p>Cần vì thông điệp phát ra không còn chứa email nữa: giao diện muốn biết "ghế này
     * của tôi hay của người khác" thì phải có mã của chính mình để so.
     */
    @MessageMapping("/whoami")
    public void whoami(StompPrincipal principal) {
        broadcaster.sendIdentityTo(principal.getName());
    }

    /** Lệnh chọn/nhả một ghế. Không có {@code userId} — danh tính lấy từ phiên. */
    @Data
    public static class SeatSelectionCommand {
        private Long tripId;
        private Long seatId;
        private String status;
    }

    @Data
    public static class SeatHandoverCommand {
        private Long tripId;
        private List<Long> seatIds;
    }
}
