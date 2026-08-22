package com.booking.api.integration;

import com.booking.api.entity.User;
import com.booking.api.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Bảo vệ luồng đăng nhập Google khỏi ba lỗi từng gây ra hiện tượng
 * "thỉnh thoảng đăng nhập báo lỗi backend / tài khoản đã bị khóa" trên bản deploy.
 */
@SpringBootTest
@ActiveProfiles("test")
class GoogleAccountAuthIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserDetailsService userDetailsService;

    private User newGoogleUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setFullName("Người dùng Google");
        user.setRole("ROLE_USER");
        user.setEnabled(true);
        user.setPassword(null); // đăng nhập Google không đặt mật khẩu
        return user;
    }

    @Test
    @Transactional
    @DisplayName("Tài khoản Google không có mật khẩu vẫn xác thực được bằng JWT")
    void googleUserWithoutPasswordCanBeLoaded() {
        // Trước đây constructor của Spring Security User ném IllegalArgumentException khi
        // password = null. JwtAuthFilter nuốt lỗi → request không được xác thực → 403 →
        // frontend hiểu nhầm thành "tài khoản bị khóa / phiên hết hạn".
        userRepository.saveAndFlush(newGoogleUser("google.nopassword@example.com"));

        UserDetails details = assertDoesNotThrow(
                () -> userDetailsService.loadUserByUsername("google.nopassword@example.com"));

        assertNotNull(details.getPassword());
        assertTrue(details.isEnabled());
        assertTrue(details.getAuthorities().stream()
                .anyMatch(a -> "ROLE_USER".equals(a.getAuthority())));
    }

    @Test
    @Transactional
    @DisplayName("Tra cứu email không phân biệt hoa/thường")
    void findByEmailIsCaseInsensitive() {
        // Người dùng tự đăng ký bằng "Hoa.Thuong@Example.com", Google luôn trả về chữ thường.
        // Nếu so sánh phân biệt hoa/thường thì hệ thống sẽ tạo tài khoản thứ hai cho cùng một người.
        userRepository.saveAndFlush(newGoogleUser("Hoa.Thuong@Example.com"));

        assertTrue(userRepository.findByEmail("hoa.thuong@example.com").isPresent());
        assertTrue(userRepository.existsByEmail("HOA.THUONG@EXAMPLE.COM"));
    }

    @Test
    @DisplayName("Ràng buộc UNIQUE chặn tài khoản trùng email")
    void duplicateEmailIsRejectedByDatabase() {
        // Chốt chặn cho ca hai request google-login chạy song song cùng insert.
        // Không có ràng buộc này, findByEmail trả về nhiều bản ghi → login 500 và
        // mọi request kèm JWT đều bị từ chối.
        userRepository.saveAndFlush(newGoogleUser("trung.lap@example.com"));

        assertThrows(DataIntegrityViolationException.class,
                () -> userRepository.saveAndFlush(newGoogleUser("trung.lap@example.com")));

        userRepository.findByEmail("trung.lap@example.com").ifPresent(userRepository::delete);
    }
}
