package com.booking.api.repository;

import com.booking.api.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * Lịch sử của MỘT người dùng, mới nhất trước.
     * Mọi truy vấn đọc đều bắt buộc lọc theo userEmail — không có phương thức nào cho
     * phép đọc hội thoại xuyên người dùng.
     */
    List<ChatMessage> findByUserEmailOrderByCreatedAtDesc(String userEmail, Pageable pageable);

    long countByUserEmail(String userEmail);

    @Modifying
    @Query("DELETE FROM ChatMessage m WHERE m.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);

    @Modifying
    @Query("DELETE FROM ChatMessage m WHERE m.userEmail = :userEmail")
    int deleteByUserEmail(@Param("userEmail") String userEmail);
}
