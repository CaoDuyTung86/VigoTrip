package com.booking.api.service;

import com.booking.api.dto.AnnouncementDTO;
import com.booking.api.entity.Voucher;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Nguồn dữ liệu cho dải tin chạy trên Header.
 *
 * NHỊP MỘT — không đụng lược đồ CSDL: tin được suy thẳng từ voucher đang hiệu lực. Cùng tập
 * dữ liệu mà trang /uu-dai vốn đã công khai cho khách vãng lai, nên dải tin không mở thêm
 * thứ gì ra ngoài; nó chỉ là một lối vào khác của cùng nội dung đó.
 *
 * NHỊP HAI sẽ thêm bảng {@code thong_bao} cho tin nhập tay (tuyến mới mở bán, lịch bảo trì).
 * Chỗ nối đã chừa sẵn: hợp nhất danh sách ở {@link #getActiveAnnouncements()} rồi cắt theo
 * {@link #MAX_ITEMS}, phần còn lại của hệ thống không phải đổi gì.
 *
 * KHÔNG dùng WebSocket: voucher đổi vài lần mỗi tuần chứ không phải từng giây như trạng thái
 * ghế. Một endpoint công khai + cache ngắn phía máy chủ + client gọi lại khi cửa sổ được
 * focus là đủ, và không bắt mọi khách vãng lai giữ một kết nối thường trực chỉ để nhận
 * một dải quảng cáo.
 */
@Service
@RequiredArgsConstructor
public class AnnouncementService {

    /**
     * Trần số tin. Dải chữ chạy dài hơn chừng này thì một vòng mất hơn một phút — mẩu tin
     * cuối gần như không ai đọc tới, mà vẫn tốn băng thông và tốn chỗ trong DOM.
     */
    static final int MAX_ITEMS = 6;

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final VoucherRepository voucherRepository;

    /**
     * Danh sách tin đang hiệu lực, đã sắp xếp và cắt ngọn.
     *
     * Cache "announcements" (5 phút) đứng trước CSDL vì endpoint này công khai và được gọi
     * lại mỗi lần người dùng quay lại tab — không cache thì mỗi lượt chuyển tab là một lượt
     * quét bảng voucher. Mọi thao tác sửa voucher đều xóa cache này (xem VoucherService),
     * nên Admin bật/tắt một mã thì dải tin đổi theo ngay chứ không phải chờ hết 5 phút.
     */
    @Cacheable("announcements")
    @Transactional(readOnly = true)
    public List<AnnouncementDTO> getActiveAnnouncements() {
        LocalDateTime now = LocalDateTime.now(ZONE);

        List<Voucher> live = voucherRepository.findByIsActiveTrue().stream()
                .filter(v -> v.getStartDate() == null || !now.isBefore(v.getStartDate()))
                .filter(v -> v.getExpiryDate() == null || !now.isAfter(v.getExpiryDate()))
                .filter(v -> v.getMaxUsage() == null
                        || v.getCurrentUsage() == null
                        || v.getCurrentUsage() < v.getMaxUsage())
                .filter(v -> v.getCode() != null && !v.getCode().isBlank())
                .sorted(EXPIRY_FIRST)
                .limit(MAX_ITEMS)
                .toList();

        List<AnnouncementDTO> items = new ArrayList<>(live.size());
        for (Voucher v : live) {
            items.add(toAnnouncement(v));
        }
        return items;
    }

    /**
     * Mã sắp hết hạn lên trước — đó là tin duy nhất trong danh sách có tính thời điểm; mã
     * không hạn thì lúc nào đọc cũng được nên xuống cuối. Cùng hạn thì mã giảm sâu hơn
     * đứng trước.
     */
    private static final Comparator<Voucher> EXPIRY_FIRST =
            Comparator.comparing(Voucher::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(v -> v.getDiscountPercent() == null ? 0d : -v.getDiscountPercent());

    private AnnouncementDTO toAnnouncement(Voucher v) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("code", v.getCode());
        putNumber(params, "percent", v.getDiscountPercent());
        putNumber(params, "maxDiscount", v.getMaxDiscountAmount());
        putNumber(params, "minOrder", v.getMinOrderAmount());
        if (v.getProvider() != null && v.getProvider().getProviderName() != null) {
            params.put("provider", v.getProvider().getProviderName());
        }

        return AnnouncementDTO.builder()
                .id("voucher:" + v.getId())
                .kind("VOUCHER")
                .params(params)
                // Trang ưu đãi đọc ?code= để cuộn tới và làm nổi đúng thẻ voucher.
                .link("/uu-dai?code=" + v.getCode())
                .endsAt(v.getExpiryDate())
                .build();
    }

    /**
     * Số gửi đi ở dạng thô, không kèm đơn vị và không định dạng. Ghép sẵn "100.000đ" ở đây
     * là chốt cứng quy ước dấu phân cách của tiếng Việt vào dữ liệu; client có Intl và biết
     * ngôn ngữ đang chọn nên để nó định dạng. Phần thập phân .0 bị cắt vì phần trăm và
     * mệnh giá trong dự án luôn là số nguyên.
     */
    private static void putNumber(Map<String, String> params, String key, Double value) {
        if (value == null || value <= 0) {
            return;
        }
        if (value == Math.rint(value)) {
            params.put(key, String.valueOf((long) (double) value));
        } else {
            params.put(key, String.valueOf(value));
        }
    }
}
