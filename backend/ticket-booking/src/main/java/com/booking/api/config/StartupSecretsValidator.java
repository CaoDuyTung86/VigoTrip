package com.booking.api.config;

import com.booking.api.security.JwtSecretDecoder;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Chặn ứng dụng khởi động khi thiếu bí mật bắt buộc, hoặc khi bí mật đang dùng là một
 * giá trị đã từng bị đẩy lên Git.
 *
 * Vì sao cần: trước đây application.yml để sẵn giá trị mặc định cho JWT_SECRET,
 * VNP_HASH_SECRET, ADMIN_PASSWORD... nên quên khai báo biến môi trường thì ứng dụng vẫn
 * chạy ngon lành — chỉ là chạy bằng khoá nằm công khai trong mã nguồn. Không có gì báo
 * động cả. Bỏ giá trị mặc định là điều kiện cần; lớp này là điều kiện đủ, biến "quên
 * cấu hình" từ một lỗ hổng im lặng thành một lần deploy hỏng nhìn thấy ngay.
 *
 * Không chạy với profile "test": bộ test dùng H2 với mật khẩu rỗng và các khoá giả.
 */
@Slf4j
@Configuration
@Profile("!test")
@RequiredArgsConstructor
public class StartupSecretsValidator {

    private final Environment env;

    /** Khoá cấu hình bắt buộc -> tên biến môi trường tương ứng, để báo lỗi cho đúng chỗ. */
    private static final Map<String, String> REQUIRED = Map.of(
            "jwt.secret", "JWT_SECRET",
            "vnpay.tmn-code", "VNP_TMN_CODE",
            "vnpay.hash-secret", "VNP_HASH_SECRET",
            "spring.datasource.password", "SPRING_DATASOURCE_PASSWORD",
            "app.admin.password", "ADMIN_PASSWORD",
            "app.provider.password", "PROVIDER_PASSWORD"
    );

    /**
     * SHA-256 của những giá trị đã lộ trong lịch sử Git công khai của repo này.
     *
     * Lưu hash chứ không lưu giá trị gốc — mục đích là phát hiện việc tái sử dụng khoá
     * đã cháy, chứ không phải đăng lại chúng thêm một lần nữa.
     */
    private static final Set<String> LEAKED_SHA256 = Set.of(
            "3354cfcf65c7b2e6840ea6f880aede239750cb1d063950c4e8fd9fbf9ec73a32", // JWT secret cũ (mẫu tutorial)
            "986702648e1bc8fb589e574d22eb413d7bdfcb7bea6ea3bf854770c1979eb55e", // JWT secret cũ (base64 "a2b3c4...")
            "7a5752544bc787c0d4c1a31b5cee2a79e50f87137e8824a471b7680c268afc52", // VNPay hash-secret cũ
            "6d64f7074443fdad5c307e339c8ac8f6ea615435be6ab116e13625396eecd825", // VNPay hash-secret cũ hơn
            "fceeab17dcb3a07638e50a5c7c477246ba945a2ba6db59565ce63966955eaf2b", // Mật khẩu SQL Server local cũ
            "bdab0e5ea56c3dd122654c4eaa6898141748f0bda39a9d15669912afc9ae0e7f"  // Mật khẩu admin/provider demo cũ
    );

    /**
     * Cửa thoát hiểm CÓ CHỦ Ý cho tình huống khoá đã lộ nhưng chưa xoay kịp (nhà cung cấp
     * chưa cấp lại, hạn nộp đã tới). Bật lên thì ứng dụng vẫn khởi động, nhưng phải là một
     * quyết định có ý thức: tên biến nói đúng việc nó làm, và mỗi lần khởi động đều in một
     * khối cảnh báo không thể bỏ sót.
     *
     * CHỈ nới cho lỗi "khoá đã lộ". Lỗi "thiếu khoá" thì không bao giờ được nới: thiếu là
     * cấu hình sai, không phải một rủi ro được chấp nhận có hiểu biết.
     */
    private static final String ALLOW_LEAKED_KEY = "app.allow-known-leaked-secrets";

