package com.booking.api.dto;

import com.booking.api.entity.Booking;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;

/**
 * Ảnh chụp phẳng của một booking, đủ để dựng mail xác nhận.
 *
 * Lý do tồn tại: EmailService chạy trên thread @Async riêng, còn Hibernate Session lại
 * gắn với thread request. Truyền thẳng entity Booking sang thread kia rồi mới đụng vào
 * tickets/seat/trip/route (đều LAZY) là một cuộc đua với thời điểm transaction đóng —
 * thua cuộc thì nổ LazyInitializationException và mail im lặng không đi. Trên máy local
 * (DB cùng máy, request kéo dài hơn) thường thắng, trên deploy thì thường thua.
 *
 * Vì vậy mọi lazy association phải được đọc TẠI ĐÂY, trong transaction của luồng gọi,
 * trước khi bàn giao cho thread gửi mail.
 */
public record BookingConfirmationMail(
        Long bookingId,
        String route,
        String departureTime,
        String seats,
        BigDecimal totalPrice
) {

    private static final DateTimeFormatter DEPARTURE_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy");
    private static final String PENDING = "Đang cập nhật";

    /** Bắt buộc gọi trong transaction đang mở, nếu không các quan hệ LAZY sẽ không nạp được. */
    public static BookingConfirmationMail from(Booking booking) {
        String seats = booking.getTickets() == null ? "" : booking.getTickets().stream()
                .map(t -> t.getSeat().getSeatNumber())
                .collect(Collectors.joining(", "));

        String route = PENDING;
        String departureTime = PENDING;
        if (booking.getTickets() != null && !booking.getTickets().isEmpty()) {
            var trip = booking.getTickets().get(0).getTrip();
            if (trip != null) {
                if (trip.getRoute() != null) {
                    route = trip.getRoute().getOrigin() + " ➔ " + trip.getRoute().getDestination();
                }
                if (trip.getDepartureTime() != null) {
                    departureTime = trip.getDepartureTime().format(DEPARTURE_FORMAT);
                }
            }
        }

        return new BookingConfirmationMail(
                booking.getId(),
                route,
                departureTime,
                seats.isEmpty() ? PENDING : seats,
                booking.getTotalPrice()
        );
    }
}
