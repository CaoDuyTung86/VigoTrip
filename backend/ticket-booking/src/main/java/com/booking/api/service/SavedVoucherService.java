package com.booking.api.service;

import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.entity.SavedVoucher;
import com.booking.api.entity.User;
import com.booking.api.entity.Voucher;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.SavedVoucherRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SavedVoucherService {

    private final SavedVoucherRepository savedVoucherRepository;
    private final VoucherRepository voucherRepository;
    private final UserRepository userRepository;
    private final VoucherService voucherService;

    @Transactional(readOnly = true)
    public List<VoucherPublicDTO> getSavedVouchers(String email, Long providerId, BigDecimal orderAmount) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        java.util.Set<String> usedCodes = voucherService.getUsedCodes(email);
        return savedVoucherRepository.findByUserId(user.getId()).stream()
                .map(SavedVoucher::getVoucher)
                .map(v -> voucherService.toPublicDTO(v, providerId, orderAmount, true, usedCodes))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isSaved(String email, Long voucherId) {
        return userRepository.findByEmail(email)
                .map(user -> savedVoucherRepository.existsByUserIdAndVoucherId(user.getId(), voucherId))
                .orElse(false);
    }

    @Transactional
    public void saveVoucher(String email, Long voucherId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (savedVoucherRepository.existsByUserIdAndVoucherId(user.getId(), voucherId)) {
            return;
        }
        // Mã đã bị admin tắt thì coi như không tồn tại. Trước đây chỗ này nhận MỌI id, và
        // GET /api/saved-vouchers trả lại nguyên mã của thứ đã lưu — nên chỉ cần đếm id từ 1 trở
        // lên là đọc được cả những mã đang ẩn khỏi trang ưu đãi. Cùng một câu báo lỗi cho cả hai
        // trường hợp, để câu trả lời không cho biết id đó có tồn tại hay không.
        Voucher voucher = voucherRepository.findById(voucherId)
                .filter(v -> !Boolean.FALSE.equals(v.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy voucher với ID: " + voucherId));
        SavedVoucher sv = new SavedVoucher();
        sv.setUser(user);
        sv.setVoucher(voucher);
        sv.setSavedAt(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        savedVoucherRepository.save(sv);
    }

    @Transactional
    public void unsaveVoucher(String email, Long voucherId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        savedVoucherRepository.deleteByUserIdAndVoucherId(user.getId(), voucherId);
    }
}
