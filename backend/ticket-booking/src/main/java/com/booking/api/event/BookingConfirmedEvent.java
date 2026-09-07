package com.booking.api.event;

import com.booking.api.dto.BookingConfirmationMail;

/**
 * Đơn vé đã được thanh toán và ghi nhận xong.
 *
 * Phát ra sự kiện thay vì gọi thẳng EmailService để mail chỉ đi SAU khi transaction
 * commit: gọi trực tiếp thì một rollback sau đó vẫn để lại cái mail "đặt vé thành công"
 * cho đơn không tồn tại, mà mail thì không thu hồi được.
 *
 * <p>Ngôn ngữ đi kèm ngay trong sự kiện, cùng lý do với địa chỉ email và dữ liệu vé: nó
 * được đọc lúc transaction còn mở, còn lúc listener chạy thì booking.getUser() đã không
 * nạp được nữa.
 */
public record BookingConfirmedEvent(String toEmail, BookingConfirmationMail mail, java.util.Locale locale) {
}
