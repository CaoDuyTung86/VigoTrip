package com.booking.api.enums;

/**
 * Loại tin nhập tay trên dải tin chạy.
 *
 * <p>Chỉ dùng cho tin trong bảng {@code thong_bao}. Tin suy ra từ voucher mang loại
 * {@code VOUCHER} và không nằm trong enum này: nó không phải một lựa chọn của người nhập tin,
 * mà là hệ quả của việc có một mã đang hiệu lực.
 *
 * <p>Ba loại chứ không phải một trường tự do: mỗi loại có một biểu tượng riêng trên dải tin,
 * và quan trọng hơn là nó nói cho người nhập biết phạm vi. Bất cứ thứ gì bỏ lỡ thì mất tiền
 * hoặc mất chuyến đều KHÔNG thuộc về dải tin — chữ chạy là thứ đọc lướt. Không có loại nào
 * tên là ALERT hay URGENT là vì thế.
 */
public enum AnnouncementKind {

    /** Tuyến mới mở bán. Thường kèm đường dẫn tới trang tìm chuyến của tuyến đó. */
    ROUTE,

    /** Lịch bảo trì đã biết trước. Không dùng cho sự cố đang xảy ra. */
    MAINTENANCE,

    /** Thông tin chung không thuộc hai loại trên. */
    INFO
}