    @PostConstruct
    void validate() {
        List<String> missing = new ArrayList<>();
        List<String> leaked = new ArrayList<>();

        REQUIRED.forEach((key, envVar) -> {
            String value = env.getProperty(key);
            if (value == null || value.isBlank()) {
                missing.add("  - Thiếu %s (khoá cấu hình: %s)".formatted(envVar, key));
            } else if (LEAKED_SHA256.contains(sha256(value))) {
                leaked.add(envVar);
            }
        });

        boolean allowLeaked = Boolean.TRUE.equals(env.getProperty(ALLOW_LEAKED_KEY, Boolean.class, false));
        List<String> fatal = new ArrayList<>(missing);
        malformedJwtSecret(env.getProperty("jwt.secret")).ifPresent(fatal::add);

        if (!leaked.isEmpty()) {
            if (allowLeaked) {
                warnRunningOnLeakedSecrets(leaked);
            } else {
                leaked.forEach(envVar -> fatal.add(
                        "  - %s đang dùng giá trị ĐÃ BỊ LỘ trong lịch sử Git công khai. ".formatted(envVar)
                                + "Phải thay bằng giá trị mới. Nếu chưa xoay khoá kịp và chấp nhận rủi ro, "
                                + "đặt ALLOW_KNOWN_LEAKED_SECRETS=true để tạm khởi động tiếp."));
            }
        }

        if (!fatal.isEmpty()) {
            throw new IllegalStateException(
                    "Cấu hình bí mật không hợp lệ, dừng khởi động:\n"
                            + String.join("\n", fatal)
                            + "\nKhai báo các biến này ở môi trường deploy (Render/Vercel) hoặc trong file .env "
                            + "khi chạy docker compose. Xem .env.example để biết cách lấy từng giá trị.");
        }

        if (leaked.isEmpty()) {
            log.info("[StartupSecretsValidator] {} bí mật bắt buộc đã có mặt và không nằm trong danh sách đã lộ.",
                    REQUIRED.size());
        }
    }

    /**
     * Có mặt là chưa đủ với JWT_SECRET: nó còn phải giải mã được thành khoá đủ dài.
     *
     * Trước đây một chuỗi gõ tay sai định dạng chỉ lộ ra dưới dạng
     * {@code DecodingException: Illegal base64 character '-'} nằm sâu trong một stack trace
     * dài của Spring, lúc khởi tạo bean — không nhắc tới tên biến môi trường nào, cũng không
     * gợi ý phải làm gì. Còn chuỗi giải mã ra quá ngắn thì im lặng hoàn toàn cho tới khi
     * người dùng đầu tiên bấm đăng nhập. Kiểm ở đây để cả hai trường hợp thành một thông báo
     * nói rõ biến nào sai và sửa bằng lệnh gì.
     *
     * Chuỗi trống đã được nhánh "thiếu biến" lo, nên bỏ qua để không báo trùng hai lần.
     */
    private static Optional<String> malformedJwtSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            return Optional.empty();
        }
        try {
            JwtSecretDecoder.decode(secret);
            return Optional.empty();
        } catch (IllegalStateException e) {
            return Optional.of(indentBlock(e.getMessage()));
        }
    }

    /** Thụt lề khối thông báo nhiều dòng cho khớp với các dòng "  - ..." còn lại. */
    private static String indentBlock(String message) {
        List<String> lines = message.strip().lines().toList();
        StringBuilder out = new StringBuilder("  - ").append(lines.get(0));
        lines.subList(1, lines.size())
                .forEach(line -> out.append('\n').append(line.isBlank() ? "" : "    " + line));
        return out.toString();
    }

    private void warnRunningOnLeakedSecrets(List<String> leaked) {
        log.error("""

                ==========================================================================
                 ĐANG CHẠY BẰNG KHOÁ ĐÃ LỘ CÔNG KHAI: {}
                 Cho phép bởi ALLOW_KNOWN_LEAKED_SECRETS=true.

                 Nghĩa là: bất kỳ ai đọc lịch sử Git của repo này đều biết các giá trị trên.
                 Với VNP_HASH_SECRET, họ tự ký được một callback "thanh toán thành công" và
                 nhận vé mà không trả tiền. Với JWT_SECRET, họ tự ký được token đăng nhập
                 dưới danh nghĩa bất kỳ tài khoản nào, kể cả admin.

                 Lớp giảm nhẹ đang có: nếu VNP_VERIFY_CALLBACK bật, mọi callback báo thành
                 công còn bị đối chiếu lại với cổng bằng querydr, nên callback giả bị chặn
                 dù chữ ký hợp lệ. JWT KHÔNG có lớp nào tương đương — mà JWT_SECRET thì chỉ
                 là chuỗi ngẫu nhiên tự sinh, đổi được ngay, không phải chờ ai cả.

                 Đây là trạng thái TẠM. Xoay khoá xong thì bỏ biến này đi.
                ==========================================================================
                """, String.join(", ", leaked));
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JVM không có SHA-256", e);
        }
    }
}
