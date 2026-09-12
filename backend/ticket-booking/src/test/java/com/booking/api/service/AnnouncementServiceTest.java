package com.booking.api.service;

import com.booking.api.dto.AnnouncementDTO;
import com.booking.api.entity.Announcement;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Voucher;
import com.booking.api.enums.AnnouncementKind;
import com.booking.api.repository.AnnouncementRepository;
import com.booking.api.repository.VoucherRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Dải tin chạy — hợp nhất tin nhập tay và tin suy từ voucher")
class AnnouncementServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));

    @Mock
    private VoucherRepository voucherRepository;

    @Mock
    private AnnouncementRepository announcementRepository;

    @InjectMocks
    private AnnouncementService service;

    /**
     * Phần lớn bài kiểm tra dưới đây chỉ quan tâm nhánh voucher. Khai báo sẵn "không có tin
     * nhập tay nào" ở từng bài thay vì một @BeforeEach dùng chung: Mockito nghiêm ngặt sẽ báo
     * stubbing thừa ở đúng những bài không đụng tới bảng thong_bao.
     */
    private void khongCoTinNhapTay() {
        when(announcementRepository.findLive(any())).thenReturn(List.of());
    }

    private static Announcement tin(long id, String vi, String en) {
        Announcement a = new Announcement();
        a.setId(id);
        a.setContentVi(vi);
        a.setContentEn(en);
        a.setKind(AnnouncementKind.MAINTENANCE);
        a.setActive(true);
        a.setSortOrder(0);
        return a;
    }

    private static Voucher voucher(long id, String code, LocalDateTime start, LocalDateTime expiry) {
        Voucher v = new Voucher();
        v.setId(id);
        v.setCode(code);
        v.setDiscountPercent(20d);
        v.setStartDate(start);
        v.setExpiryDate(expiry);
        v.setIsActive(true);
        v.setCurrentUsage(0);
        return v;
    }

    @Test
    @DisplayName("Loại mã hết hạn, mã chưa tới ngày và mã đã cạn lượt")
    void locNhungMaKhongConDung() {
        khongCoTinNhapTay();
        Voucher hetHan = voucher(1L, "HETHAN", null, NOW.minusDays(1));
        Voucher chuaToi = voucher(2L, "CHUATOI", NOW.plusDays(1), null);
        Voucher canLuot = voucher(3L, "CANLUOT", null, NOW.plusDays(5));
        canLuot.setMaxUsage(10);
        canLuot.setCurrentUsage(10);
        Voucher hopLe = voucher(4L, "HOPLE", null, NOW.plusDays(5));

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(hetHan, chuaToi, canLuot, hopLe));

        assertThat(service.getActiveAnnouncements())
                .extracting(AnnouncementDTO::getId)
                .containsExactly("voucher:4");
    }

    @Test
    @DisplayName("Mã sắp hết hạn lên trước, mã không có hạn xuống cuối")
    void sapXepTheoHanSuDung() {
        khongCoTinNhapTay();
        Voucher khongHan = voucher(1L, "KHONGHAN", null, null);
        Voucher hanXa = voucher(2L, "HANXA", null, NOW.plusDays(30));
        Voucher hanGan = voucher(3L, "HANGAN", null, NOW.plusHours(6));

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(khongHan, hanXa, hanGan));

        assertThat(service.getActiveAnnouncements())
                .extracting(a -> a.getParams().get("code"))
                .containsExactly("HANGAN", "HANXA", "KHONGHAN");
    }

    @Test
    @DisplayName("Không bao giờ trả quá MAX_ITEMS mẩu tin")
    void catNgonDanhSach() {
        khongCoTinNhapTay();
        List<Voucher> nhieu = IntStream.rangeClosed(1, AnnouncementService.MAX_ITEMS + 5)
                .mapToObj(i -> voucher(i, "MA" + i, null, NOW.plusDays(i)))
                .toList();

        when(voucherRepository.findByIsActiveTrue()).thenReturn(nhieu);

        assertThat(service.getActiveAnnouncements()).hasSize(AnnouncementService.MAX_ITEMS);
    }

    @Test
    @DisplayName("Tham số gửi đi là số thô, bỏ trường trống, có tên hãng khi mã giới hạn hãng")
    void thamSoDungSanChoClientGhepCau() {
        khongCoTinNhapTay();
        Provider hang = new Provider();
        hang.setProviderName("VietJet Air");

        Voucher v = voucher(7L, "SUMMER", null, NOW.plusDays(3));
        v.setDiscountPercent(15d);
        v.setMaxDiscountAmount(200000d);
        v.setMinOrderAmount(0d);   // 0 = không có điều kiện, không được gửi đi
        v.setProvider(hang);

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(v));

        AnnouncementDTO tin = service.getActiveAnnouncements().get(0);

        assertThat(tin.getKind()).isEqualTo("VOUCHER");
        assertThat(tin.getLink()).isEqualTo("/uu-dai?code=SUMMER");
        assertThat(tin.getEndsAt()).isEqualTo(v.getExpiryDate());
        assertThat(tin.getTextVi()).isNull();
        assertThat(tin.getParams())
                .containsEntry("code", "SUMMER")
                .containsEntry("percent", "15")
                .containsEntry("maxDiscount", "200000")
                .containsEntry("provider", "VietJet Air")
                .doesNotContainKey("minOrder");
    }

    @Test
    @DisplayName("Tin nhập tay gửi nguyên văn hai thứ tiếng, không kèm params")
    void tinNhapTayGuiNguyenVan() {
        Announcement baoTri = tin(3L, "Bảo trì hệ thống 02:00 - 04:00 ngày 20/09", "Maintenance 02:00 - 04:00 on 20 Sep");
        baoTri.setEndsAt(NOW.plusDays(2));
        when(announcementRepository.findLive(any())).thenReturn(List.of(baoTri));
        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of());

        AnnouncementDTO dto = service.getActiveAnnouncements().get(0);

        assertThat(dto.getId()).isEqualTo("notice:3");
        assertThat(dto.getKind()).isEqualTo("MAINTENANCE");
        assertThat(dto.getTextVi()).startsWith("Bảo trì");
        assertThat(dto.getTextEn()).startsWith("Maintenance");
        assertThat(dto.getParams()).isNull();
        assertThat(dto.getEndsAt()).isEqualTo(baoTri.getEndsAt());
    }

    @Test
    @DisplayName("Tin không khai đường dẫn thì để trống, không mặc định về trang ưu đãi")
    void tinKhongCoDuongDanThiDeTrong() {
        when(announcementRepository.findLive(any())).thenReturn(List.of(tin(4L, "Tuyến mới Hà Nội - Sa Pa", null)));
        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of());

        assertThat(service.getActiveAnnouncements().get(0).getLink()).isNull();
    }

    @Test
    @DisplayName("Tin nhập tay đứng trước tin voucher và cùng chịu trần MAX_ITEMS")
    void tinNhapTayDungTruocVaCungChiuTran() {
        List<Announcement> nhieuTin = IntStream.rangeClosed(1, 4)
                .mapToObj(i -> tin(i, "Tin " + i, null))
                .toList();
        List<Voucher> nhieuMa = IntStream.rangeClosed(1, 5)
                .mapToObj(i -> voucher(i, "MA" + i, null, NOW.plusDays(i)))
                .toList();

        when(announcementRepository.findLive(any())).thenReturn(nhieuTin);
        when(voucherRepository.findByIsActiveTrue()).thenReturn(nhieuMa);

        assertThat(service.getActiveAnnouncements())
                .hasSize(AnnouncementService.MAX_ITEMS)
                .extracting(AnnouncementDTO::getId)
                .containsExactly("notice:1", "notice:2", "notice:3", "notice:4", "voucher:1", "voucher:2");
    }

    @Test
    @DisplayName("Mã tắt cờ hiện trên bảng tin thì không lên dải tin, nhưng vẫn là mã đang bật")
    void maTatCoHienBangTinThiKhongLenDaiTin() {
        khongCoTinNhapTay();
        Voucher rieng = voucher(9L, "AI_PROMO_10", null, NOW.plusDays(30));
        rieng.setShowOnTicker(false);
        Voucher chung = voucher(10L, "SUMMER", null, NOW.plusDays(30));

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(rieng, chung));

        assertThat(service.getActiveAnnouncements())
                .extracting(AnnouncementDTO::getId)
                .containsExactly("voucher:10");
    }

    @Test
    @DisplayName("Cờ null của bản ghi cũ được hiểu là bật, không làm rỗng dải tin sau nâng cấp")
    void coNullHieuLaBat() {
        khongCoTinNhapTay();
        Voucher cu = voucher(11L, "CU", null, NOW.plusDays(3));
        cu.setShowOnTicker(null);

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(cu));

        assertThat(service.getActiveAnnouncements()).hasSize(1);
    }

    @Test
    @DisplayName("Thiếu bản tiếng Việt thì chặn ngay, không để tin lặng lẽ biến mất khỏi dải tin")
    void chanTinThieuBanTiengViet() {
        Announcement thieu = tin(0L, "  ", "English only");

        assertThatThrownBy(() -> service.create(thieu))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tiếng Việt");
    }

    @Test
    @DisplayName("Hạn kết thúc không sau hạn bắt đầu thì chặn — tin đó sẽ không bao giờ hiện")
    void chanCapHieuLucNguoc() {
        Announcement nguoc = tin(0L, "Bảo trì", null);
        nguoc.setStartsAt(NOW.plusDays(2));
        nguoc.setEndsAt(NOW.plusDays(1));

        assertThatThrownBy(() -> service.create(nguoc))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Tin rỗng chữ bị bỏ chứ không chiếm một suất trong dải tin")
    void tinRongChuKhongChiemCho() {
        Announcement rong = tin(5L, "   ", null);
        Announcement that = tin(6L, "Tuyến mới Hà Nội - Sa Pa", null);

        when(announcementRepository.findLive(any())).thenReturn(List.of(rong, that));
        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of());

        assertThat(service.getActiveAnnouncements())
                .extracting(AnnouncementDTO::getId)
                .containsExactly("notice:6");
    }
}
