package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {

    private int status;
    private String error;
    private String message;
    private LocalDateTime timestamp;

    /**
     * Mã lỗi để frontend rẽ nhánh mà không phải so khớp câu chữ tiếng Việt
     * (câu chữ còn phải dịch sang 4 ngôn ngữ). null với các lỗi thông thường.
     */
    private String code;

    public ErrorResponse(int status, String error, String message, LocalDateTime timestamp) {
        this(status, error, message, timestamp, null);
    }
}
