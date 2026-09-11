package com.booking.api.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lớp được kiểm ở đây mang @Profile("!test") nên KHÔNG bao giờ chạy trong bộ test tích
 * hợp — nếu không có test đơn vị này thì nó là mã không ai kiểm chứng, và một lỗi trong
 * nó chỉ lộ ra lúc deploy production hỏng.
 */
class StartupSecretsValidatorTest {

    /**
     * Một giá trị đã lộ, dùng để dựng kịch bản "khoá cháy".
     *
     * CỐ Ý lấy lại đúng chuỗi vốn đã nằm sẵn trong repo công khai này (JWT secret cũ trong
     * application.yml) thay vì dán thêm một bí mật khác vào mã nguồn. LEAKED_SHA256 của
     * validator chỉ lưu hash chính vì lý do đó — mục tiêu là phát hiện việc tái dùng khoá
     * cháy, không phải đăng lại chúng thêm một lần nữa.
     */
    private static final String A_LEAKED_SECRET =
            "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    /** Bộ giá trị hợp lệ tối thiểu để khởi động trót lọt. */
    private static MockEnvironment validEnv() {
        return new MockEnvironment()
                .withProperty("jwt.secret", "Zm9vYmFyLXNlY3JldC1raGFjLWhvYW4tdG9hbi1tb2ktMTIzNDU2")
                .withProperty("vnpay.tmn-code", "ABCD1234")
                .withProperty("vnpay.hash-secret", "HASHSECRETMOIHOANTOANKHACCUOI123")
                .withProperty("spring.datasource.password", "mat-khau-db-moi")
                .withProperty("app.admin.password", "MatKhauAdminMoi#2026")
                .withProperty("app.provider.password", "MatKhauProviderMoi#2026");
    }

    @Test
    @DisplayName("Đủ bí mật hợp lệ thì khởi động bình thường")
    void passesWhenAllSecretsPresent() {
        assertThatCode(() -> new StartupSecretsValidator(validEnv()).validate())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Thiếu biến bắt buộc thì chặn khởi động và nêu đúng tên biến môi trường")
    void failsWhenSecretMissing() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", "");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    /**
     * Ca của người mới: sao chép nguyên `.env.example` rồi chạy luôn. Trước đây bộ này đi
     * lọt vì giá trị mẫu không rỗng, và sai sót chỉ lộ ra ở lần bấm thanh toán đầu tiên.
     */
    @Test
    @DisplayName("Giá trị mẫu của .env.example bị coi như thiếu, không cho khởi động")
    void failsWhenSecretIsStillThePlaceholder() {
        MockEnvironment env = validEnv();
        env.setProperty("vnpay.tmn-code", "your_vnpay_tmn_code_here");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> assertThat(e.getMessage())
                        .contains("VNP_TMN_CODE")
                        .contains("giá trị mẫu"));
    }

    @Test
    @DisplayName("Báo một lần tất cả biến còn thiếu, không bắt sửa từng cái một")
    void reportsEveryMissingSecretAtOnce() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", "");
        env.setProperty("vnpay.hash-secret", "");
        env.setProperty("app.admin.password", "");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> assertThat(e.getMessage())
                        .contains("JWT_SECRET")
                        .contains("VNP_HASH_SECRET")
                        .contains("ADMIN_PASSWORD"));
    }

    @Test
    @DisplayName("Bí mật đã lộ trong lịch sử Git bị từ chối dù có giá trị")
    void rejectsSecretLeakedInGitHistory() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", A_LEAKED_SECRET);

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ĐÃ BỊ LỘ");
    }

    @Test
    @DisplayName("Cửa thoát hiểm cho phép khởi động dù khoá đã lộ")
    void allowsLeakedSecretWhenExplicitlyOptedIn() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", A_LEAKED_SECRET);
        env.setProperty("app.allow-known-leaked-secrets", "true");

        assertThatCode(() -> new StartupSecretsValidator(env).validate())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Cửa thoát hiểm KHÔNG che được lỗi thiếu khoá")
    void escapeHatchDoesNotCoverMissingSecrets() {
        // Thiếu khoá là cấu hình sai, không phải rủi ro được chấp nhận có hiểu biết. Nếu
        // nới cả trường hợp này thì một biến quên khai báo sẽ trôi thẳng ra production.
        MockEnvironment env = validEnv();
        env.setProperty("app.allow-known-leaked-secrets", "true");
        env.setProperty("app.admin.password", "");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_PASSWORD");
    }

    @Test
    @DisplayName("Không bật cửa thoát hiểm thì thông báo lỗi chỉ ra cách tạm gỡ")
    void errorMessagePointsAtTheEscapeHatch() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", A_LEAKED_SECRET);

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ALLOW_KNOWN_LEAKED_SECRETS");
    }

    @Test
    @DisplayName("JWT_SECRET gõ tay sai định dạng bị chặn ngay lúc khởi động")
    void rejectsJwtSecretThatIsNotBase64() {
        // Ca có thật: một thành viên tự gõ chuỗi ngẫu nhiên có dấu '-' vào .env. Trước đây
        // lỗi chỉ lộ ra dưới dạng DecodingException nằm giữa một stack trace dài của Spring,
        // không nhắc tên biến nào. Giờ phải nói thẳng là JWT_SECRET và sửa bằng lệnh gì.
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", "khoa-ngau-nhien-tu-go#2026");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> assertThat(e.getMessage())
                        .contains("JWT_SECRET")
                        .contains("openssl rand -base64 48"));
    }

    @Test
    @DisplayName("JWT_SECRET quá ngắn bị chặn, không đợi tới lần đăng nhập đầu tiên")
    void rejectsJwtSecretShorterThanTheHmacMinimum() {
        MockEnvironment env = validEnv();
        env.setProperty("jwt.secret", "cXVhLW5nYW4=");  // "qua-ngan", 8 byte

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cần tối thiểu 32 byte");
    }

    @Test
    @DisplayName("Mật khẩu admin demo cũ cũng nằm trong danh sách đã lộ")
    void rejectsLeakedAdminPassword() {
        MockEnvironment env = validEnv();
        env.setProperty("app.admin.password", "Abc123456!");

        assertThatThrownBy(() -> new StartupSecretsValidator(env).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_PASSWORD");
    }
}
