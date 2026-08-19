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

    @Transactional
    public void saveVoucher(String email, Long voucherId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (savedVoucherRepository.existsByUserIdAndVoucherId(user.getId(), voucherId)) {
            return;
        }
        Voucher voucher = voucherRepository.findById(voucherId)
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
