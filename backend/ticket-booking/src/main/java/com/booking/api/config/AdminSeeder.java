package com.booking.api.config;

import com.booking.api.entity.User;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Value("${app.provider.email}")
    private String providerEmail;

    @Value("${app.provider.password}")
    private String providerPassword;

    @Bean
    CommandLineRunner seedAdminAccount() {
        return args -> {
            userRepository.findByEmail(adminEmail).ifPresentOrElse(
                admin -> {
                    boolean changed = false;

                    if (!Boolean.TRUE.equals(admin.getEnabled())) {
                        admin.setEnabled(true);
                        changed = true;
                        log.info("[AdminSeeder] Đã kích hoạt tài khoản {} (enabled = true)", adminEmail);
                    }

                    if (!"ROLE_ADMIN".equals(admin.getRole())) {
                        admin.setRole("ROLE_ADMIN");
                        changed = true;
                        log.info("[AdminSeeder] Đã set role ROLE_ADMIN cho {}", adminEmail);
                    }

                    if (!passwordEncoder.matches(adminPassword, admin.getPassword())) {
                        admin.setPassword(passwordEncoder.encode(adminPassword));
                        changed = true;
                        log.info("[AdminSeeder] Đã cập nhật mật khẩu mới cho {}", adminEmail);
                    }

                    if (changed) {
                        userRepository.save(admin);
                    } else {
                        log.info("[AdminSeeder] Tài khoản {} đã hợp lệ, bỏ qua.", adminEmail);
                    }
                },
                () -> {
                    User admin = new User();
                    admin.setFullName("Administrator");
                    admin.setEmail(adminEmail);
                    admin.setPassword(passwordEncoder.encode(adminPassword));
                    admin.setRole("ROLE_ADMIN");
                    admin.setEnabled(true);
                    userRepository.save(admin);
                    log.info("[AdminSeeder] Đã tạo mới tài khoản {}", adminEmail);
                }
            );

            userRepository.findByEmail(providerEmail).ifPresentOrElse(
                provider -> {
                    boolean changed = false;
                    if (!Boolean.TRUE.equals(provider.getEnabled())) {
                        provider.setEnabled(true);
                        changed = true;
                        log.info("[AdminSeeder] Đã kích hoạt tài khoản {} (enabled = true)", providerEmail);
                    }
                    if (!"ROLE_PROVIDER".equals(provider.getRole())) {
                        provider.setRole("ROLE_PROVIDER");
                        changed = true;
                        log.info("[AdminSeeder] Đã set role ROLE_PROVIDER cho {}", providerEmail);
                    }
                    if (!passwordEncoder.matches(providerPassword, provider.getPassword())) {
                        provider.setPassword(passwordEncoder.encode(providerPassword));
                        changed = true;
                        log.info("[AdminSeeder] Đã cập nhật mật khẩu mới cho {}", providerEmail);
                    }
                    if (changed) {
                        userRepository.save(provider);
                    } else {
                        log.info("[AdminSeeder] Tài khoản {} đã hợp lệ, bỏ qua.", providerEmail);
                    }
                },
                () -> {
                    User provider = new User();
                    provider.setFullName("Provider Account");
                    provider.setEmail(providerEmail);
                    provider.setPassword(passwordEncoder.encode(providerPassword));
                    provider.setRole("ROLE_PROVIDER");
                    provider.setEnabled(true);
                    userRepository.save(provider);
                    log.info("[AdminSeeder] Đã tạo mới tài khoản {}", providerEmail);
                }
            );
        };
    }
}
