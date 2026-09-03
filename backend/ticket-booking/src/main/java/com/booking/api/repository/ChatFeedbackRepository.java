package com.booking.api.repository;

import com.booking.api.entity.ChatFeedback;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatFeedbackRepository extends JpaRepository<ChatFeedback, Long> {

    Optional<ChatFeedback> findByMessageRef(String messageRef);

    /**
     * Thống kê gộp để trả lời "chatbot đang yếu ở đâu": mỗi dòng là (rating, reason, số lượt).
     * Cố ý không có phương thức nào đọc phản hồi của một người cụ thể — dữ liệu này chỉ
     * dùng ở dạng tổng hợp.
     */
    @Query("SELECT f.rating, f.reason, COUNT(f) FROM ChatFeedback f "
            + "WHERE f.createdAt >= :since GROUP BY f.rating, f.reason")
    List<Object[]> summarizeSince(@Param("since") LocalDateTime since);

    /**
     * Xóa trắng phần nội dung đã quá hạn, giữ lại dòng điểm số.
     * Trả về số dòng bị ảnh hưởng.
     */
    @Modifying
    @Query("UPDATE ChatFeedback f SET f.questionSnippet = NULL "
            + "WHERE f.questionSnippet IS NOT NULL AND f.createdAt < :cutoff")
    int purgeSnippetsOlderThan(@Param("cutoff") LocalDateTime cutoff);

    /** Chuỗi theo ngày cho biểu đồ: [năm, tháng, ngày, rating, số lượt]. */
    @Query("SELECT YEAR(f.createdAt), MONTH(f.createdAt), DAY(f.createdAt), f.rating, COUNT(f) "
            + "FROM ChatFeedback f WHERE f.createdAt >= :since "
            + "GROUP BY YEAR(f.createdAt), MONTH(f.createdAt), DAY(f.createdAt), f.rating "
            + "ORDER BY YEAR(f.createdAt), MONTH(f.createdAt), DAY(f.createdAt)")
    List<Object[]> dailyRatingsSince(@Param("since") LocalDateTime since);

    /**
     * Những câu hỏi bị đánh giá xấu, để biết cụ thể chatbot đang hỏng ở đâu.
     *
     * Chỉ lấy dòng CÓ questionSnippet — tức là người hỏi đã đăng nhập và đang bật đồng ý
     * lưu hội thoại. Câu trả lời của bot và phần còn lại của hội thoại không nằm trong
     * bảng này, nên đây không phải là một cửa hậu để đọc chat của người dùng.
     */
    @Query("SELECT f FROM ChatFeedback f WHERE f.rating = 'DOWN' AND f.questionSnippet IS NOT NULL "
            + "AND f.createdAt >= :since ORDER BY f.createdAt DESC")
    List<ChatFeedback> findRecentIssues(@Param("since") LocalDateTime since, Pageable pageable);

    @Modifying
    @Query("DELETE FROM ChatFeedback f WHERE f.userEmail = :userEmail")
    int deleteByUserEmail(@Param("userEmail") String userEmail);
}
