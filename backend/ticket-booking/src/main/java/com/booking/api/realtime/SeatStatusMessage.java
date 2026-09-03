package com.booking.api.realtime;

/**
 * Thông điệp trạng thái ghế phát cho trình duyệt.
 *
 * <p>Cố ý KHÔNG có trường {@code userId}. Chủ sở hữu được nêu bằng {@code ownerToken} — mã
 * ẩn danh không hoàn nguyên được, xem {@link SeatOwnerTokenService}. Ghế trống thì
 * {@code ownerToken} là null.
 *
 * @param status một trong {@code SELECTED} (đang được giữ tạm), {@code BOOKED} (đã đặt),
 *               {@code AVAILABLE} (trống trở lại), {@code LOCK_FAILED} (giữ hụt — chỉ gửi
 *               riêng cho người vừa yêu cầu, không phát cho cả phòng).
 */
public record SeatStatusMessage(Long tripId, Long seatId, String status, String ownerToken) {

    public static final String SELECTED = "SELECTED";
    public static final String BOOKED = "BOOKED";
    public static final String AVAILABLE = "AVAILABLE";
    public static final String LOCK_FAILED = "LOCK_FAILED";
}
