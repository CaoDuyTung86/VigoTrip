package com.booking.api.security;

import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.io.Decoders;

/**
 * Đọc {@code jwt.secret} từ cấu hình ra mảng byte dùng làm khoá HMAC.
 *
 * <p>Vì sao tách riêng: cùng một chuỗi bí mật được hai nơi dùng — {@link JwtService} để ký
 * token đăng nhập, và {@code SeatOwnerTokenService} để băm danh tính giữ ghế. Trước đây mỗi
 * nơi tự gọi {@code Decoders.BASE64.decode()}, nên mọi thay đổi về cách hiểu chuỗi bí mật
 * đều phải sửa hai chỗ. Hai nơi hiểu lệch nhau thì sinh ra hai khoá khác nhau từ cùng một
 * cấu hình — loại lỗi không có gì báo động cho tới lúc có người không mở được ghế của chính
 * mình.
 *
 * <p><b>Chấp nhận base64 chuẩn và base64url</b> (khác nhau ở {@code +/} với {@code -_}).
 * Cả hai đều là cách mã hoá hợp lệ của một khoá ngẫu nhiên thật, và {@code openssl rand} với
 * các bộ sinh khoá trực tuyến hay trả về dạng nào tuỳ công cụ — bắt người dùng đoán xem
 * mình đang cầm dạng nào là bắt sai chỗ.
 *
 * <p><b>KHÔNG chấp nhận chuỗi thường, và KHÔNG băm cho đủ độ dài.</b> Đây là chỗ dễ nới tay
 * nhất và cũng là chỗ nới tay nguy hiểm nhất. Nếu rơi về {@code secret.getBytes(UTF_8)} rồi
 * thấy ngắn thì đem SHA-256 cho đủ 32 byte, thì {@code JWT_SECRET=secret} sẽ thành một khoá
 * 256 bit "hợp lệ" và ứng dụng khởi động êm ru. Nhưng SHA-256 không phải KDF: không salt,
 * không làm chậm, chạy hàng tỷ lần mỗi giây. Entropy đầu ra vẫn đúng bằng entropy của chữ
 * {@code "secret"} — khoá chỉ *trông* mạnh lên. Mà đoán được khoá này là tự ký được token
 * đăng nhập dưới danh nghĩa bất kỳ ai, kể cả admin (xem khối cảnh báo trong
 * {@code StartupSecretsValidator}).
 *
 * <p>Nên khoá sai thì dừng hẳn, kèm thông báo chỉ đúng việc phải làm. Một lần deploy hỏng
 * nhìn thấy ngay tốt hơn một khoá yếu chạy im lặng nhiều tháng.
 */
public final class JwtSecretDecoder {

    /**
     * HMAC-SHA256 yêu cầu khoá tối thiểu 256 bit (RFC 7518 §3.2); {@code Keys.hmacShaKeyFor}
     * của jjwt cũng từ chối khoá ngắn hơn. Kiểm ở đây để lỗi nổ lúc khởi động thay vì lúc
     * người dùng đầu tiên bấm đăng nhập.
     */
    private static final int MIN_KEY_BYTES = 32;

    private JwtSecretDecoder() {
    }

    /**
     * @throws IllegalStateException nếu chuỗi bí mật trống, không phải base64, hoặc giải mã
     *                               ra ít hơn {@value #MIN_KEY_BYTES} byte.
     */
    public static byte[] decode(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(explain("JWT_SECRET đang trống."));
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (DecodingException standardFailed) {
            try {
                keyBytes = Decoders.BASE64URL.decode(secret);
            } catch (DecodingException urlSafeFailed) {
                // Giữ nguyên văn lỗi của bộ giải mã chuẩn: nó chỉ ra ký tự đầu tiên không
                // hợp lệ, thường là manh mối trực tiếp nhất về việc chuỗi đã bị gõ tay.
                throw new IllegalStateException(explain(
                        "JWT_SECRET không phải chuỗi base64 hợp lệ (%s)."
                                .formatted(standardFailed.getMessage())));
            }
        }

        if (keyBytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException(explain(
                    "JWT_SECRET giải mã ra %d byte, cần tối thiểu %d byte (256 bit)."
                            .formatted(keyBytes.length, MIN_KEY_BYTES)));
        }
        return keyBytes;
    }

    /** Thông báo lỗi kèm sẵn lệnh sinh khoá, để người gặp lỗi không phải đi tra thêm. */
    private static String explain(String problem) {
        return """
                %s

                Khoá ký JWT phải là chuỗi ngẫu nhiên mã hoá base64, giải mã ra ít nhất %d byte.
                Sinh khoá mới rồi đặt vào JWT_SECRET trong file .env:

                  Git Bash (đi kèm Git for Windows), macOS, Linux:
                    openssl rand -base64 48

                  PowerShell:
                    $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)

                Đừng tự gõ tay một chuỗi bất kỳ, và đừng dùng Get-Random để sinh khoá: nó
                dựa trên System.Random, không phải nguồn ngẫu nhiên an toàn — khoá sinh ra
                có thể dò ngược lại từ thời điểm sinh.
                """.formatted(problem, MIN_KEY_BYTES);
    }
}
