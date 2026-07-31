package com.booking.api.enums;

/**
 * Trạng thái của Đơn đặt vé (Booking)
 */
public enum BookingStatus {
    PENDING,    // Đang chờ thanh toán
    CONFIRMED,  // Đã xác nhận / thanh toán thành công
    PAID,       // Đã thanh toán
    CANCELLED,  // Đã hủy
    COMPLETED,  // Đã hoàn thành chuyến đi
    FAILED      // Thanh toán thất bại
}
