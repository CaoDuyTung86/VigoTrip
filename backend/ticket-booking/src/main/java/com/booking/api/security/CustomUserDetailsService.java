package com.booking.api.security;

import com.booking.api.entity.User;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy user với email: " + email));

        // Tài khoản tạo qua Google Login không có mật khẩu (password = null).
        // Constructor của Spring Security User NÉM IllegalArgumentException nếu password null,
        // khiến JwtAuthFilter nuốt lỗi → request không được xác thực → 403 → frontend tưởng
        // "tài khoản bị khóa / phiên hết hạn". Dùng chuỗi rỗng: BCrypt không bao giờ khớp nên
        // vẫn không thể đăng nhập bằng mật khẩu, mà JWT thì vẫn xác thực bình thường.
        String password = user.getPassword() != null ? user.getPassword() : "";
        String role = user.getRole() != null ? user.getRole() : "ROLE_USER";

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                password,
                Boolean.TRUE.equals(user.getEnabled()),  // enabled – false → bị khóa → token vô hiệu
                true,               // accountNonExpired
                true,               // credentialsNonExpired
                true,               // accountNonLocked
                Collections.singletonList(new SimpleGrantedAuthority(role)));
    }
}
