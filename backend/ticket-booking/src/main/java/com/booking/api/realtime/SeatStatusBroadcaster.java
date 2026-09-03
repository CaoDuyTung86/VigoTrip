package com.booking.api.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Một chỗ duy nhất để phát trạng thái ghế ra ngoài.
 *
 * <p>Trước đây năm nơi khác nhau (đặt vé, huỷ vé, hoàn tiền, dọn đơn quá hạn, nhả lock hết
 * hạn) mỗi nơi tự gọi {@code convertAndSend("/topic/seat-status", ...)} với chuỗi đích viết
 * tay và tự nhét email vào thông điệp. Gom về một lớp thì tên kênh và việc ẩn danh chủ sở
 * hữu chỉ còn đúng một bản — đổi quy ước không phải đi sửa năm chỗ và quên mất một chỗ.
 */
@Component
@RequiredArgsConstructor
public class SeatStatusBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;
    private final SeatOwnerTokenService ownerTokenService;

    /** Ghế vừa được giữ tạm bởi {@code ownerIdentity}. */
    public void selected(Long tripId, Long seatId, String ownerIdentity) {
        broadcast(tripId, seatId, SeatStatusMessage.SELECTED, ownerIdentity);
    }

    /** Ghế đã chốt thành vé. */
    public void booked(Long tripId, Long seatId, String ownerIdentity) {
        broadcast(tripId, seatId, SeatStatusMessage.BOOKED, ownerIdentity);
    }

    /** Ghế trống trở lại (hết hạn giữ, huỷ vé, hoàn tiền, dọn đơn quá hạn). */
    public void available(Long tripId, Long seatId) {
        broadcast(tripId, seatId, SeatStatusMessage.AVAILABLE, null);
    }

    /**
     * Báo riêng cho một phiên rằng yêu cầu giữ ghế của họ hụt.
     *
     * <p>Gửi riêng chứ không phát cho cả phòng: người khác không cần biết ai vừa bấm hụt
     * ghế nào, và phát ra còn làm giao diện của họ nhấp nháy vô cớ.
     */
    public void lockFailedTo(String identity, Long tripId, Long seatId) {
        messagingTemplate.convertAndSendToUser(identity, SeatTopic.USER_SEAT_QUEUE,
                new SeatStatusMessage(tripId, seatId, SeatStatusMessage.LOCK_FAILED, null));
    }

    /** Báo riêng cho một phiên mã chủ sở hữu của chính họ, để giao diện so "ghế này của tôi". */
    public void sendIdentityTo(String identity) {
        messagingTemplate.convertAndSendToUser(identity, SeatTopic.USER_IDENTITY_QUEUE,
                new SeatIdentityMessage(ownerTokenService.tokenFor(identity), SeatIdentity.isUser(identity)));
    }

    private void broadcast(Long tripId, Long seatId, String status, String ownerIdentity) {
        messagingTemplate.convertAndSend(SeatTopic.forTrip(tripId),
                new SeatStatusMessage(tripId, seatId, status, ownerTokenService.tokenFor(ownerIdentity)));
    }

    /**
     * @param ownerToken      mã ẩn danh của chính phiên này
     * @param authenticated   phiên đang mang JWT hợp lệ hay chỉ là khách chưa đăng nhập
     */
    public record SeatIdentityMessage(String ownerToken, boolean authenticated) {
    }
}
