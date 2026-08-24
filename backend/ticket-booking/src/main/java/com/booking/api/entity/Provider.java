package com.booking.api.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "nha_cung_cap")
@JsonIgnoreProperties({"vehicles"})
public class Provider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "provider_id")
    private Long id;

    @Column(name = "provider_name", nullable = false)
    private String providerName;

    @Column(name = "provider_type")
    private String providerType;

    @Column(name = "contact_info")
    private String contactInfo;

    /**
     * Tài khoản đối tác vận hành thương hiệu này.
     *
     * Trước đây không có liên kết nào giữa nha_cung_cap và users, nên ROLE_PROVIDER thực chất
     * là admin thứ hai: đăng nhập vào là xem được doanh thu của mọi hãng, kể cả đối thủ.
     * Có cột này thì mọi truy vấn thống kê mới thu hẹp được về đúng những hãng tài khoản đó
     * sở hữu, còn admin vẫn nhìn toàn hệ thống.
     *
     * Để nullable có chủ đích: hãng chưa gán chủ sở hữu vẫn hoạt động bình thường, chỉ là
     * không ai ngoài admin xem được báo cáo của nó. Nhờ vậy cột này thêm được vào CSDL đang
     * có dữ liệu mà không cần backfill trước (ddl-auto=update không thể thêm cột NOT NULL
     * vào bảng đã có hàng).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User ownerUser;

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Vehicle> vehicles;
}
