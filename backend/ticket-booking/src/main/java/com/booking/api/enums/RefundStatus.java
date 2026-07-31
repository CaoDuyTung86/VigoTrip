package com.booking.api.enums;

/**
 * Trạng thái yêu cầu hoàn tiền (Refund)
 */
public enum RefundStatus {
    PENDING,    // Đang chờ duyệt
    APPROVED,   // Đã duyệt hoàn tiền
    REJECTED,   // Từ chối hoàn tiền
    COMPLETED   // Hoàn tiền hoàn tất
}
