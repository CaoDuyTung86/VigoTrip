package com.booking.api.repository;

import com.booking.api.entity.ChatTurnMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatTurnMetricRepository extends JpaRepository<ChatTurnMetric, Long> {

    /**
     * Một dòng tổng hợp cho cả kỳ:
     * [0] tổng lượt, [1] độ trễ trung bình, [2] độ trễ lớn nhất, [3] số lượt của thành viên,
     * [4] số lượt có RAG trúng, [5] số lượt không OK, [6] độ dài câu trả lời trung bình.
     */
    @Query("SELECT COUNT(m), AVG(m.latencyMs), MAX(m.latencyMs), "
            + "SUM(CASE WHEN m.authenticated = TRUE THEN 1 ELSE 0 END), "
            + "SUM(CASE WHEN m.ragChunks > 0 THEN 1 ELSE 0 END), "
            + "SUM(CASE WHEN m.outcome <> 'OK' THEN 1 ELSE 0 END), "
            + "AVG(m.answerChars) "
            + "FROM ChatTurnMetric m WHERE m.createdAt >= :since")
    List<Object[]> aggregateSince(@Param("since") LocalDateTime since);

    /**
     * Chuỗi theo ngày: [năm, tháng, ngày, số lượt, độ trễ trung bình, số lượt lỗi, số lượt RAG trúng].
     *
     * Tách năm/tháng/ngày thay vì CAST sang DATE để chạy được trên cả SQL Server (môi
     * trường thật) lẫn H2 (profile local) mà không phải viết native query cho từng bên.
     */
    @Query("SELECT YEAR(m.createdAt), MONTH(m.createdAt), DAY(m.createdAt), COUNT(m), AVG(m.latencyMs), "
            + "SUM(CASE WHEN m.outcome <> 'OK' THEN 1 ELSE 0 END), "
            + "SUM(CASE WHEN m.ragChunks > 0 THEN 1 ELSE 0 END) "
            + "FROM ChatTurnMetric m WHERE m.createdAt >= :since "
            + "GROUP BY YEAR(m.createdAt), MONTH(m.createdAt), DAY(m.createdAt) "
            + "ORDER BY YEAR(m.createdAt), MONTH(m.createdAt), DAY(m.createdAt)")
    List<Object[]> dailySince(@Param("since") LocalDateTime since);

    @Modifying
    @Query("DELETE FROM ChatTurnMetric m WHERE m.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
