package com.booking.api.service;

import com.booking.api.dto.VoucherPublicDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Luật của hành động có ghi dữ liệu do trợ lý đề xuất: đề xuất không ghi, chỉ chủ đề xuất mới xác
 * nhận được, mỗi đề xuất dùng một lần, và kiểm tra lại mã ngay lúc bấm.
 */
class ChatActionServiceTest {

    private static final String OWNER = "chinhchu@example.com";
    private static final String OTHER = "nguoikhac@example.com";

    private VoucherService voucherService;
    private SavedVoucherService savedVoucherService;
    private UserService userService;
    private AtomicLong nanos;
    private ChatActionService service;
    private List<VoucherPublicDTO> publicVouchers;

    @BeforeEach
    void setUp() {
        voucherService = mock(VoucherService.class);
        savedVoucherService = mock(SavedVoucherService.class);
        publicVouchers = new ArrayList<>(List.of(
                voucher(11L, "AUTUMN2026", true, null),
                voucher(12L, "SUMMER2026", false, "EXPIRED"),
                voucher(13L, "TET2027", false, "NOT_STARTED")));
        when(voucherService.getPublicVouchers(any(), any(), any())).thenAnswer(inv -> List.copyOf(publicVouchers));
        userService = mock(UserService.class);
        nanos = new AtomicLong();
        service = new ChatActionService(voucherService, savedVoucherService, userService, nanos::get);
    }

    private static VoucherPublicDTO voucher(Long id, String code, boolean available, String reasonCode) {
        return VoucherPublicDTO.builder()
                .id(id).code(code).discountPercent(12.0)
                .available(available)
                .unavailableReasonCode(reasonCode)
                .unavailableReason(reasonCode == null ? null : "lý do " + reasonCode)
                .build();
    }

    @Test
    @DisplayName("Đề xuất KHÔNG ghi gì — chỉ bấm xác nhận mới ghi")
    void deXuatKhongGhi() {
        ChatActionService.Proposal proposal = service.proposeSaveVoucher(OWNER, "AUTUMN2026");

        assertThat(proposal.created()).isTrue();
        verify(savedVoucherService, never()).saveVoucher(anyString(), any());
    }

    @Test
    @DisplayName("Khách vãng lai không có đề xuất nào")
    void khachVangLaiKhongDeXuatDuoc() {
        ChatActionService.Proposal proposal = service.proposeSaveVoucher(null, "AUTUMN2026");

        assertThat(proposal.created()).isFalse();
        assertThat(proposal.refusal()).contains("chưa đăng nhập");
    }

    @Test
    @DisplayName("Mã không có trong danh sách công khai thì không đề xuất — không mở thêm cách dò mã ẩn")
    void maKhongCongKhaiThiKhongDeXuat() {
        ChatActionService.Proposal proposal = service.proposeSaveVoucher(OWNER, "MA_AN_CUA_ADMIN");

        assertThat(proposal.created()).isFalse();
        assertThat(proposal.refusal()).contains("Không có mã");
    }

    @Test
    @DisplayName("Mã hết hạn thì không lưu, mã chưa tới ngày thì lưu trước được")
    void hetHanKhongLuuChuaToiNgayThiLuuDuoc() {
        assertThat(service.proposeSaveVoucher(OWNER, "SUMMER2026").created()).isFalse();
        assertThat(service.proposeSaveVoucher(OWNER, "TET2027").created()).isTrue();
    }

    @Test
    @DisplayName("Mã đã lưu từ trước thì không dựng thêm nút")
    void daLuuRoiThiKhongDeXuat() {
        when(savedVoucherService.isSaved(OWNER, 11L)).thenReturn(true);

        ChatActionService.Proposal proposal = service.proposeSaveVoucher(OWNER, "AUTUMN2026");

        assertThat(proposal.created()).isFalse();
        assertThat(proposal.refusal()).contains("ĐÃ CÓ SẴN");
    }

    @Test
    @DisplayName("Tên mã không phân biệt hoa thường")
    void khongPhanBietHoaThuong() {
        assertThat(service.proposeSaveVoucher(OWNER, "autumn2026").created()).isTrue();
    }

