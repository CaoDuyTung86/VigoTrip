package com.booking.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
}
