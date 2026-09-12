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
 * Hai trường {@code textVi}/{@code textEn} dành cho tin Admin nhập tay (bảng {@code thong_bao}):
 * tin nhập tay thì không có tham số để ghép, chỉ có nguyên văn hai thứ tiếng do người đăng viết.
 * Tin suy ra từ voucher để trống hai trường này, và ngược lại tin nhập tay để trống
 * {@code params} — client nhìn {@code kind} là biết đi nhánh nào.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementDTO {

    /** Khóa ổn định giữa các lần gọi (ví dụ "voucher:12") — client dùng làm React key và để nhớ tin đã tắt. */
    private String id;

    /** VOUCHER cho tin suy từ voucher; ROUTE / MAINTENANCE / INFO cho tin nhập tay. */
    private String kind;

    /** Tham số dựng câu: code, percent, maxDiscount, minOrder, provider. Số để dạng thô, client tự định dạng theo locale. */
    private Map<String, String> params;

    /** Nguyên văn tin nhập tay. Null với tin suy ra từ dữ liệu. */
    private String textVi;
    private String textEn;

    /**
     * Đường dẫn nội bộ mở trang đầy đủ. Chữ chạy chỉ là mồi, nội dung nằm ở trang đích.
     *
     * Null với tin nhập tay không khai đường dẫn: mẩu tin đó hiện ra nhưng không bấm được.
     * Trước đây client mặc định về /uu-dai khi thiếu trường này, nhưng một thông báo bảo trì
     * dẫn người đọc sang trang khuyến mãi thì tệ hơn hẳn một mẩu tin không bấm được.
     */
    private String link;

    /** Mốc hết hiệu lực, để client biết tin nào sắp hết hạn. Null = không có hạn. */
    private LocalDateTime endsAt;
}