    @Test
    @DisplayName("Người khác không mở, không bấm được đề xuất — và cũng không làm mất nút của chủ")
    void nguoiKhacKhongDungDuoc() {
        String token = service.proposeSaveVoucher(OWNER, "AUTUMN2026").token();

        assertThat(service.describe(token, OTHER)).isEmpty();
        assertThat(service.confirm(token, OTHER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
        assertThat(service.cancel(token, OTHER)).isFalse();

        assertThat(service.describe(token, OWNER)).isPresent();
        assertThat(service.confirm(token, OWNER)).isEqualTo(ChatActionService.ConfirmResult.SAVED);
        verify(savedVoucherService, times(1)).saveVoucher(OWNER, 11L);
        verify(savedVoucherService, never()).saveVoucher(eq(OTHER), any());
    }

    @Test
    @DisplayName("Bấm xác nhận hai lần chỉ ghi một lần")
    void moiDeXuatDungMotLan() {
        String token = service.proposeSaveVoucher(OWNER, "AUTUMN2026").token();

        assertThat(service.confirm(token, OWNER)).isEqualTo(ChatActionService.ConfirmResult.SAVED);
        assertThat(service.confirm(token, OWNER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
        verify(savedVoucherService, times(1)).saveVoucher(anyString(), any());
    }

    @Test
    @DisplayName("Mã đề xuất tự nghĩ ra thì không tồn tại")
    void maDeXuatBiaThiKhongCo() {
        assertThat(service.confirm("AAAAAAAAAAAAAAAAAAAAAA", OWNER))
                .isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
    }

    @Test
    @DisplayName("Quá 10 phút thì đề xuất hết hạn")
    void quaHanThiHetHieuLuc() {
        String token = service.proposeSaveVoucher(OWNER, "AUTUMN2026").token();

        nanos.addAndGet(ChatActionService.TTL.plusSeconds(1).toNanos());

        assertThat(service.confirm(token, OWNER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
        verify(savedVoucherService, never()).saveVoucher(anyString(), any());
    }

    @Test
    @DisplayName("Admin tắt mã trong lúc khách còn đọc thì bấm xác nhận không lưu")
    void maBiTatGiuaChungThiKhongLuu() {
        String token = service.proposeSaveVoucher(OWNER, "AUTUMN2026").token();
        publicVouchers.removeIf(v -> "AUTUMN2026".equals(v.getCode()));

        assertThat(service.describe(token, OWNER)).get()
                .extracting(ChatActionService.ActionView::status).isEqualTo("UNAVAILABLE");
        assertThat(service.confirm(token, OWNER))
                .isEqualTo(ChatActionService.ConfirmResult.NO_LONGER_AVAILABLE);
        verify(savedVoucherService, never()).saveVoucher(anyString(), any());
    }

    @Test
    @DisplayName("Bỏ qua thì nút không bấm được nữa")
    void boQuaThiHetDung() {
        String token = service.proposeSaveVoucher(OWNER, "AUTUMN2026").token();

        assertThat(service.cancel(token, OWNER)).isTrue();
        assertThat(service.confirm(token, OWNER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
    }

    // ------------------------------------------------------------------ cài đặt thư

    private void ownerHasSettings(boolean tripReminders, String language) {
        when(userService.getProfile(OWNER)).thenReturn(com.booking.api.dto.UserResponse.builder()
                .email(OWNER).tripReminderOptIn(tripReminders).language(language).build());
    }

    @Test
    @DisplayName("Cài đặt thư: đề xuất KHÔNG ghi, bấm xác nhận mới ghi — đúng một lần")
    void caiDatThuChiGhiKhiXacNhan() {
        ownerHasSettings(true, "vi");

        ChatActionService.Proposal proposal = service.proposeMailPreferences(OWNER, false, "en");
        assertThat(proposal.created()).isTrue();
        verify(userService, never()).updateMailPreferences(anyString(), any(), any());

        assertThat(service.confirm(proposal.token(), OWNER)).isEqualTo(ChatActionService.ConfirmResult.SAVED);
        assertThat(service.confirm(proposal.token(), OWNER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
        verify(userService, times(1)).updateMailPreferences(OWNER, false, "en");
    }

    @Test
    @DisplayName("Cài đặt thư: phần đã đúng thì bỏ khỏi đề xuất, đúng hết thì không có nút")
    void caiDatThuBoPhanDaDung() {
        ownerHasSettings(false, "en");

        assertThat(service.proposeMailPreferences(OWNER, false, "EN").refusal()).contains("ĐÃ ĐÚNG NHƯ KHÁCH MUỐN");

        ChatActionService.Proposal proposal = service.proposeMailPreferences(OWNER, false, "vi");
        assertThat(proposal.mailPreferences().tripReminders()).isNull();
        assertThat(proposal.mailPreferences().language()).isEqualTo("vi");

        service.confirm(proposal.token(), OWNER);
        verify(userService).updateMailPreferences(OWNER, null, "vi");
    }

    @Test
    @DisplayName("Cài đặt thư: ngôn ngữ lạ, không nói đổi gì, hay khách vãng lai đều không có nút")
    void caiDatThuTuChoi() {
        ownerHasSettings(true, "vi");

        assertThat(service.proposeMailPreferences(OWNER, null, "klingon").refusal()).contains("Không có ngôn ngữ");
        assertThat(service.proposeMailPreferences(OWNER, null, null).refusal()).contains("Cần biết khách muốn đổi gì");
        assertThat(service.proposeMailPreferences(null, false, null).refusal()).contains("chưa đăng nhập");
        verify(userService, never()).updateMailPreferences(anyString(), any(), any());
    }

    @Test
    @DisplayName("Cài đặt thư: ngôn ngữ chưa dịch thư được đánh dấu để nói trước với khách")
    void caiDatThuDanhDauNgonNguChuaDich() {
        ownerHasSettings(true, "vi");

        assertThat(service.proposeMailPreferences(OWNER, null, "ja").mailPreferences().languageHasMailTranslation())
                .isFalse();
        assertThat(service.proposeMailPreferences(OWNER, null, "en").mailPreferences().languageHasMailTranslation())
                .isTrue();
    }

    @Test
    @DisplayName("Cài đặt thư: người khác không mở, không bấm được đề xuất")
    void caiDatThuNguoiKhacKhongDungDuoc() {
        ownerHasSettings(true, "vi");
        String token = service.proposeMailPreferences(OWNER, false, null).token();

        assertThat(service.describe(token, OTHER)).isEmpty();
        assertThat(service.confirm(token, OTHER)).isEqualTo(ChatActionService.ConfirmResult.NOT_FOUND);
        verify(userService, never()).updateMailPreferences(anyString(), any(), any());

        assertThat(service.describe(token, OWNER)).get()
                .extracting(ChatActionService.ActionView::type).isEqualTo(ChatActionService.TYPE_MAIL_PREFERENCES);
    }
}
