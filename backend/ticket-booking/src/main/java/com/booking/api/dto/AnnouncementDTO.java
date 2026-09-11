package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Một mẩu tin cho dải tin chạy trên Header.
 *
 * Cố ý KHÔNG gửi câu chữ dựng sẵn cho tin suy ra từ dữ liệu: backend gửi {@code kind} +
 * {@code params}, còn câu hoàn chỉnh do frontend ghép từ bảng dịch của ngôn ngữ đang chọn.
 * Đây cũng là lối đi đã dùng cho {@code VoucherPublicDTO.unavailableReasonCode} — chốt cứng
 * tiếng Việt trong service nghĩa là người dùng tiếng Anh đọc được một dải tin tiếng Việt mà
 * không có gì báo.
 *
 * Hai trường {@code textVi}/{@code textEn} dành cho nhịp hai (bảng {@code thong_bao} do Admin
 * nhập tay): tin nhập tay thì không có tham số để ghép, chỉ có nguyên văn hai thứ tiếng.
 * Tin suy ra để trống hai trường này.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementDTO {

    /** Khóa ổn định giữa các lần gọi (ví dụ "voucher:12") — client dùng làm React key và để nhớ tin đã tắt. */
    private String id;

    /** VOUCHER là loại duy nhất của nhịp một. Nhịp hai thêm ROUTE / MAINTENANCE / INFO. */
    private String kind;

    /** Tham số dựng câu: code, percent, maxDiscount, minOrder, provider. Số để dạng thô, client tự định dạng theo locale. */
    private Map<String, String> params;

    /** Nguyên văn tin nhập tay. Null với tin suy ra từ dữ liệu. */
    private String textVi;
    private String textEn;

    /** Đường dẫn nội bộ mở trang đầy đủ. Chữ chạy chỉ là mồi, nội dung nằm ở trang đích. */
    private String link;

    /** Mốc hết hiệu lực, để client biết tin nào sắp hết hạn. Null = không có hạn. */
    private LocalDateTime endsAt;
}
