package com.booking.api.realtime;

/**
 * Quy ước đặt tên kênh cho trạng thái ghế.
 *
 * <p>Bản cũ dùng đúng một kênh toàn cục {@code /topic/seat-status}: mỗi lần một người chạm
 * vào một ghế bất kỳ, thông điệp đó được đẩy tới TOÀN BỘ trình duyệt đang mở trang — kể cả
 * những người đang xem chuyến khác, hay đang ở trang chủ. Lưu lượng vì thế tăng theo tích
 * (số người xem × số sự kiện của mọi chuyến), trong khi phần thực sự hữu ích với mỗi người
 * chỉ là những sự kiện của đúng chuyến họ đang mở.
 *
 * <p>Tách theo chuyến đưa lượng tin mỗi client phải nhận về đúng phần liên quan tới mình,
 * và cũng bịt luôn đường quan sát chéo: không đăng ký chuyến nào thì không nghe được gì của
 * chuyến đó.
 */
public final class SeatTopic {

    /** Kênh riêng cho từng chuyến: chỉ ai đang mở sơ đồ ghế của chuyến đó mới nhận. */
    public static final String TRIP_PREFIX = "/topic/seat-status/";

    /** Hàng đợi riêng của từng phiên: phản hồi giữ ghế và mã chủ sở hữu của chính mình. */
    public static final String USER_SEAT_QUEUE = "/queue/seat-status";
    public static final String USER_IDENTITY_QUEUE = "/queue/identity";

    private SeatTopic() {
    }

    public static String forTrip(Long tripId) {
        return TRIP_PREFIX + tripId;
    }
}
