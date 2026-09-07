package com.booking.api.event;

import com.booking.api.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Gửi mail xác nhận sau khi đơn vé đã thực sự được ghi xuống DB.
 *
 * Không cần @Async ở đây: EmailService đã gắn @Async ở cấp class nên lời gọi bên dưới
 * tự nhảy sang pool "emailTaskExecutor". Dữ liệu trong event cũng đã phẳng hóa sẵn
 * (BookingConfirmationMail) nên thread đó không phải chạm vào Hibernate.
 */
@Component
@RequiredArgsConstructor
public class BookingConfirmedListener {

    private final EmailService emailService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        emailService.sendBookingConfirmation(event.toEmail(), event.mail(), event.locale());
    }
}
