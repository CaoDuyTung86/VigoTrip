package com.booking.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequest {

    @NotNull(message = "Booking ID không được để trống")
    private Long bookingId;

    private String bankCode; // Mã ngân hàng (tùy chọn, ví dụ: NCB, VNPAYQR)
    private String language; // Ngôn ngữ: "vn" hoặc "en" (mặc định "vn")

    /**
     * Origin của trang đang đặt vé (window.location.origin). Sau khi trả tiền, cổng VNPay
     * gọi về backend chứ không về frontend, nên backend phải biết đưa khách quay lại tên
     * miền nào. Bỏ trống thì backend tự suy ra từ header Origin/Referer.
     * Giá trị luôn được đối chiếu với danh sách cho phép ở server (chống open redirect).
     */
    private String returnOrigin;
}
