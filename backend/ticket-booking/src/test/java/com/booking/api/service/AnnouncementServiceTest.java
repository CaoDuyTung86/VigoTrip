package com.booking.api.service;

import com.booking.api.dto.AnnouncementDTO;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Voucher;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Dải tin chạy — nguồn tin suy từ voucher")
class AnnouncementServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));

    @Mock
    private VoucherRepository voucherRepository;

    @InjectMocks
    private AnnouncementService service;

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
        List<Voucher> nhieu = IntStream.rangeClosed(1, AnnouncementService.MAX_ITEMS + 5)
                .mapToObj(i -> voucher(i, "MA" + i, null, NOW.plusDays(i)))
                .toList();

        when(voucherRepository.findByIsActiveTrue()).thenReturn(nhieu);

        assertThat(service.getActiveAnnouncements()).hasSize(AnnouncementService.MAX_ITEMS);
    }

    @Test
    @DisplayName("Tham số gửi đi là số thô, bỏ trường trống, có tên hãng khi mã giới hạn hãng")
    void thamSoDungSanChoClientGhepCau() {
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
}
