package com.booking.api.security;

import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lớp này quyết định khoá ký JWT của cả hệ thống được sinh ra từ chuỗi cấu hình như thế nào,
 * nên mỗi hành vi ở đây là một quyết định bảo mật chứ không phải chi tiết cài đặt. Đặc biệt
 * là các trường hợp bị TỪ CHỐI: chúng tồn tại để chặn việc "sửa cho chạy được" sau này —
 * nới tay ở đây thì khoá yếu sẽ đi thẳng ra production mà không có gì báo động.
 */
class JwtSecretDecoderTest {

    /**
     * 48 byte "khoá" dựng bằng công thức thay vì dán một chuỗi ngẫu nhiên thật vào mã nguồn.
     * Repo này đã có sáu khoá nằm trong danh sách đã lộ vì từng được commit; một chuỗi
     * base64 trông y như khoá thật nằm trong test là đúng thứ khiến lần sau khó phân biệt.
     */
    private static byte[] fixtureKey() {
        byte[] raw = new byte[48];
        for (int i = 0; i < raw.length; i++) {
            raw[i] = (byte) (i * 7 + 3);
        }
        return raw;
    }

    @Test
    @DisplayName("Base64 chuẩn (có +/) giải mã ra đúng số byte gốc")
    void decodesStandardBase64() {
        byte[] raw = fixtureKey();
        // 6 bit đầu của 0xFB là 111110 = 62, chỉ số mà base64 chuẩn đọc thành '+'.
        raw[0] = (byte) 0xFB;
        String standard = Base64.getEncoder().encodeToString(raw);
        assertThat(standard).startsWith("+");

        assertThat(JwtSecretDecoder.decode(standard)).isEqualTo(raw);
    }

    @Test
    @DisplayName("Base64url (-_ thay cho +/) cũng được chấp nhận")
    void decodesUrlSafeBase64() {
        byte[] raw = fixtureKey();
        // Cùng chỉ số 62 đó, base64url đọc thành '-' — ký tự đã làm backend không khởi động
        // được. Ép sẵn để chuỗi chắc chắn rơi vào nhánh base64url; nếu thả cho ngẫu nhiên
        // thì có lần test không kiểm được gì mà vẫn xanh.
        raw[0] = (byte) 0xFB;
        String urlSafe = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        assertThat(urlSafe).startsWith("-");

        assertThat(JwtSecretDecoder.decode(urlSafe)).isEqualTo(raw);
    }

    @Test
    @DisplayName("Khoá base64url dùng được thật để ký: đây là ca gãy khiến backend không khởi động")
    void urlSafeKeyIsUsableForHmac() {
        String urlSafe = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("khoa-du-dai-de-ky-hmac-sha256-nhe-1234".getBytes(StandardCharsets.UTF_8));

        assertThatCode(() -> Keys.hmacShaKeyFor(JwtSecretDecoder.decode(urlSafe)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Chuỗi gõ tay không phải base64 thì bị từ chối, không âm thầm lấy bytes UTF-8")
    void rejectsPlainTextSecret() {
        // Dấu '#' không nằm trong bảng chữ cái của cả base64 chuẩn lẫn base64url.
        assertThatThrownBy(() -> JwtSecretDecoder.decode("khoa-bi-mat-cua-toi#2026-dai-ngoang-that-day"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("không phải chuỗi base64 hợp lệ");
    }

    @Test
    @DisplayName("Khoá ngắn bị từ chối chứ KHÔNG băm SHA-256 cho đủ 32 byte")
    void rejectsShortSecretInsteadOfStretchingIt() {
        String shortSecret = Base64.getEncoder().encodeToString("qua-ngan".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> JwtSecretDecoder.decode(shortSecret))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cần tối thiểu 32 byte");
    }

    @Test
    @DisplayName("Khoá yếu KHÔNG được băm cho dài ra: SHA-256 không thêm entropy, chỉ giấu đi")
    void doesNotDeriveKeyByHashing() throws Exception {
        // Nếu ai đó cài lại nhánh "ngắn thì SHA-256 cho đủ", khoá sinh ra sẽ đúng bằng
        // digest dưới đây. Test này khoá chặt điều đó lại: JWT_SECRET=secret phải là lỗi
        // cấu hình, không phải một khoá 256 bit trông có vẻ hợp lệ.
        byte[] wouldBeKey = MessageDigest.getInstance("SHA-256")
                .digest("secret".getBytes(StandardCharsets.UTF_8));
        assertThat(wouldBeKey).hasSize(32);

        assertThatThrownBy(() -> JwtSecretDecoder.decode("secret"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("Chuỗi trống hoặc null bị từ chối")
    void rejectsBlankSecret() {
        assertThatThrownBy(() -> JwtSecretDecoder.decode(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("đang trống");
        assertThatThrownBy(() -> JwtSecretDecoder.decode("   "))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("đang trống");
    }

    @Test
    @DisplayName("Thông báo lỗi kèm sẵn lệnh sinh khoá cho cả Git Bash lẫn PowerShell")
    void errorMessageCarriesTheFix() {
        // Người gặp lỗi này thường là thành viên mới dựng máy lần đầu. Bắt họ đi tra thêm
        // tài liệu là chỗ dễ bỏ cuộc và tự gõ đại một chuỗi cho xong — đúng cái ta đang chặn.
        assertThatThrownBy(() -> JwtSecretDecoder.decode("khoa-sai#roi"))
                .hasMessageContaining("openssl rand -base64 48")
                .hasMessageContaining("RandomNumberGenerator")
                .hasMessageContaining("Get-Random");
    }
}
