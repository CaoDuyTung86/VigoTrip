package com.booking.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dich_vu_bo_sung")
public class AdditionalService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "service_id")
    private Long id;

    /**
     * Khoá máy đọc, cố định trọn đời dòng dữ liệu. Ví dụ: {@code BAGGAGE_20KG}, {@code MEAL_MY_Y}.
     *
     * <p>Vì sao cần thêm cột này khi đã có {@link #serviceName}: tên là chữ tiếng Việt để hiển
     * thị, mà giao diện lại đang dùng chính nó làm khoá — nhóm dịch vụ bằng cách so tiền tố
     * ("Suất ăn - ", "Hành lý"), cắt tiền tố bằng regex để lấy tên ngắn, và tra ảnh minh hoạ
     * bằng nguyên chuỗi tiếng Việt. Hệ quả đã thấy trên bản deploy: dòng taxi tên là
     * "Taxi đưa đón sân bay (Xanh SM)" trong khi trang tàu cắt tiền tố "Taxi đưa đón sân ga",
     * regex trượt nên nhãn hiện nguyên cả câu; và không có chỗ nào bám vào để dịch sang tiếng
     * Anh, nên khách xem bản English vẫn đọc thực đơn bằng tiếng Việt.
     *
     * <p>Có khoá riêng thì tên chỉ còn là chữ hiển thị: đổi tên, sửa chính tả hay dịch đều
     * không đụng tới logic.
     *
     * <p>Cho phép null: những dòng do người quản trị tự thêm ngoài danh mục seed sẽ không có
     * khoá, và giao diện phải chịu được điều đó (rơi về hiển thị nguyên tên).
     */
    @Column(name = "service_code", length = 64)
    private String serviceCode;

    /**
     * Nhóm dịch vụ để giao diện xếp vào đúng thẻ: BAGGAGE / MEAL / INSURANCE / TRANSFER.
     * Xem {@link com.booking.api.config.AdditionalServiceSeeder}.
     */
    @Column(name = "service_category", length = 32)
    private String category;

    @Column(name = "service_name")
    private String serviceName;

    @Column(name = "price", precision = 15, scale = 2)
    private BigDecimal price;

    /** Dựng dòng mới từ danh mục seed. Giữ constructor đầy đủ do Lombok sinh cho JPA. */
    public AdditionalService(String serviceCode, String category, String serviceName, BigDecimal price) {
        this.serviceCode = serviceCode;
        this.category = category;
        this.serviceName = serviceName;
        this.price = price;
    }
}
