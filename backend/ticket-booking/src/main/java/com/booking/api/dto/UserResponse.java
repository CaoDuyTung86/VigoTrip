package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private Integer points;
    private String membershipLevel;
    private Double discountPercent;
    private boolean hasPassword;
    private Boolean enabled;
    /**
     * enabled = false có hai nghĩa: chưa xác thực email, hoặc bị quản trị viên khóa.
     * Cờ này tách chúng ra để bảng quản trị không phải hiển thị "Đã khóa / Chưa kích hoạt".
     */
    private boolean awaitingEmailVerification;
    /** Đang cho phép lưu hội thoại với trợ lý AI hay không. Không bao giờ null ở đây. */
    private Boolean chatHistoryOptIn;
}
