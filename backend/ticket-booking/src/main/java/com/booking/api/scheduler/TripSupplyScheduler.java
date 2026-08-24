package com.booking.api.scheduler;

import com.booking.api.service.TripSupplyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Giữ cho lịch chuyến luôn phủ đủ N ngày tới.
 *
 * Trước đây dữ liệu chuyến sinh cứng 30 ngày kể từ lúc seed rồi thôi, nên cứ để lâu
 * là lịch tự cạn dần: hôm nay còn 30 ngày, tuần sau còn 23, hết tháng thì trắng.
 * Mỗi lần chạy chỉ thêm đúng phần rìa còn thiếu (thường là 1 ngày mới ở cuối cửa sổ),
 * nên chi phí gần như không đổi và bảng chuyen_di lớn lên tuyến tính chứ không nhân đôi.
 *
 * KHÔNG dọn chuyến quá khứ ở đây, và cũng không nên thêm: Trip.tickets đang cascade
 * ALL + orphanRemoval nên xoá chuyến cũ là xoá luôn vé đã bán, mà mọi thống kê doanh
 * thu theo tuyến / theo nhà xe trong BookingRepository đều join qua đúng đường đó.
 * Chuyến đã qua tự ẩn khỏi giao diện khách nhờ bộ lọc thời gian trong TripService,
 * không cần xoá khỏi DB.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TripSupplyScheduler {

    private final TripSupplyService tripSupplyService;

    /** 3h sáng hằng ngày — giờ thấp điểm, tránh đụng lúc khách đang tìm vé. */
    @Scheduled(cron = "0 0 3 * * *")
    public void topUpTripSupply() {
        try {
            int created = tripSupplyService.ensureSupply();
            if (created > 0) {
                log.info("[TripSupplyScheduler] Bù {} chuyến cho rìa cửa sổ lịch.", created);
            }
        } catch (Exception e) {
            // Nuốt lỗi có chủ đích: @Scheduled ném exception ra ngoài thì Spring huỷ luôn
            // lịch chạy tiếp theo, một lần lỗi mạng tới Neon sẽ làm chết hẳn việc bù chuyến.
            log.error("[TripSupplyScheduler] Bù chuyến thất bại, sẽ thử lại ở lần chạy sau.", e);
        }
    }
}
