package com.booking.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không đúng định dạng")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    private String password;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "0\\d{9}", message = "Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số")
    private String phone;

    /**
     * Ngôn ngữ người dùng đang xem giao diện lúc bấm đăng ký. Không bắt buộc.
     *
     * <p>Có mặt ở đây vì mail xác thực là lá thư ĐẦU TIÊN hệ thống gửi, và lúc đó tài khoản
     * còn chưa tồn tại để mà lưu lựa chọn ngôn ngữ. Không nhận từ form đăng ký thì một
     * người đang xem bản tiếng Anh sẽ nhận mail kích hoạt bằng tiếng Việt — đúng ngay
     * khoảnh khắc họ chưa biết VigoTrip có tiếng Anh hay không.
     *
     * <p>Giá trị lạ bị SupportedLocales loại bỏ, nên không cần ràng buộc kiểu ở đây.
     */
    private String language;
}
