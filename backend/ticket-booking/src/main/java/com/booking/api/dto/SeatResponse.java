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

    /**
     * Mã chủ sở hữu <b>ẩn danh</b> của ghế đang bị giữ tạm, hoặc null nếu ghế không ai giữ.
     *
     * <p>Là HMAC do {@code SeatOwnerTokenService} sinh — <b>không phải</b> danh tính thô
     * ({@code user:<email>} / {@code guest:<khoá thiết bị>}). Endpoint này công khai, nên
     * đặt danh tính thô vào đây là công bố email của mọi người đang chọn ghế cùng chuyến.
     *
     * <p>Phải cùng hệ quy chiếu với {@code ownerToken} trong thông điệp WebSocket: giao
     * diện so đúng hai chuỗi này để biết "ghế này của tôi hay của người khác", và nó chỉ
     * có mỗi phép so đó. Xem {@code TripServiceSeatMapTest}.
     */
    private String tempLockedBy;
}

