package com.booking.api.repository;

import com.booking.api.entity.RefreshToken;
import com.booking.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * Tra cứu theo hash, KHÔNG lọc sẵn "còn hiệu lực".
     *
     * Cố tình như vậy: bản ghi đã thu hồi phải tìm ra được thì mới phát hiện được việc dùng
     * lại token cũ (bất biến 3 của RefreshToken). Lọc ngay ở câu truy vấn sẽ biến một vụ trộm
     * thành một lỗi 401 bình thường và không ai biết gì.
     */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByFamilyId(String familyId);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.revokedReason = :reason "
            + "where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") String familyId,
                     @Param("now") LocalDateTime now,
                     @Param("reason") String reason);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.revokedReason = :reason "
            + "where t.user = :user and t.revokedAt is null")
    int revokeAllForUser(@Param("user") User user,
                         @Param("now") LocalDateTime now,
                         @Param("reason") String reason);

    /** Đăng xuất mọi thiết bị KHÁC, giữ lại đúng thiết bị đang thao tác (họ keepFamily). */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.revokedReason = :reason "
            + "where t.user = :user and t.familyId <> :keepFamily and t.revokedAt is null")
    int revokeOtherFamilies(@Param("user") User user,
                            @Param("keepFamily") String keepFamily,
                            @Param("now") LocalDateTime now,
                            @Param("reason") String reason);

    /**
     * Dọn bản ghi đã hết hạn. Chỉ xoá thứ đã chết hẳn (quá hạn cả họ) — bản ghi đã thu hồi
     * nhưng chưa hết hạn vẫn phải ở lại, vì nó chính là cái bẫy phát hiện dùng lại token.
     */
    @Modifying
    @Query("delete from RefreshToken t where t.familyExpiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);

    long countByUserAndRevokedAtIsNull(User user);
}
