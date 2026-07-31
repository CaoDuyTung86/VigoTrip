package com.booking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoogleLoginRequest {

    /**
     * Google ID Token (JWT) do Google SDK trả về sau khi user đăng nhập Google.
     * Backend sẽ verify token này với Google để lấy email và tên thật.
     * Frontend KHÔNG được tự truyền email/fullName nữa.
     */
    @NotBlank(message = "Google ID Token không được để trống")
    private String idToken;
}
