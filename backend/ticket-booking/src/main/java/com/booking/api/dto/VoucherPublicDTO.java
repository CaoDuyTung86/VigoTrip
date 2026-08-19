package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Voucher hiển thị cho người dùng cuối (trang ưu đãi / danh sách voucher đã lưu),
 * kèm thông tin đã tính sẵn về việc có áp dụng được hay không.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherPublicDTO {
    private Long id;
    private String code;
    private Double discountPercent;
    private Double maxDiscountAmount;
    private Double minOrderAmount;
    private LocalDateTime startDate;
    private LocalDateTime expiryDate;
    private Integer maxUsage;
    private Integer currentUsage;
    private String description;
    private Long providerId;
    private String providerName;
    private boolean available;
    private String unavailableReason;
    private boolean saved;
    /** Tài khoản hiện tại đã dùng mã này ở một đơn chưa hủy (mỗi mã chỉ dùng 1 lần / tài khoản). */
    private boolean alreadyUsed;
}
