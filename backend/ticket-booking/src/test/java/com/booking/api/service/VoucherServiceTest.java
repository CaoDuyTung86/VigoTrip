package com.booking.api.service;

import com.booking.api.entity.User;
import com.booking.api.entity.Voucher;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.SavedVoucherRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoucherServiceTest {

    @Mock
    private VoucherRepository voucherRepository; // Tạo Repository "giả"

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SavedVoucherRepository savedVoucherRepository;

    @InjectMocks
    private VoucherService voucherService; // Tiêm Repository giả vào Service thật

    private Voucher mockVoucher;

    @BeforeEach
    void setUp() {
        // Chuẩn bị dữ liệu mẫu trước mỗi bài test
        mockVoucher = new Voucher();
        mockVoucher.setId(1L);
        mockVoucher.setCode("DISCOUNT10");
        mockVoucher.setDiscountPercent(10.0);
        mockVoucher.setIsActive(true);
        mockVoucher.setCurrentUsage(0);
        mockVoucher.setMaxUsage(100);
        mockVoucher.setMinOrderAmount(50000.0);
        mockVoucher.setMaxDiscountAmount(20000.0);
    }

    @Test
    @DisplayName("Nên trả về hợp lệ khi mã đúng và đủ điều kiện")
    void shouldReturnValidWhenVoucherIsCorrect() {
        // Giả lập: khi repository tìm mã "DISCOUNT10", trả về mockVoucher
        when(voucherRepository.findByCodeIgnoreCase("DISCOUNT10")).thenReturn(Optional.of(mockVoucher));

        // Chạy hàm thật
        Map<String, Object> result = voucherService.validateVoucher("DISCOUNT10", java.math.BigDecimal.valueOf(100000), null);

        // Kiểm tra kết quả (Assert)
        assertTrue((Boolean) result.get("valid"));
        assertEquals(java.math.BigDecimal.valueOf(10000.0).setScale(2, java.math.RoundingMode.HALF_UP),
                result.get("discountAmount")); // 10% của 100k là 10k

        // Kiểm tra message có chứa các thông tin quan trọng (không check cứng dấu
        // chấm/phẩy)
        String message = result.get("message").toString();
        assertTrue(message.contains("thành công"));
        assertTrue(message.contains("10"));
        assertTrue(message.contains("VND"));
    }

    @Test
    @DisplayName("Nên trả về không hợp lệ khi đơn hàng không đủ giá trị tối thiểu")
    void shouldReturnInvalidWhenAmountIsLow() {
        when(voucherRepository.findByCodeIgnoreCase("DISCOUNT10")).thenReturn(Optional.of(mockVoucher));

        // Đơn hàng chỉ 30k, trong khi tối thiểu là 50k
        Map<String, Object> result = voucherService.validateVoucher("DISCOUNT10", java.math.BigDecimal.valueOf(30000), null);

        assertFalse((Boolean) result.get("valid"));
        assertTrue(result.get("message").toString().contains("Đơn hàng tối thiểu"));
    }

    @Test
    @DisplayName("Nên trả về không hợp lệ khi mã không tồn tại")
    void shouldReturnInvalidWhenVoucherNotFound() {
        when(voucherRepository.findByCodeIgnoreCase("WRONG")).thenReturn(Optional.empty());

        Map<String, Object> result = voucherService.validateVoucher("WRONG", java.math.BigDecimal.valueOf(100000), null);

        assertFalse((Boolean) result.get("valid"));
        assertEquals("Mã giảm giá \"WRONG\" không tồn tại.", result.get("message"));
    }

    @Test
    @DisplayName("Nên báo đã dùng khi tài khoản đã áp mã này cho một đơn khác")
    void shouldRejectWhenUserAlreadyUsedCode() {
        when(voucherRepository.findByCodeIgnoreCase("DISCOUNT10")).thenReturn(Optional.of(mockVoucher));

        User user = new User();
        user.setId(7L);
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findUsedVoucherCodesByUserId(7L)).thenReturn(List.of("DISCOUNT10"));

        Map<String, Object> result = voucherService.validateVoucherForUser(
                "discount10", java.math.BigDecimal.valueOf(100000), null, "a@b.com");

        assertFalse((Boolean) result.get("valid"));
        assertTrue((Boolean) result.get("alreadyUsed"));
        assertTrue(result.get("message").toString().contains("1 lần"));
    }

    @Test
    @DisplayName("Vẫn hợp lệ khi tài khoản chưa từng dùng mã này")
    void shouldAcceptWhenUserHasNotUsedCode() {
        when(voucherRepository.findByCodeIgnoreCase("DISCOUNT10")).thenReturn(Optional.of(mockVoucher));

        User user = new User();
        user.setId(7L);
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        when(bookingRepository.findUsedVoucherCodesByUserId(7L)).thenReturn(List.of("OTHERCODE"));

        Map<String, Object> result = voucherService.validateVoucherForUser(
                "DISCOUNT10", java.math.BigDecimal.valueOf(100000), null, "a@b.com");

        assertTrue((Boolean) result.get("valid"));
    }

    @Test
    @DisplayName("Khách chưa đăng nhập thì chỉ kiểm tra điều kiện chung của mã")
    void shouldSkipUsedCheckForAnonymousUser() {
        when(voucherRepository.findByCodeIgnoreCase("DISCOUNT10")).thenReturn(Optional.of(mockVoucher));

        Map<String, Object> result = voucherService.validateVoucherForUser(
                "DISCOUNT10", java.math.BigDecimal.valueOf(100000), null, null);

        assertTrue((Boolean) result.get("valid"));
    }

    @Test
    @DisplayName("Xóa voucher chưa ai dùng thì gỡ khỏi ví người dùng trước rồi mới xóa bản ghi")
    void shouldClearSavedVouchersBeforeDeletingVoucher() {
        when(voucherRepository.findById(1L)).thenReturn(Optional.of(mockVoucher));
        when(bookingRepository.countByVoucherCodeIgnoreCase("DISCOUNT10")).thenReturn(0L);
        when(savedVoucherRepository.deleteByVoucherId(1L)).thenReturn(3);

        voucherService.deleteVoucher(1L);

        // Đúng thứ tự mới tránh được lỗi khóa ngoại (409) từ saved_vouchers.
        org.mockito.InOrder order = inOrder(savedVoucherRepository, voucherRepository);
        order.verify(savedVoucherRepository).deleteByVoucherId(1L);
        order.verify(voucherRepository).deleteById(1L);
    }

    @Test
    @DisplayName("Voucher đã nằm trên đơn thì chặn xóa cứng và mời admin tắt thay vì xóa")
    void shouldRejectDeletingVoucherUsedInBookings() {
        when(voucherRepository.findById(1L)).thenReturn(Optional.of(mockVoucher));
        when(bookingRepository.countByVoucherCodeIgnoreCase("DISCOUNT10")).thenReturn(4L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> voucherService.deleteVoucher(1L));

        assertTrue(ex.getMessage().contains("4 đơn"));
        assertTrue(ex.getMessage().contains("tắt"));
        // Không được đụng vào ví người dùng khi đã quyết định chặn.
        org.mockito.Mockito.verifyNoInteractions(savedVoucherRepository);
        org.mockito.Mockito.verify(voucherRepository, org.mockito.Mockito.never()).deleteById(1L);
    }

    @Test
    @DisplayName("currentUsage về 0 do khách hủy đơn vẫn không cho xóa cứng")
    void shouldStillBlockDeleteWhenUsageCounterWasRolledBack() {
        // Voucher từng được dùng rồi khách hủy: decrementUsageByCode đã kéo currentUsage về 0,
        // nhưng đơn cũ vẫn còn trong dat_ve nên xóa đi là mất dữ liệu đối soát.
        mockVoucher.setCurrentUsage(0);
        when(voucherRepository.findById(1L)).thenReturn(Optional.of(mockVoucher));
        when(bookingRepository.countByVoucherCodeIgnoreCase("DISCOUNT10")).thenReturn(1L);

        assertThrows(IllegalArgumentException.class, () -> voucherService.deleteVoucher(1L));

        org.mockito.Mockito.verify(voucherRepository, org.mockito.Mockito.never()).deleteById(1L);
    }

    @Test
    @DisplayName("Xóa voucher không tồn tại thì báo lỗi và không đụng vào ví người dùng")
    void shouldRejectDeletingUnknownVoucher() {
        when(voucherRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> voucherService.deleteVoucher(99L));

        org.mockito.Mockito.verifyNoInteractions(savedVoucherRepository);
        org.mockito.Mockito.verify(voucherRepository, org.mockito.Mockito.never()).deleteById(99L);
    }

    @Test
    @DisplayName("Tắt voucher chỉ đổi cờ isActive, không xóa bản ghi")
    void shouldDisableVoucherWithoutDeleting() {
        when(voucherRepository.findById(1L)).thenReturn(Optional.of(mockVoucher));
        when(voucherRepository.save(mockVoucher)).thenReturn(mockVoucher);

        Voucher result = voucherService.setVoucherActive(1L, false);

        assertFalse(result.getIsActive());
        org.mockito.Mockito.verify(voucherRepository, org.mockito.Mockito.never()).deleteById(1L);
        org.mockito.Mockito.verifyNoInteractions(savedVoucherRepository);
    }

    @Test
    @DisplayName("Bật lại voucher đã tắt")
    void shouldReEnableDisabledVoucher() {
        mockVoucher.setIsActive(false);
        when(voucherRepository.findById(1L)).thenReturn(Optional.of(mockVoucher));
        when(voucherRepository.save(mockVoucher)).thenReturn(mockVoucher);

        assertTrue(voucherService.setVoucherActive(1L, true).getIsActive());
    }
}
