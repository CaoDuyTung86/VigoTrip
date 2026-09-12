package com.booking.api.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdminDTO {

    @Data
    public static class RouteRequest {
        private String origin;
        private String destination;
    }

    @Data
    public static class ProviderRequest {
        private String providerName;
        private String providerType; // BUS, TRAIN, FLIGHT
        private String contactInfo;
    }

    @Data
    public static class VehicleRequest {
        private String vehicleType;
        private Integer totalSeats;
        private Long providerId;
    }

    @Data
    public static class TripRequest {
        private Long routeId;
        private Long vehicleId;
        private LocalDateTime departureTime;
        private LocalDateTime arrivalTime;
        private BigDecimal price;
        private String status;
    }

    @Data
    public static class VoucherRequest {
        private String code;
        private Double discountPercent;
        private Double maxDiscountAmount;
        private Double minOrderAmount;
        private LocalDateTime startDate;
        private LocalDateTime expiryDate;
        private Integer maxUsage;
        private String description;
        private Boolean isActive;
        /** Hãng phương tiện áp dụng riêng; null = áp dụng cho tất cả các hãng. */
        private Long providerId;
        /** Có rao mã này trên dải tin chạy hay không; null = bật, xem Voucher.showOnTicker. */
        private Boolean showOnTicker;
    }

    /**
     * Một mẩu tin nhập tay cho dải tin chạy (bảng {@code thong_bao}).
     *
     * <p>Chỉ Admin gửi được: ghi tin là việc của {@code /api/admin/**}, còn đường đọc
     * {@code GET /api/announcements} thì công khai.
     */
    @Data
    public static class AnnouncementRequest {
        private String contentVi;
        private String contentEn;
        private String link;
        /** ROUTE | MAINTENANCE | INFO. Để trống thì hiểu là INFO. */
        private String kind;
        private LocalDateTime startsAt;
        private LocalDateTime endsAt;
        private Integer sortOrder;
        private Boolean active;
    }
}
