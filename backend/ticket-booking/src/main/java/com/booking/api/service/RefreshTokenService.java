package com.booking.api.service;

import com.booking.api.entity.RefreshToken;
import com.booking.api.entity.User;
import com.booking.api.exception.InvalidRefreshTokenException;
import com.booking.api.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Cấp, xoay vòng và thu hồi refresh token.
 *
 * Đọc phần đầu của {@link RefreshToken} trước khi sửa file này — ba bất biến ở đó là lý do
 * tồn tại của từng nhánh bên dưới.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    /** Lý do thu hồi, ghi xuống cột revoked_reason. Chỉ phục vụ điều tra sự cố. */
    public static final String REASON_ROTATED = "ROTATED";
    public static final String REASON_LOGOUT = "LOGOUT";
    public static final String REASON_REUSE_DETECTED = "REUSE_DETECTED";
    public static final String REASON_PASSWORD_CHANGED = "PASSWORD_CHANGED";

    /**
     * 32 byte = 256 bit entropy. Đây là chìa khoá duy nhất bảo vệ một phiên kéo dài hàng
     * tuần, nên không có chỗ cho "đủ dùng": kích thước này khiến việc dò tìm là bất khả thi
     * bất kể kẻ tấn công có bao nhiêu máy.
     */
    private static final int TOKEN_BYTES = 32;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final RefreshTokenRepository refreshTokenRepository;
    private final RefreshTokenRevoker refreshTokenRevoker;

    /** Hạn của một token đơn lẻ, tính lại sau mỗi lần xoay (idle timeout). */
    @Value("${jwt.refresh.idle-days:14}")
    private long idleDays;

    /** Trần cứng của cả họ tính từ lúc đăng nhập, bất kể hoạt động nhiều hay ít. */
    @Value("${jwt.refresh.absolute-days:60}")
    private long absoluteDays;

    /**
     * Cửa sổ tha thứ cho việc dùng lại một token VỪA bị xoay. Xem giải thích trong
     * {@link #handleAlreadyRevoked}. Đặt 0 để tắt hẳn (nghiêm ngặt tuyệt đối, đổi lại
     * người dùng mở nhiều tab có thể bị đăng xuất oan).
     */
    @Value("${jwt.refresh.reuse-grace-seconds:10}")
    private long reuseGraceSeconds;

    /** Kết quả của một lần cấp token: chuỗi thô chỉ tồn tại ở đây và trong cookie. */
    public record IssuedToken(String rawToken, LocalDateTime expiresAt) {
        public Duration ttl() {
            return Duration.between(LocalDateTime.now(), expiresAt);
        }
    }

    public record RotationResult(User user, IssuedToken token) {
    }

    /** Mở một phiên mới (đăng nhập / xác thực email / đăng nhập Google). */
    @Transactional
    public IssuedToken issue(User user, String userAgent) {
        LocalDateTime now = LocalDateTime.now();
        return persist(user, UUID.randomUUID().toString(), now.plusDays(absoluteDays), userAgent, now);
    }

    /**
     * Đổi một refresh token lấy token kế tiếp trong cùng họ.
     *
     * @throws InvalidRefreshTokenException khi token không tồn tại, đã hết hạn, hoặc vừa
     *         kích hoạt cơ chế phát hiện dùng lại (lúc đó cả họ đã bị thu hồi).
     */
    @Transactional
    public RotationResult rotate(String rawToken, String userAgent) {
        LocalDateTime now = LocalDateTime.now();
        RefreshToken current = refreshTokenRepository.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> new InvalidRefreshTokenException("Phiên đăng nhập không hợp lệ."));

        if (current.getRevokedAt() != null) {
            return handleAlreadyRevoked(current, userAgent, now);
        }

        if (!current.isActive(now)) {
            throw new InvalidRefreshTokenException("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        current.setRevokedAt(now);
        current.setRevokedReason(REASON_ROTATED);
        current.setLastUsedAt(now);
        refreshTokenRepository.save(current);

        IssuedToken next = persist(current.getUser(), current.getFamilyId(),
                current.getFamilyExpiresAt(), userAgent, now);
        return new RotationResult(current.getUser(), next);
    }

    /**
     * Token này đã bị xoay (hoặc đã bị thu hồi) từ trước. Có đúng hai khả năng, và từ phía
     * máy chủ chúng trông giống hệt nhau:
     *
     *   a) Kẻ tấn công đang phát lại một token cũ lấy được ở đâu đó.
     *   b) Chính chủ, nhưng hai tab mở song song cùng gọi /refresh, hoặc một lần gọi bị
     *      mất phản hồi giữa đường và client thử lại với token cũ.
     *
     * Coi tất cả là (a) thì an toàn tuyệt đối nhưng sẽ đá người dùng thật ra ngoài mỗi lần
     * mạng chập chờn. Coi tất cả là (b) thì vứt bỏ luôn khả năng phát hiện trộm.
     *
     * Đường giữa: trong vài giây đầu ngay sau khi xoay, coi là (b) và cấp tiếp một token
     * mới trong CÙNG họ — vì một lần xoay hợp lệ vừa xảy ra xong, chính chủ chắc chắn đang
     * ở đây. Quá cửa sổ đó thì coi là (a) và thu hồi cả họ.
     *
     * Đánh đổi phải nói rõ: kẻ trộm phát lại token TRÚNG vào cửa sổ vài giây này sẽ không
     * bị phát hiện. Nhưng muốn trúng thì nó phải cướp được token và dùng đúng lúc nạn nhân
     * vừa xoay xong; kịch bản thường gặp (cướp rồi dùng vào bất cứ lúc nào khác) vẫn bị bắt,
     * vì lần xoay kế tiếp của một trong hai bên sẽ chạm vào bản đã thu hồi.
     * Đặt jwt.refresh.reuse-grace-seconds = 0 để bỏ hẳn đường giữa này.
     */
    private RotationResult handleAlreadyRevoked(RefreshToken current, String userAgent, LocalDateTime now) {
        boolean withinGrace = reuseGraceSeconds > 0
                && REASON_ROTATED.equals(current.getRevokedReason())
                && current.getRevokedAt() != null
                && current.getRevokedAt().plusSeconds(reuseGraceSeconds).isAfter(now)
                && current.getFamilyExpiresAt().isAfter(now);

        if (withinGrace) {
            log.debug("[RefreshToken] Dung lai token vua xoay trong cua so {}s - coi la thu lai hop le.",
                    reuseGraceSeconds);
            IssuedToken next = persist(current.getUser(), current.getFamilyId(),
                    current.getFamilyExpiresAt(), userAgent, now);
            return new RotationResult(current.getUser(), next);
        }

        // Giao dịch RIÊNG — bắt buộc. Ngoại lệ ném ở dòng dưới sẽ cuộn ngược giao dịch hiện
        // tại, và nếu lệnh thu hồi nằm chung thì nó bị xoá sạch ngay sau khi chạy. Xem
        // RefreshTokenRevoker để hiểu vì sao đây là một lỗi vô hình.
        int revoked = refreshTokenRevoker.revokeFamilyInNewTransaction(current.getFamilyId(), REASON_REUSE_DETECTED);
        log.warn("[RefreshToken] PHAT HIEN DUNG LAI token da thu hoi (ly do cu: {}). "
                        + "Da thu hoi {} phien con song trong ho {} cua user id {}. "
                        + "Ca chinh chu lan ben kia deu phai dang nhap lai.",
                current.getRevokedReason(), revoked, current.getFamilyId(), current.getUser().getId());
        throw new InvalidRefreshTokenException("Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");
    }

    /** Đăng xuất: thu hồi đúng họ của token đang cầm, các thiết bị khác giữ nguyên. */
    @Transactional
    public void revokeByRawToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        Optional<RefreshToken> found = refreshTokenRepository.findByTokenHash(sha256(rawToken));
        found.ifPresent(token -> refreshTokenRepository.revokeFamily(
                token.getFamilyId(), LocalDateTime.now(), REASON_LOGOUT));
    }

    /**
     * Thu hồi MỌI phiên của một tài khoản. Gọi khi mật khẩu vừa đổi: người đổi mật khẩu gần
     * như luôn làm vậy vì nghi tài khoản bị xâm nhập, mà bản thân việc đổi mật khẩu không
     * đuổi được kẻ đang cầm phiên cũ ra ngoài.
     */
    @Transactional
    public int revokeAllSessions(User user, String reason) {
        return refreshTokenRepository.revokeAllForUser(user, LocalDateTime.now(), reason);
    }

    /**
     * Đăng xuất mọi thiết bị KHÁC, giữ nguyên thiết bị đang thao tác.
     *
     * Dùng sau khi đổi mật khẩu từ trong tài khoản: người vừa đổi mật khẩu cần đuổi được
     * những phiên mà họ không kiểm soát, nhưng bắt họ đăng nhập lại ngay trên chính cái máy
     * vừa đổi thì chỉ gây khó chịu chứ không thêm an toàn.
     *
     * Danh tính lấy từ CHÍNH cookie refresh chứ không từ access token: cookie là thứ duy
     * nhất cho biết phiên nào đang được dùng, mà access token thì không mang thông tin đó.
     */
    @Transactional
    public int revokeOtherSessions(String rawToken, String reason) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidRefreshTokenException("Không có phiên đăng nhập.");
        }
        RefreshToken current = refreshTokenRepository.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> new InvalidRefreshTokenException("Phiên đăng nhập không hợp lệ."));
        if (!current.isActive(LocalDateTime.now())) {
            throw new InvalidRefreshTokenException("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
        return refreshTokenRepository.revokeOtherFamilies(
                current.getUser(), current.getFamilyId(), LocalDateTime.now(), reason);
    }

    private IssuedToken persist(User user, String familyId, LocalDateTime familyExpiresAt,
                                String userAgent, LocalDateTime now) {
        byte[] raw = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(raw);
        String rawToken = URL_ENCODER.encodeToString(raw);

        LocalDateTime idleExpiry = now.plusDays(idleDays);
        LocalDateTime expiresAt = idleExpiry.isAfter(familyExpiresAt) ? familyExpiresAt : idleExpiry;

        RefreshToken entity = new RefreshToken();
        entity.setTokenHash(sha256(rawToken));
        entity.setFamilyId(familyId);
        entity.setUser(user);
        entity.setIssuedAt(now);
        entity.setExpiresAt(expiresAt);
        entity.setFamilyExpiresAt(familyExpiresAt);
        entity.setUserAgent(truncate(userAgent));
        refreshTokenRepository.save(entity);

        return new IssuedToken(rawToken, expiresAt);
    }

    /**
     * Dọn các phiên đã chết hẳn. 4h05 sáng — lệch khỏi cụm job dọn chat (3h00–3h45) và job
     * dọn nhật ký thanh toán (3h15) để không có hai lệnh DELETE lớn chạy chồng nhau.
     */
    @Scheduled(cron = "${jwt.refresh.cleanup-cron:0 5 4 * * *}")
    @Transactional
    public void cleanupExpired() {
        int deleted = refreshTokenRepository.deleteExpiredBefore(LocalDateTime.now());
        if (deleted > 0) {
            log.info("[RefreshToken] Da don {} phien het han.", deleted);
        }
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 180 ? value : value.substring(0, 180);
    }

    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 là thuật toán bắt buộc có trong mọi JRE — nhánh này không xảy ra.
            throw new IllegalStateException("JVM thiếu SHA-256", e);
        }
    }
}
