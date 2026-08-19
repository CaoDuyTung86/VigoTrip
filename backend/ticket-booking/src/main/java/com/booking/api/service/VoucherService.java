package com.booking.api.service;

import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Voucher;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VoucherService {

    private final VoucherRepository voucherRepository;
    private final ProviderRepository providerRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    /**
     * Chuẩn hóa mã giảm giá (bỏ khoảng trắng + viết hoa) để mọi nơi so sánh/lưu trữ đều thống nhất.
     */
    public static String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Các mã người dùng đã dùng ở đơn chưa bị hủy. Trả về set rỗng nếu chưa đăng nhập.
     */
    @Transactional(readOnly = true)
    public Set<String> getUsedCodes(String email) {
        if (email == null || email.isBlank()) {
            return Set.of();
        }
        return userRepository.findByEmail(email)
                .map(u -> bookingRepository.findUsedVoucherCodesByUserId(u.getId()).stream()
                        .filter(c -> c != null && !c.isBlank())
                        .map(VoucherService::normalizeCode)
                        .collect(Collectors.toSet()))
                .orElseGet(Set::of);
    }

    /**
     * Validate mã cho một người dùng cụ thể: ngoài các điều kiện chung của voucher còn
     * chặn trường hợp tài khoản đã dùng mã này ở một đơn khác (mỗi mã chỉ dùng 1 lần / tài khoản).
     * email = null nghĩa là khách chưa đăng nhập — chỉ kiểm tra điều kiện chung.
     */
    public Map<String, Object> validateVoucherForUser(String code, java.math.BigDecimal orderAmount,
                                                      Long providerId, String email) {
        Map<String, Object> result = validateVoucher(code, orderAmount, providerId);
        if (!Boolean.TRUE.equals(result.get("valid"))) {
            return result;
        }
        if (getUsedCodes(email).contains(normalizeCode(code))) {
            Map<String, Object> used = new HashMap<>();
            used.put("valid", false);
            used.put("alreadyUsed", true);
            used.put("message", "Bạn đã sử dụng mã \"" + normalizeCode(code) + "\" cho một đơn hàng khác. Mỗi mã chỉ dùng được 1 lần.");
            return used;
        }
        return result;
    }

    /**
     * Validate và tính toán giảm giá cho một mã voucher.
     * Trả về Map chứa thông tin: valid, discountAmount, message, voucher.
     * providerId (có thể null): hãng phương tiện của chuyến đang đặt, dùng để kiểm tra
     * voucher có giới hạn riêng cho một hãng cụ thể hay không.
     */
    @Cacheable(value = "vouchers", key = "#code + #orderAmount + #providerId")
    public Map<String, Object> validateVoucher(String code, java.math.BigDecimal orderAmount, Long providerId) {
        Map<String, Object> result = new HashMap<>();

        if (code == null || code.isBlank()) {
            result.put("valid", false);
            result.put("message", "Vui lòng nhập mã giảm giá.");
            return result;
        }

        code = normalizeCode(code);
        Voucher voucher = voucherRepository.findByCodeIgnoreCase(code).orElse(null);

        if (voucher == null) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá \"" + code + "\" không tồn tại.");
            return result;
        }

        if (!voucher.getIsActive()) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã bị vô hiệu hóa.");
            return result;
        }

        if (voucher.getProvider() != null
                && (providerId == null || !voucher.getProvider().getId().equals(providerId))) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá chỉ áp dụng cho hãng \"" + voucher.getProvider().getProviderName() + "\".");
            return result;
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        if (voucher.getStartDate() != null && now.isBefore(voucher.getStartDate())) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá chưa đến ngày bắt đầu áp dụng.");
            return result;
        }

        if (voucher.getExpiryDate() != null && now.isAfter(voucher.getExpiryDate())) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã hết hạn.");
            return result;
        }

        if (voucher.getMaxUsage() != null && voucher.getCurrentUsage() >= voucher.getMaxUsage()) {
            result.put("valid", false);
            result.put("message", "Mã giảm giá đã hết lượt sử dụng.");
            return result;
        }

        if (voucher.getMinOrderAmount() != null
                && orderAmount.compareTo(java.math.BigDecimal.valueOf(voucher.getMinOrderAmount())) < 0) {
            result.put("valid", false);
            result.put("message", String.format("Đơn hàng tối thiểu %,.0f VND để áp dụng mã này.", voucher.getMinOrderAmount()));
            return result;
        }

        // Tính số tiền giảm
        double discountDouble = orderAmount.doubleValue() * (voucher.getDiscountPercent() / 100.0);
        if (voucher.getMaxDiscountAmount() != null && discountDouble > voucher.getMaxDiscountAmount()) {
            discountDouble = voucher.getMaxDiscountAmount();
        }
        java.math.BigDecimal discountAmount = java.math.BigDecimal.valueOf(discountDouble)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        result.put("valid", true);
        result.put("discountAmount", discountAmount);
        result.put("discountPercent", voucher.getDiscountPercent());
        result.put("message", String.format("Áp dụng thành công! Giảm %,.0f VND (%.0f%%).", discountDouble, voucher.getDiscountPercent()));
        result.put("voucherId", voucher.getId());
        return result;
    }

    /**
     * Tăng lượt sử dụng khi voucher được apply vào đơn hàng thật.
     * Dùng một câu UPDATE có điều kiện thay vì đọc — cộng — ghi, nên hai request đặt vé
     * chạy song song không thể cùng tiêu lượt cuối cùng của mã.
     *
     * @return false nếu mã đã hết lượt (hoặc không còn tồn tại) — người gọi phải hủy đơn.
     */
    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public boolean useVoucher(Long voucherId) {
        if (voucherId == null) {
            return false;
        }
        return voucherRepository.incrementUsage(voucherId) > 0;
    }

    /**
     * Hoàn lại lượt sử dụng khi booking bị hủy/hết hạn trước khi thanh toán thành công
     * (booking chưa CONFIRMED thì coi như mã chưa thực sự được dùng).
     */
    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public void refundVoucherUsage(String code) {
        if (code == null || code.isBlank()) {
            return;
        }
        voucherRepository.decrementUsageByCode(normalizeCode(code));
    }

    // ==================== ADMIN MANAGEMENT ====================

    @Transactional(readOnly = true)
    public List<Voucher> getAllVouchers() {
        return voucherRepository.findAll();
    }

    /**
     * Danh sách voucher đang hoạt động và còn hiệu lực (dùng cho giao diện chỉ xem của provider).
     */
    @Transactional(readOnly = true)
    public List<Voucher> getActiveVouchers() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        return voucherRepository.findByIsActiveTrue().stream()
                .filter(v -> v.getStartDate() == null || !now.isBefore(v.getStartDate()))
                .filter(v -> v.getExpiryDate() == null || !now.isAfter(v.getExpiryDate()))
                .filter(v -> v.getMaxUsage() == null || v.getCurrentUsage() < v.getMaxUsage())
                .toList();
    }

    // ==================== NGƯỜI DÙNG (TRANG ƯU ĐÃI) ====================

    /**
     * Danh sách voucher (đang bật) hiển thị cho người dùng ở trang ưu đãi, kèm thông tin
     * còn áp dụng được hay không. providerId/orderAmount là ngữ cảnh đơn hàng hiện tại (nếu có) —
     * để trống khi người dùng chỉ đang xem trang ưu đãi nói chung.
     */
    @Transactional(readOnly = true)
    public List<VoucherPublicDTO> getPublicVouchers(Long providerId, java.math.BigDecimal orderAmount, String email) {
        Set<String> usedCodes = getUsedCodes(email);
        return voucherRepository.findByIsActiveTrue().stream()
                .map(v -> toPublicDTO(v, providerId, orderAmount, false, usedCodes))
                .toList();
    }

    public VoucherPublicDTO toPublicDTO(Voucher v, Long providerId, java.math.BigDecimal orderAmount, boolean saved) {
        return toPublicDTO(v, providerId, orderAmount, saved, Set.of());
    }

    public VoucherPublicDTO toPublicDTO(Voucher v, Long providerId, java.math.BigDecimal orderAmount, boolean saved,
                                        Set<String> usedCodes) {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        boolean available = true;
        String reason = null;

        boolean alreadyUsed = usedCodes != null && usedCodes.contains(normalizeCode(v.getCode()));

        if (alreadyUsed) {
            available = false;
            reason = "Bạn đã dùng mã này rồi (mỗi mã chỉ dùng được 1 lần).";
        } else if (v.getExpiryDate() != null && now.isAfter(v.getExpiryDate())) {
            available = false;
            reason = "Mã đã hết hạn sử dụng.";
        } else if (v.getStartDate() != null && now.isBefore(v.getStartDate())) {
            available = false;
            reason = "Mã chưa đến ngày áp dụng.";
        } else if (v.getMaxUsage() != null && v.getCurrentUsage() != null && v.getCurrentUsage() >= v.getMaxUsage()) {
            available = false;
            reason = "Mã đã hết lượt sử dụng.";
        } else if (v.getProvider() != null && providerId != null && !v.getProvider().getId().equals(providerId)) {
            available = false;
            reason = "Chỉ áp dụng cho hãng \"" + v.getProvider().getProviderName() + "\".";
        } else if (v.getMinOrderAmount() != null && orderAmount != null
                && orderAmount.compareTo(java.math.BigDecimal.valueOf(v.getMinOrderAmount())) < 0) {
            available = false;
            reason = String.format("Đơn hàng tối thiểu %,.0f VND để áp dụng mã này.", v.getMinOrderAmount());
        }

        return VoucherPublicDTO.builder()
                .id(v.getId())
                .code(v.getCode())
                .discountPercent(v.getDiscountPercent())
                .maxDiscountAmount(v.getMaxDiscountAmount())
                .minOrderAmount(v.getMinOrderAmount())
                .startDate(v.getStartDate())
                .expiryDate(v.getExpiryDate())
                .maxUsage(v.getMaxUsage())
                .currentUsage(v.getCurrentUsage())
                .description(v.getDescription())
                .providerId(v.getProvider() != null ? v.getProvider().getId() : null)
                .providerName(v.getProvider() != null ? v.getProvider().getProviderName() : null)
                .available(available)
                .unavailableReason(reason)
                .saved(saved)
                .alreadyUsed(alreadyUsed)
                .build();
    }

    private Provider resolveProvider(Long providerId) {
        if (providerId == null) {
            return null;
        }
        return providerRepository.findById(providerId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hãng phương tiện với ID: " + providerId));
    }

    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public Voucher createVoucher(Voucher data, Long providerId) {
        if (data.getCode() == null || data.getCode().isBlank()) {
            throw new IllegalArgumentException("Mã voucher không được để trống");
        }
        String code = data.getCode().trim().toUpperCase();
        if (voucherRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new IllegalArgumentException("Mã voucher \"" + code + "\" đã tồn tại");
        }
        data.setCode(code);
        data.setId(null);
        data.setProvider(resolveProvider(providerId));
        if (data.getCurrentUsage() == null) {
            data.setCurrentUsage(0);
        }
        if (data.getIsActive() == null) {
            data.setIsActive(true);
        }
        return voucherRepository.save(data);
    }

    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public Voucher updateVoucher(Long id, Voucher data, Long providerId) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy voucher với ID: " + id));

        if (data.getCode() != null && !data.getCode().isBlank()) {
            String code = data.getCode().trim().toUpperCase();
            voucherRepository.findByCodeIgnoreCase(code).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new IllegalArgumentException("Mã voucher \"" + code + "\" đã tồn tại");
                }
            });
            voucher.setCode(code);
        }
        if (data.getDiscountPercent() != null) {
            voucher.setDiscountPercent(data.getDiscountPercent());
        }
        voucher.setMaxDiscountAmount(data.getMaxDiscountAmount());
        voucher.setMinOrderAmount(data.getMinOrderAmount());
        voucher.setStartDate(data.getStartDate());
        voucher.setExpiryDate(data.getExpiryDate());
        voucher.setMaxUsage(data.getMaxUsage());
        voucher.setDescription(data.getDescription());
        voucher.setProvider(resolveProvider(providerId));
        if (data.getIsActive() != null) {
            voucher.setIsActive(data.getIsActive());
        }
        return voucherRepository.save(voucher);
    }

    @Transactional
    @CacheEvict(value = "vouchers", allEntries = true)
    public void deleteVoucher(Long id) {
        if (!voucherRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy voucher với ID: " + id);
        }
        voucherRepository.deleteById(id);
    }
}
