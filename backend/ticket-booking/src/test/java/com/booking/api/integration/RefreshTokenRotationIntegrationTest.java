package com.booking.api.integration;

import com.booking.api.entity.RefreshToken;
import com.booking.api.entity.User;
import com.booking.api.exception.InvalidRefreshTokenException;
import com.booking.api.repository.RefreshTokenRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.service.RefreshTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Bảo vệ ba bất biến của refresh token (xem phần đầu RefreshToken.java). Mất bất kỳ cái nào
 * thì phiên dài hạn quay về đúng thứ mà thiết kế này sinh ra để thay thế: một chìa khoá
 * sống hàng tuần, không thu hồi được.
 *
 * Cửa sổ tha thứ đặt về 0 cho cả lớp — ở đây ta kiểm tra luật nghiêm ngặt. Riêng hành vi
 * của cửa sổ đó có bài kiểm tra riêng bên dưới, tự bật lại đúng lúc cần.
 */
@SpringBootTest(properties = "jwt.refresh.reuse-grace-seconds=0")
@ActiveProfiles("test")
class RefreshTokenRotationIntegrationTest {

    private static final String UA = "JUnit/1.0";

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("refresh.rotation@example.com");
        user.setFullName("Người dùng kiểm thử");
        user.setRole("ROLE_USER");
        user.setEnabled(true);
        user = userRepository.saveAndFlush(user);
    }

    @AfterEach
    void tearDown() {
        refreshTokenRepository.deleteAll();
        userRepository.delete(user);
    }

    @Test
    @DisplayName("Token thô không bao giờ được lưu xuống cơ sở dữ liệu")
    void rawTokenIsNeverPersisted() {
        RefreshTokenService.IssuedToken issued = refreshTokenService.issue(user, UA);

        List<RefreshToken> rows = refreshTokenRepository.findAll();
        assertEquals(1, rows.size());
        assertNotEquals(issued.rawToken(), rows.get(0).getTokenHash());
        assertEquals(64, rows.get(0).getTokenHash().length(), "SHA-256 dạng hex phải đúng 64 ký tự");
        // Đọc trộm được cả bảng cũng không dựng lại được chuỗi để đem đi dùng.
        assertFalse(rows.get(0).getTokenHash().contains(issued.rawToken()));
    }

    @Test
    @DisplayName("Xoay vòng: token cũ chết ngay khi token mới ra đời")
    void rotationKillsThePreviousToken() {
        RefreshTokenService.IssuedToken first = refreshTokenService.issue(user, UA);

        RefreshTokenService.RotationResult second = refreshTokenService.rotate(first.rawToken(), UA);

        assertEquals(user.getId(), second.user().getId());
        assertNotEquals(first.rawToken(), second.token().rawToken());

        // Token mới dùng được, và đó là cái duy nhất dùng được.
        assertDoesNotThrow(() -> refreshTokenService.rotate(second.token().rawToken(), UA));
    }

    @Test
    @DisplayName("Dùng lại token đã xoay thì CẢ HỌ bị thu hồi, không chỉ token đó")
    void reuseOfARotatedTokenRevokesTheWholeFamily() {
        // Kịch bản thật: kẻ tấn công chép được token ở thời điểm T. Nạn nhân gọi /refresh
        // (token T chết, sinh ra T+1). Sau đó kẻ tấn công đem T ra dùng.
        RefreshTokenService.IssuedToken stolen = refreshTokenService.issue(user, UA);
        RefreshTokenService.RotationResult victimsNewToken = refreshTokenService.rotate(stolen.rawToken(), UA);

        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(stolen.rawToken(), UA));

        // Điểm mấu chốt: token HỢP LỆ của nạn nhân cũng phải chết theo. Máy chủ không phân
        // biệt được ai là chủ, nên cả hai cùng bị đá ra và cùng phải đăng nhập lại — phiền
        // một lần, nhưng kẻ trộm không còn đường vào.
        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(victimsNewToken.token().rawToken(), UA));

        assertTrue(refreshTokenRepository.findAll().stream()
                        .allMatch(t -> t.getRevokedAt() != null),
                "Không được còn phiên nào sống sót trong họ đã bị lộ");
    }

    @Test
    @DisplayName("Cửa sổ tha thứ: hai tab cùng làm mới một lúc thì KHÔNG bị coi là trộm")
    void concurrentRefreshWithinGraceWindowIsForgiven() {
        // Tình huống này xảy ra thật: hai tab cùng nhận 401 và cùng gọi /refresh, hoặc client
        // mất phản hồi giữa đường rồi thử lại. Nếu coi là trộm thì người dùng bị đăng xuất vì
        // một sự cố mạng.
        ReflectionTestUtils.setField(refreshTokenService, "reuseGraceSeconds", 10L);
        try {
            RefreshTokenService.IssuedToken first = refreshTokenService.issue(user, UA);
            RefreshTokenService.RotationResult tabA = refreshTokenService.rotate(first.rawToken(), UA);
            RefreshTokenService.RotationResult tabB = refreshTokenService.rotate(first.rawToken(), UA);

            assertNotEquals(tabA.token().rawToken(), tabB.token().rawToken());
            // Cả hai đều nhận được token dùng được, và vẫn nằm trong cùng một họ.
            assertDoesNotThrow(() -> refreshTokenService.rotate(tabB.token().rawToken(), UA));
        } finally {
            ReflectionTestUtils.setField(refreshTokenService, "reuseGraceSeconds", 0L);
        }
    }

    @Test
    @DisplayName("Token hết hạn bị từ chối, dù chưa ai thu hồi nó")
    void expiredTokenIsRejected() {
        RefreshTokenService.IssuedToken issued = refreshTokenService.issue(user, UA);

        RefreshToken row = refreshTokenRepository.findAll().get(0);
        row.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        refreshTokenRepository.saveAndFlush(row);

        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(issued.rawToken(), UA));
    }

    @Test
    @DisplayName("Trần cứng của họ chặn phiên sống mãi nhờ xoay liên tục")
    void familyAbsoluteDeadlineStopsEndlessRotation() {
        RefreshTokenService.IssuedToken issued = refreshTokenService.issue(user, UA);

        RefreshToken row = refreshTokenRepository.findAll().get(0);
        row.setFamilyExpiresAt(LocalDateTime.now().minusMinutes(1));
        refreshTokenRepository.saveAndFlush(row);

        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(issued.rawToken(), UA));
    }

    @Test
    @DisplayName("Đăng xuất thu hồi token phía máy chủ, không chỉ xoá cookie")
    void logoutRevokesServerSide() {
        RefreshTokenService.IssuedToken issued = refreshTokenService.issue(user, UA);

        refreshTokenService.revokeByRawToken(issued.rawToken());

        // Đây chính là điều mà một hệ thống chỉ có JWT không làm được: bản sao đã bị lấy đi
        // cũng hết tác dụng ngay lập tức.
        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(issued.rawToken(), UA));
    }

    @Test
    @DisplayName("Đăng xuất thiết bị khác giữ nguyên thiết bị đang thao tác")
    void revokeOtherSessionsKeepsCurrentDevice() {
        RefreshTokenService.IssuedToken phone = refreshTokenService.issue(user, "Phone");
        RefreshTokenService.IssuedToken laptop = refreshTokenService.issue(user, "Laptop");

        int revoked = refreshTokenService.revokeOtherSessions(laptop.rawToken(), "TEST");

        assertEquals(1, revoked);
        assertThrows(InvalidRefreshTokenException.class,
                () -> refreshTokenService.rotate(phone.rawToken(), UA));
        assertDoesNotThrow(() -> refreshTokenService.rotate(laptop.rawToken(), UA));
    }

    @Test
    @DisplayName("Thu hồi toàn bộ phiên khi đổi mật khẩu")
    void revokeAllSessionsClearsEveryDevice() {
        RefreshTokenService.IssuedToken phone = refreshTokenService.issue(user, "Phone");
        RefreshTokenService.IssuedToken laptop = refreshTokenService.issue(user, "Laptop");

        int revoked = refreshTokenService.revokeAllSessions(user, RefreshTokenService.REASON_PASSWORD_CHANGED);

        assertEquals(2, revoked);
        assertThrows(InvalidRefreshTokenException.class, () -> refreshTokenService.rotate(phone.rawToken(), UA));
        assertThrows(InvalidRefreshTokenException.class, () -> refreshTokenService.rotate(laptop.rawToken(), UA));
    }
}
