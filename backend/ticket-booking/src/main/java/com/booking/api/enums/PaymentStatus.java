package com.booking.api.enums;

/**
 * Trạng thái giao dịch thanh toán (Payment)
 */
public enum PaymentStatus {
    PENDING,  // Đang khởi tạo thanh toán
    SUCCESS,  // Giao dịch thành công
    FAILED    // Giao dịch thất bại
}
