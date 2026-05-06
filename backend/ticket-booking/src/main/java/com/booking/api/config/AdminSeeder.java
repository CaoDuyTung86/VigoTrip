package com.booking.api.config;

import com.booking.api.entity.User;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class AdminSeeder {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner seedAdminAccount() {
        return args -> {
            userRepository.findByEmail("admin@gmail.com").ifPresentOrElse(
                admin -> {
                    boolean changed = false;

                    if (!Boolean.TRUE.equals(admin.getEnabled())) {
                        admin.setEnabled(true);
                        changed = true;
                        log.info("[AdminSeeder] Đã kích hoạt tài khoản admin@gmail.com (enabled = true)");
                    }

                    if (!"ROLE_ADMIN".equals(admin.getRole())) {
                        admin.setRole("ROLE_ADMIN");
                        changed = true;
                        log.info("[AdminSeeder] Đã set role ROLE_ADMIN cho admin@gmail.com");
                    }

                    if (changed) {
                        userRepository.save(admin);
                    } else {
                        log.info("[AdminSeeder] Tài khoản admin@gmail.com đã hợp lệ, bỏ qua.");
                    }
                },
                () -> {
                    User admin = new User();
                    admin.setFullName("Administrator");
                    admin.setEmail("admin@gmail.com");
                    admin.setPassword(passwordEncoder.encode("Abc123456!"));
                    admin.setRole("ROLE_ADMIN");
                    admin.setEnabled(true);
                    userRepository.save(admin);
                    log.info("[AdminSeeder] Đã tạo mới tài khoản admin@gmail.com");
                }
            );

            userRepository.findByEmail("provider@gmail.com").ifPresentOrElse(
                provider -> {
                    boolean changed = false;
                    if (!Boolean.TRUE.equals(provider.getEnabled())) {
                        provider.setEnabled(true);
                        changed = true;
                    }
                    if (!"ROLE_PROVIDER".equals(provider.getRole())) {
                        provider.setRole("ROLE_PROVIDER");
                        changed = true;
                    }
                    if (changed) {
                        userRepository.save(provider);
                    }
                },
                () -> {
                    User provider = new User();
                    provider.setFullName("Provider Account");
                    provider.setEmail("provider@gmail.com");
                    provider.setPassword(passwordEncoder.encode("Abc123456!"));
                    provider.setRole("ROLE_PROVIDER");
                    provider.setEnabled(true);
                    userRepository.save(provider);
                    log.info("[AdminSeeder] Đã tạo mới tài khoản provider@gmail.com");
                }
            );
        };
    }
}
