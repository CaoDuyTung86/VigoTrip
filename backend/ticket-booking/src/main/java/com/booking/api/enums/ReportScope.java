package com.booking.api.enums;

/** Phạm vi dữ liệu của một báo cáo BI. */
public enum ReportScope {

    /** Toàn hệ thống — chỉ admin được xem. */
    SYSTEM,

    /**
     * Chỉ những thương hiệu mà tài khoản đang đăng nhập sở hữu
     * (xác định qua {@code nha_cung_cap.owner_user_id}).
     */
    PROVIDER
}
