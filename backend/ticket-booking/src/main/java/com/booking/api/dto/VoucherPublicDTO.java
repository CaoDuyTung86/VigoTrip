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
    /**
     * Cau tieng Viet dung san. Giu lai cho client cu; client moi uu tien
     * {@link #unavailableReasonCode} de tu dung cau theo ngon ngu dang chon.
     */
    private String unavailableReason;
    /**
     * Ma ly do khong dung duoc, doc duoc bang may:
     * ALREADY_USED, EXPIRED, NOT_STARTED, SOLD_OUT, PROVIDER_ONLY, MIN_ORDER.
     *
     * Co truong nay thi trang uu dai moi dich duoc phan nay sang tieng Anh — cau chu nam o
     * bang tu dien phia frontend, khong con bi chot cung tieng Viet trong service.
     * Tham so de dien vao cau (ten hang, muc don toi thieu) da co san o providerName va
     * minOrderAmount nen khong can gui them.
     */
    private String unavailableReasonCode;
    private boolean saved;
    /** Tài khoản hiện tại đã dùng mã này ở một đơn chưa hủy (mỗi mã chỉ dùng 1 lần / tài khoản). */
    private boolean alreadyUsed;
}
