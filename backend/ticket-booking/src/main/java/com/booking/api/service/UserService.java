package com.booking.api.service;

import com.booking.api.dto.UserResponse;
import com.booking.api.dto.UserUpdateRequest;
import com.booking.api.entity.User;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.i18n.SupportedLocales;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ChatHistoryService chatHistoryService;
    private final ChatFeedbackService chatFeedbackService;

    @Transactional(readOnly = true)
    public UserResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với email: " + email));
        return toResponse(user);
    }


    @Transactional
    public UserResponse updateProfile(String email, UserUpdateRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với email: " + email));

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhone() != null) user.setPhone(request.getPhone());

        userRepository.save(user);
        return toResponse(user);
    }

    /**
     * Bật/tắt việc lưu hội thoại với trợ lý AI.
     *
     * Tắt là XÓA luôn phần đã lưu, không chỉ ngừng ghi tiếp: một công tắc quyền riêng tư
     * mà để lại nguyên đống dữ liệu cũ trong DB thì chẳng khác gì không có.
     */
    @Transactional
    public UserResponse setChatHistoryOptIn(String email, boolean optIn) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với email: " + email));

        user.setChatHistoryOptIn(optIn);
        userRepository.save(user);

        if (!optIn) {
            chatHistoryService.clearHistory(user.getEmail());
            chatFeedbackService.clearForUser(user.getEmail());
        }
        return toResponse(user);
    }

    /**
     * Đổi ngôn ngữ của tài khoản.
     *
     * <p>Đây là nơi lựa chọn ngôn ngữ thoát ra khỏi trình duyệt. Nút đổi ngôn ngữ trên
     * header vẫn đổi giao diện ngay lập tức bằng localStorage như trước; hàm này ghi thêm
     * lựa chọn đó xuống DB để những thứ chạy KHÔNG có trình duyệt nào mở vẫn biết dùng
     * tiếng gì — mail nhắc khởi hành lúc nửa đêm, mail báo hoãn chuyến do quản trị viên
     * bấm từ máy khác.
     *
     * <p>Ném IllegalArgumentException với mã lạ thay vì lặng lẽ quy về tiếng Việt: lặng lẽ
     * thì lỗi chính tả phía client biến thành "bấm đổi sang tiếng Nhật mà mail vẫn về tiếng
     * Việt", không có dấu vết nào để lần.
     */
    @Transactional
    public UserResponse setLanguage(String email, String language) {
        if (!SupportedLocales.isSupported(language)) {
            throw new IllegalArgumentException("Ngôn ngữ không được hỗ trợ: " + language);
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với email: " + email));

        user.setLanguage(SupportedLocales.normalize(language));
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public void changePassword(String email, String oldPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            if (oldPassword == null || oldPassword.isEmpty()) {
                throw new IllegalArgumentException("Vui lòng nhập mật khẩu cũ.");
            }
            if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
                throw new IllegalArgumentException("Mật khẩu cũ không chính xác.");
            }
            if (passwordEncoder.matches(newPassword, user.getPassword())) {
                throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");
            }
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ==================== Helpers ====================

    public UserResponse toResponse(User user) {
        int points = user.getPoints() != null ? user.getPoints() : 0;
        String level = getMembershipLevel(points);
        Double discount = getDiscount(points);

        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .points(points)
                .membershipLevel(level)
                .discountPercent(discount)
                .hasPassword(user.getPassword() != null && !user.getPassword().isEmpty())
                .enabled(user.getEnabled())
                .awaitingEmailVerification(
                        !Boolean.TRUE.equals(user.getEnabled()) && user.getVerificationCode() != null)
                // null = chưa từng chọn = đồng ý; quy về giá trị rõ ràng ngay tại biên,
                // để phía client không phải đoán ý nghĩa của null.
                .chatHistoryOptIn(user.getChatHistoryOptIn() == null || user.getChatHistoryOptIn())
                .language(user.resolveLocale().getLanguage())
                .build();
    }

    public static String getMembershipLevel(int points) {
        if (points >= 2000) return "Kim Cương";
        if (points >= 500) return "Vàng";
        if (points >= 100) return "Bạc";
        return "Đồng";
    }

    public static Double getDiscount(int points) {
        if (points >= 2000) return 15.0;
        if (points >= 500) return 10.0;
        if (points >= 100) return 5.0;
        return 0.0;
    }
}
