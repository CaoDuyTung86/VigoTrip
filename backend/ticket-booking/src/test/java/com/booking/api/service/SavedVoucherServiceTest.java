package com.booking.api.service;

import com.booking.api.entity.SavedVoucher;
import com.booking.api.entity.User;
import com.booking.api.entity.Voucher;
import com.booking.api.repository.SavedVoucherRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * POST /api/saved-vouchers/{id} từng nhận mọi id, kể cả mã admin đã tắt, và GET trả lại nguyên
 * mã của thứ đã lưu — đếm id từ 1 trở lên là đọc được mã đang ẩn.
 */
class SavedVoucherServiceTest {

    private static final String EMAIL = "khach@example.com";

    private SavedVoucherRepository savedVoucherRepository;
    private VoucherRepository voucherRepository;
    private SavedVoucherService service;

    @BeforeEach
    void setUp() {
        savedVoucherRepository = mock(SavedVoucherRepository.class);
        voucherRepository = mock(VoucherRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        service = new SavedVoucherService(savedVoucherRepository, voucherRepository, userRepository,
                mock(VoucherService.class));
    }

    private static Voucher voucher(Long id, Boolean active) {
        Voucher v = new Voucher();
        v.setId(id);
        v.setCode("MA" + id);
        v.setIsActive(active);
        return v;
    }

    @Test
    @DisplayName("Mã đã bị tắt thì không lưu được, và báo lỗi y như id không tồn tại")
    void maDaTatKhongLuuDuoc() {
        when(voucherRepository.findById(5L)).thenReturn(Optional.of(voucher(5L, false)));
        when(voucherRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.saveVoucher(EMAIL, 5L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Không tìm thấy voucher với ID: 5");
        assertThatThrownBy(() -> service.saveVoucher(EMAIL, 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Không tìm thấy voucher với ID: 99");
        verify(savedVoucherRepository, never()).save(any());
    }

    @Test
    @DisplayName("Mã đang bật thì lưu; cờ null của bản ghi cũ được hiểu là đang bật")
    void maDangBatThiLuu() {
        when(voucherRepository.findById(6L)).thenReturn(Optional.of(voucher(6L, null)));

        service.saveVoucher(EMAIL, 6L);

        verify(savedVoucherRepository).save(any(SavedVoucher.class));
    }
}
