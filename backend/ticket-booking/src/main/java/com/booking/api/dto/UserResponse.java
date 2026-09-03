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
    /** Đang cho phép lưu hội thoại với trợ lý AI hay không. Không bao giờ null ở đây. */
    private Boolean chatHistoryOptIn;
}
