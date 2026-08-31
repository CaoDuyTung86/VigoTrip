package com.booking.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingRequest {

    @NotNull(message = "Trip ID không được để trống")
    private Long tripId;

    @NotEmpty(message = "Phải chọn ít nhất một ghế")
    private List<Long> seatIds;

    // Tên hành khách tương ứng với từng ghế
    private List<String> passengerNames;

    // Dịch vụ bổ sung (hành lý, suất ăn, bảo hiểm, taxi...)
    private List<Long> additionalServiceIds;

    // Mã giảm giá
    private String voucherCode;

    /**
     * Người liên hệ của đơn: nơi nhận vé điện tử và mọi thông báo về chuyến đi.
     *
     * Ba trường này validate theo ĐỊNH DẠNG chứ không bắt buộc phải có. Lý do: đơn nào
     * cũng cần một địa chỉ gửi được, nhưng nếu client cũ (hoặc một luồng nào đó chưa cập
     * nhật) không gửi lên thì rơi về email/SĐT của tài khoản còn hơn là chặn cả đơn hàng.
     * Ngược lại, gửi lên một giá trị SAI thì phải chặn ngay — im lặng nhận rồi gửi vé vào
     * hư không mới là hỏng nặng. Việc điền vào chỗ trống nằm ở BookingService.
     */
    @Size(max = 120, message = "Tên người liên hệ tối đa 120 ký tự")
    private String contactName;

    @Email(message = "Email người liên hệ không hợp lệ")
    @Size(max = 120, message = "Email người liên hệ tối đa 120 ký tự")
    private String contactEmail;

    @Pattern(regexp = "^$|^0\\d{9}$", message = "Số điện thoại người liên hệ phải gồm 10 chữ số và bắt đầu bằng 0")
    private String contactPhone;
}
