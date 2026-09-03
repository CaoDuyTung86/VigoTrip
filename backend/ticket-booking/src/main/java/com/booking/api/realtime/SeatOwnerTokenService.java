package com.booking.api.realtime;

import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Biến danh tính giữ ghế thành một mã ẩn danh để phát ra ngoài.
 *
 * <p>Bản cũ phát thẳng {@code userId} — tức email — trong mọi thông điệp trạng thái ghế, tới
 * MỌI client đang mở trang. Chỉ cần mở DevTools là đọc được email của tất cả những người
 * đang chọn ghế cùng chuyến. Đó là rò rỉ dữ liệu cá nhân, và với khách chưa đăng nhập thì
 * còn tệ hơn: khoá thiết bị bị lộ chính là thứ dùng để giữ ghế, ai nhặt được là cướp được
 * ghế của nhau.
 *
 * <p>Giao diện chỉ cần trả lời đúng một câu hỏi: "ghế này có phải của tôi không?". Vậy nên
 * thứ phát ra ngoài là HMAC-SHA256 của danh tính — cùng một người thì cùng một mã (so sánh
 * được), nhưng không hoàn nguyên về email được (không suy ra được là ai). Mỗi client tự hỏi
 * mã của chính mình qua {@code /app/whoami} rồi so bằng.
 *
 * <p>Dùng chung khoá với JWT: mã này chỉ cần bí mật với client, không phải một chứng chỉ
 * độc lập — client không bao giờ gửi nó ngược lên để chứng minh danh tính.
 */
@Service
public class SeatOwnerTokenService {

    /** 16 ký tự base64url ≈ 96 bit, thừa sức tránh trùng trong phạm vi một chuyến. */
    private static final int TOKEN_LENGTH = 16;
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    public SeatOwnerTokenService(@Value("${jwt.secret}") String secret) {
        this.key = new SecretKeySpec(Decoders.BASE64.decode(secret), HMAC_ALGORITHM);
    }

    /** Mã ẩn danh của một danh tính. Trả null nếu không có chủ (ghế trống). */
    public String tokenFor(String identity) {
        if (identity == null || identity.isBlank()) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(key);
            byte[] digest = mac.doFinal(identity.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, TOKEN_LENGTH);
        } catch (java.security.GeneralSecurityException e) {
            // HmacSHA256 là thuật toán bắt buộc có trong mọi JRE; tới đây được nghĩa là
            // khoá hỏng, và khi đó im lặng trả null sẽ khiến mọi ghế trông như của mình.
            throw new IllegalStateException("Không tạo được mã chủ sở hữu ghế", e);
        }
    }
}
