package com.booking.api.config;

import com.booking.api.entity.Provider;
import com.booking.api.entity.User;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class AdminSeeder {

    private final UserRepository userRepository;
    private final ProviderRepository providerRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Value("${app.provider.email}")
    private String providerEmail;

    @Value("${app.provider.password}")
    private String providerPassword;

    @Value("${app.provider.owned-providers:}")
    private String ownedProviders;

    @Bean
    @Order(2)
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

            assignProviderOwnership();
        };
    }

    /**
     * Gán các thương hiệu trong app.provider.owned-providers cho tài khoản đối tác demo.
     *
     * Không có bước này thì ROLE_PROVIDER không sở hữu gì cả và màn hình BI của họ trống
     * trơn — nhưng quan trọng hơn, đây là thứ biến "đối tác" từ một admin thứ hai thành
     * một vai thật: AnalyticsService thu hẹp mọi truy vấn về đúng nha_cung_cap.owner_user_id.
     *
     * Chỉ gán khi ô chủ sở hữu còn trống, để admin đổi tay trong CSDL rồi thì lần khởi động
     * sau không ghi đè lại.
     */
    private void assignProviderOwnership() {
        if (ownedProviders == null || ownedProviders.isBlank()) {
            return;
        }
        List<String> names = Arrays.stream(ownedProviders.split(","))
                .map(String::trim)
                .filter(n -> !n.isEmpty())
                .toList();
        if (names.isEmpty()) {
            return;
        }

        userRepository.findByEmail(providerEmail).ifPresent(owner -> {
            List<Provider> targets = providerRepository.findByProviderNameIn(names);
            List<Provider> changed = targets.stream()
                    .filter(p -> p.getOwnerUser() == null)
                    .peek(p -> p.setOwnerUser(owner))
                    .toList();
            if (!changed.isEmpty()) {
                providerRepository.saveAll(changed);
                log.info("[AdminSeeder] Đã gán {} thương hiệu cho tài khoản đối tác {}: {}",
                        changed.size(), providerEmail,
                        changed.stream().map(Provider::getProviderName).toList());
            }
            if (targets.size() < names.size()) {
                log.warn("[AdminSeeder] app.provider.owned-providers có tên không khớp nha_cung_cap. "
                        + "Yêu cầu {}, tìm thấy {}.", names, targets.stream().map(Provider::getProviderName).toList());
            }
        });
    }
}
