package com.booking.api.scheduler;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Tự động đánh dấu no_show cho các booking đã thanh toán mà khách không xuất hiện.
 *
 * Trước đây một vé không được check-in cứ nằm mãi ở PAID/CONFIRMED, không có gì phân
 * biệt "khách chưa tới bến" với "khách bỏ lỡ chuyến" — không ai được báo, không có dữ
 * liệu nào để tra sau này. Cố tình KHÔNG đổi Booking.status: rất nhiều query doanh thu
 * (BookingRepository) đang lọc cứng status IN ('CONFIRMED','PAID','COMPLETED') — thêm
 * hẳn một status mới buộc phải sửa tất cả các query đó, trong khi tiền đã thu vẫn phải
 * tính là doanh thu dù khách không tới. Noshow chỉ là một cờ thông tin thêm, không đụng
 * tới ngữ nghĩa status sẵn có.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NoShowScheduler {

    private final BookingRepository bookingRepository;

    // Chạy mỗi giờ, cùng nhịp với TripReminderScheduler.
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void markNoShows() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> candidates = bookingRepository.findNoShowCandidates(now);

        List<Booking> toMark = new ArrayList<>();
        for (Booking booking : candidates) {
            if (booking.getTickets() == null || booking.getTickets().isEmpty()) {
                continue;
            }
            Ticket firstTicket = booking.getTickets().get(0);
            if (firstTicket.getTrip() == null || firstTicket.getTrip().getDepartureTime() == null) {
                continue;
            }
            // Lọc lại chính xác bằng cùng công thức mà checkIn() dùng để chặn quét quá
            // muộn — JPQL ở findNoShowCandidates chỉ lọc thô theo departureTime, chưa
            // tính buffer theo arrivalTime.
            if (now.isAfter(firstTicket.getTrip().getLateCheckInCutoff())) {
                booking.setNoShow(true);
                toMark.add(booking);
            }
        }

        if (!toMark.isEmpty()) {
            bookingRepository.saveAll(toMark);
            log.info("[NoShow] Đánh dấu no_show cho {} booking", toMark.size());
        }
    }
}
