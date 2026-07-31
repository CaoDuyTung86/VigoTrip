package com.booking.api.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Verify Google ID Token phía server — không tin tưởng bất kỳ dữ liệu nào từ client.
 *
 * Luồng đúng:
 *  1. Frontend gọi Google Sign-In SDK → nhận idToken (JWT do Google ký)
 *  2. Frontend gửi idToken lên backend
 *  3. Backend gọi Google API để verify chữ ký + audience + expiry
 *  4. Nếu hợp lệ → lấy email & name từ payload của Google (không từ client)
 */
@Component
@Slf4j
public class GoogleTokenVerifier {

    private final GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${google.client-id:}") String clientId) {
        if (clientId == null || clientId.isBlank()) {
            log.warn("[GoogleTokenVerifier] google.client-id chưa được cấu hình — Google Login sẽ bị từ chối.");
            this.verifier = null;
        } else {
            this.verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(clientId))
                    .build();
            log.info("[GoogleTokenVerifier] Initialized with clientId={}", clientId);
        }
    }

    /**
     * Verify Google ID Token và trả về payload nếu hợp lệ.
     *
     * @param idTokenString raw ID Token string từ client
     * @return GoogleIdToken.Payload (chứa email, name, ...) hoặc null nếu không hợp lệ
     */
    public GoogleIdToken.Payload verify(String idTokenString) {
        if (verifier == null) {
            log.error("[GoogleTokenVerifier] Không thể verify — google.client-id chưa cấu hình.");
            return null;
        }
        try {
            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                log.warn("[GoogleTokenVerifier] Token không hợp lệ hoặc đã hết hạn.");
                return null;
            }
            return idToken.getPayload();
        } catch (Exception e) {
            log.error("[GoogleTokenVerifier] Lỗi khi verify token: {}", e.getMessage());
            return null;
        }
    }
}
