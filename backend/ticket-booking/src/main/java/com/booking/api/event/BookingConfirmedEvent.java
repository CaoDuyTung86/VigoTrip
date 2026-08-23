package com.booking.api.event;

import com.booking.api.dto.BookingConfirmationMail;

/**
 * Đơn vé đã được thanh toán và ghi nhận xong.
 *
 * Phát ra sự kiện thay vì gọi thẳng EmailService để mail chỉ đi SAU khi transaction
 * commit: gọi trực tiếp thì một rollback sau đó vẫn để lại cái mail "đặt vé thành công"
 * cho đơn không tồn tại, mà mail thì không thu hồi được.
 */
public record BookingConfirmedEvent(String toEmail, BookingConfirmationMail mail) {
}
