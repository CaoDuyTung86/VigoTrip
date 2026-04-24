package com.booking.api.service;

import com.booking.api.entity.Voucher;
import com.booking.api.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoucherServiceTest {

    @Mock
    private VoucherRepository voucherRepository; // Tạo Repository "giả"

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
        Map<String, Object> result = voucherService.validateVoucher("DISCOUNT10", 100000.0);

        // Kiểm tra kết quả (Assert)
        assertTrue((Boolean) result.get("valid"));
        assertEquals(10000.0, (Double) result.get("discountAmount")); // 10% của 100k là 10k

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
        Map<String, Object> result = voucherService.validateVoucher("DISCOUNT10", 30000.0);

        assertFalse((Boolean) result.get("valid"));
        assertTrue(result.get("message").toString().contains("Đơn hàng tối thiểu"));
    }

    @Test
    @DisplayName("Nên trả về không hợp lệ khi mã không tồn tại")
    void shouldReturnInvalidWhenVoucherNotFound() {
        when(voucherRepository.findByCodeIgnoreCase("WRONG")).thenReturn(Optional.empty());

        Map<String, Object> result = voucherService.validateVoucher("WRONG", 100000.0);

        assertFalse((Boolean) result.get("valid"));
        assertEquals("Mã giảm giá \"WRONG\" không tồn tại.", result.get("message"));
    }
}
