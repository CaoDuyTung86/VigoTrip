package com.booking.api.service;

import com.booking.api.dto.AnnouncementDTO;
import com.booking.api.entity.Announcement;
import com.booking.api.entity.Voucher;
import com.booking.api.enums.AnnouncementKind;
import com.booking.api.repository.AnnouncementRepository;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
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
 * Nguồn dữ liệu cho dải tin chạy trên Header. Hợp nhất hai nguồn:
 *
 * <ol>
 *   <li><b>Tin nhập tay</b> — bảng {@code thong_bao}, do Admin đăng: tuyến mới mở bán, lịch bảo
 *       trì. Câu chữ là nguyên văn hai thứ tiếng vì không có dữ liệu nào để suy ra nó.</li>
 *   <li><b>Tin suy từ voucher</b> — mã đang hiệu lực và có bật cờ hiện trên bảng tin. Cùng tập
 *       dữ liệu mà trang /uu-dai vốn đã công khai cho khách vãng lai, nên dải tin không mở thêm
 *       thứ gì ra ngoài; nó chỉ là một lối vào khác của cùng nội dung đó.</li>
 * </ol>
 *
 * <p><b>Tin nhập tay đứng trước.</b> Chỗ trong dải tin có hạn ({@link #MAX_ITEMS}), nên thứ tự
 * hợp nhất chính là thứ tự ưu tiên. Tin nhập tay thắng vì có người quyết định đăng nó vào đúng
 * lúc này, còn tin voucher thì tự sinh ra từ việc có một mã còn hạn — một thông báo bảo trì bị
 * đẩy khỏi dải tin bởi bốn mã giảm giá là cái giá không đáng trả.
 *
 * <p>KHÔNG dùng WebSocket: tin đổi vài lần mỗi tuần chứ không phải từng giây như trạng thái ghế.
 * Một endpoint công khai + cache ngắn phía máy chủ + client gọi lại khi cửa sổ được focus là đủ,
 * và không bắt mọi khách vãng lai giữ một kết nối thường trực chỉ để nhận một dải quảng cáo.
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
    private final AnnouncementRepository announcementRepository;

    /**
     * Danh sách tin đang hiệu lực, đã sắp xếp và cắt ngọn.
     *
     * Cache "announcements" (5 phút) đứng trước CSDL vì endpoint này công khai và được gọi
     * lại mỗi lần người dùng quay lại tab — không cache thì mỗi lượt chuyển tab là hai lượt
     * đọc bảng. Mọi thao tác sửa voucher (xem VoucherService) và sửa tin nhập tay (xem các
     * phương thức quản trị ở dưới) đều xóa cache này, nên Admin đăng hay tắt một mẩu tin thì
     * dải tin đổi theo ngay chứ không phải chờ hết 5 phút.
     */
    @Cacheable("announcements")
    @Transactional(readOnly = true)
    public List<AnnouncementDTO> getActiveAnnouncements() {
        LocalDateTime now = LocalDateTime.now(ZONE);

        List<AnnouncementDTO> items = new ArrayList<>(MAX_ITEMS);

        for (Announcement manual : announcementRepository.findLive(now)) {
            if (items.size() >= MAX_ITEMS) {
                break;
            }
            // Tin không có chữ nào thì bỏ: frontend sẽ lọc nó ra khỏi dải tin, nhưng nó vẫn
            // kịp chiếm một suất trong MAX_ITEMS và đẩy một mẩu tin thật ra ngoài.
            if (manual.getContentVi() == null || manual.getContentVi().isBlank()) {
                continue;
            }
            items.add(toAnnouncement(manual));
        }

        List<Voucher> live = voucherRepository.findByIsActiveTrue().stream()
                // null = bật, xem Voucher.showOnTicker: cột thêm sau nên bản ghi cũ đều mang null.
                .filter(v -> v.getShowOnTicker() == null || v.getShowOnTicker())
                .filter(v -> v.getStartDate() == null || !now.isBefore(v.getStartDate()))
                .filter(v -> v.getExpiryDate() == null || !now.isAfter(v.getExpiryDate()))
                .filter(v -> v.getMaxUsage() == null
                        || v.getCurrentUsage() == null
                        || v.getCurrentUsage() < v.getMaxUsage())
                .filter(v -> v.getCode() != null && !v.getCode().isBlank())
                .sorted(EXPIRY_FIRST)
                .limit(Math.max(0, MAX_ITEMS - items.size()))
                .toList();

        for (Voucher v : live) {
            items.add(toAnnouncement(v));
        }
        return items;
    }

    // ---------------------------------------------------------- quản trị tin nhập tay

    /**
     * Toàn bộ tin nhập tay cho màn quản trị, kể cả tin đã tắt và tin hết hạn.
     *
     * <p>Trả về entity chứ không phải {@link AnnouncementDTO}: màn quản trị cần đúng những gì
     * đã lưu (cặp hiệu lực, thứ tự, công tắc) để điền lại vào form, trong khi DTO là hình dạng
     * đã nấu chín cho dải tin và cố tình không mang mấy trường đó.
     */
    @Transactional(readOnly = true)
    public List<Announcement> getAllForAdmin() {
        return announcementRepository.findAllByOrderBySortOrderAscIdDesc();
    }

    @Transactional
    @CacheEvict(value = "announcements", allEntries = true)
    public Announcement create(Announcement data) {
        validate(data);
        data.setId(null);
        applyDefaults(data);
        return announcementRepository.save(data);
    }

    @Transactional
    @CacheEvict(value = "announcements", allEntries = true)
    public Announcement update(Long id, Announcement data) {
        validate(data);
        Announcement tin = announcementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông báo với ID: " + id));

        tin.setContentVi(data.getContentVi().trim());
        tin.setContentEn(blankToNull(data.getContentEn()));
        tin.setLink(blankToNull(data.getLink()));
        tin.setKind(data.getKind() == null ? AnnouncementKind.INFO : data.getKind());
        tin.setStartsAt(data.getStartsAt());
        tin.setEndsAt(data.getEndsAt());
        tin.setSortOrder(data.getSortOrder() == null ? 0 : data.getSortOrder());
        if (data.getActive() != null) {
            tin.setActive(data.getActive());
        }
        return announcementRepository.save(tin);
    }

    /** Bật/tắt một mẩu tin — cách gỡ mặc định, giữ lại bản ghi để đăng lại được. */
    @Transactional
    @CacheEvict(value = "announcements", allEntries = true)
    public Announcement setActive(Long id, boolean active) {
        Announcement tin = announcementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông báo với ID: " + id));
        tin.setActive(active);
        return announcementRepository.save(tin);
    }

    /**
     * Xóa hẳn một mẩu tin.
     *
     * <p>Khác voucher, ở đây xóa thẳng không cần kiểm tra gì: không đơn hàng nào trỏ tới một
     * mẩu thông báo, nên không có dữ liệu đối soát nào mất theo.
     */
    @Transactional
    @CacheEvict(value = "announcements", allEntries = true)
    public void delete(Long id) {
        if (!announcementRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy thông báo với ID: " + id);
        }
        announcementRepository.deleteById(id);
    }

    /**
     * Hai điều kiện, cả hai đều là thứ không sửa được sau khi đã đăng sai.
     *
     * <p>Bản tiếng Việt bắt buộc vì đó là bản dự phòng khi thiếu bản dịch — thiếu nó thì mẩu
     * tin lặng lẽ biến mất khỏi dải tin và người đăng không hiểu vì sao. Mốc kết thúc phải sau
     * mốc bắt đầu, nếu không tin sẽ không bao giờ hiện mà cũng không có gì báo lỗi.
     */
    private void validate(Announcement data) {
        if (data.getContentVi() == null || data.getContentVi().isBlank()) {
            throw new IllegalArgumentException("Nội dung tiếng Việt không được để trống");
        }
        if (data.getStartsAt() != null && data.getEndsAt() != null
                && !data.getEndsAt().isAfter(data.getStartsAt())) {
            throw new IllegalArgumentException("Thời điểm hết hiệu lực phải sau thời điểm bắt đầu");
        }
    }

    private void applyDefaults(Announcement data) {
        data.setContentVi(data.getContentVi().trim());
        data.setContentEn(blankToNull(data.getContentEn()));
        data.setLink(blankToNull(data.getLink()));
        if (data.getKind() == null) {
            data.setKind(AnnouncementKind.INFO);
        }
        if (data.getSortOrder() == null) {
            data.setSortOrder(0);
        }
        if (data.getActive() == null) {
            data.setActive(true);
        }
    }

    /** Chuỗi rỗng từ form và null từ API phải ra cùng một thứ trong CSDL. */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // ------------------------------------------------------------------- dựng DTO

    /**
     * Mã sắp hết hạn lên trước — đó là tin duy nhất trong danh sách có tính thời điểm; mã
     * không hạn thì lúc nào đọc cũng được nên xuống cuối. Cùng hạn thì mã giảm sâu hơn
     * đứng trước.
     */
    private static final Comparator<Voucher> EXPIRY_FIRST =
            Comparator.comparing(Voucher::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(v -> v.getDiscountPercent() == null ? 0d : -v.getDiscountPercent());

    /**
     * Tin nhập tay gửi nguyên văn, không gửi {@code params}.
     *
     * <p>Đây là chỗ khác nhau căn bản giữa hai nguồn: câu tin voucher do frontend ghép từ bảng
     * dịch nên đổi ngôn ngữ là đổi ngay, còn câu tin nhập tay thì chỉ có đúng hai bản mà người
     * đăng đã viết. Không có bảng dịch nào chứa được một câu vừa gõ xong.
     */
    private AnnouncementDTO toAnnouncement(Announcement tin) {
        return AnnouncementDTO.builder()
                .id("notice:" + tin.getId())
                .kind(tin.getKind().name())
                .textVi(tin.getContentVi())
                .textEn(tin.getContentEn())
                .link(tin.getLink())
                .endsAt(tin.getEndsAt())
                .build();
    }

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
