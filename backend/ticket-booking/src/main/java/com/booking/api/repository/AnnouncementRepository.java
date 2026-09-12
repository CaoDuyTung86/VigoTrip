package com.booking.api.repository;

import com.booking.api.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    /**
     * Tin đang bật và đang trong hạn, đã xếp sẵn thứ tự.
     *
     * <p>Lọc hạn bằng câu SQL chứ không tải hết rồi lọc trong Java như nhánh voucher: bảng
     * voucher có vài chục dòng và đã có sẵn {@code findByIsActiveTrue} dùng chung với trang ưu
     * đãi, còn bảng này chỉ phình ra theo thời gian vì tin cũ được giữ lại. Lọc ở đây thì một
     * năm sau dải tin vẫn chỉ đọc về đúng mấy dòng đang hiện.
     *
     * <p>{@code NULL} ở hai mốc hiệu lực nghĩa là không chặn phía đó: chưa đặt ngày bắt đầu là
     * hiện ngay, chưa đặt ngày kết thúc là hiện tới khi có người tắt.
     */
    @Query("SELECT a FROM Announcement a WHERE a.active = true "
            + "AND (a.startsAt IS NULL OR a.startsAt <= :now) "
            + "AND (a.endsAt IS NULL OR a.endsAt >= :now) "
            + "ORDER BY a.sortOrder ASC, a.id DESC")
    List<Announcement> findLive(@Param("now") LocalDateTime now);

    /** Toàn bộ bản ghi cho màn quản trị, tin mới nhất lên đầu. */
    List<Announcement> findAllByOrderBySortOrderAscIdDesc();
}
