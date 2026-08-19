package com.booking.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "voucher")
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "voucher_id")
    private Long id;

    @Column(name = "code", unique = true, nullable = false)
    private String code;

    @Column(name = "discount_percent")
    private Double discountPercent;

    @Column(name = "max_discount_amount")
    private Double maxDiscountAmount;

    @Column(name = "min_order_amount")
    private Double minOrderAmount;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "expiry_date")
    private LocalDateTime expiryDate;

    /**
     * Hãng phương tiện (máy bay/xe khách/tàu hỏa) mà voucher này áp dụng.
     * Null nghĩa là áp dụng cho tất cả các hãng.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id")
    private Provider provider;

    @Column(name = "max_usage")
    private Integer maxUsage;

    @Column(name = "current_usage")
    private Integer currentUsage = 0;

    @Column(name = "description")
    private String description;

    @Column(name = "is_active")
    private Boolean isActive = true;
}
