package com.booking.api.dto;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
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
        String arrivalTime,
        String carrier,
        String seats,
        List<Passenger> passengers,
        String contactName,
        String contactEmail,
        String contactPhone,
        BigDecimal totalPrice
) {

    private static final DateTimeFormatter DEPARTURE_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy");
    private static final String PENDING = "Đang cập nhật";

    /**
     * Một dòng hành khách trên vé: tên đã in hoa + ghế đã gán.
     *
     * In hoa ngay từ đây chứ không để tầng render tự lo: đây là chuẩn đặt chỗ của hàng
     * không (tên trên vé phải khớp giấy tờ, viết hoa không dấu phân cách), và giữ nguyên
     * một chỗ hoa hoá thì mail, vé PDF hay bất kỳ nơi nào dùng lại record này cũng ra
     * cùng một dạng.
     */
    public record Passenger(String name, String seat) {
    }

    /** Bắt buộc gọi trong transaction đang mở, nếu không các quan hệ LAZY sẽ không nạp được. */
    public static BookingConfirmationMail from(Booking booking) {
        List<Ticket> tickets = booking.getTickets() == null ? List.of() : booking.getTickets();

        String seats = tickets.stream()
                .map(t -> t.getSeat().getSeatNumber())
                .collect(Collectors.joining(", "));

        List<Passenger> passengers = tickets.stream()
                .map(t -> new Passenger(upper(t.getPassengerName()), t.getSeat().getSeatNumber()))
                .toList();

        String route = PENDING;
        String departureTime = PENDING;
        String arrivalTime = PENDING;
        String carrier = PENDING;
        if (!tickets.isEmpty()) {
            Trip trip = tickets.get(0).getTrip();
            if (trip != null) {
                if (trip.getRoute() != null) {
                    route = trip.getRoute().getOrigin() + " ➔ " + trip.getRoute().getDestination();
                }
                if (trip.getDepartureTime() != null) {
                    departureTime = trip.getDepartureTime().format(DEPARTURE_FORMAT);
                }
                if (trip.getArrivalTime() != null) {
                    arrivalTime = trip.getArrivalTime().format(DEPARTURE_FORMAT);
                }
                if (trip.getVehicle() != null && trip.getVehicle().getProvider() != null) {
                    carrier = trip.getVehicle().getProvider().getProviderName();
                }
            }
        }

        return new BookingConfirmationMail(
                booking.getId(),
                route,
                departureTime,
                arrivalTime,
                carrier,
                seats.isEmpty() ? PENDING : seats,
                passengers,
                upper(booking.getContactName()),
                booking.getContactEmail(),
                booking.getContactPhone(),
                booking.getTotalPrice()
        );
    }

    /**
     * Locale.ROOT chứ không phải locale mặc định của máy chủ: chỉ cần server chạy dưới
     * locale Thổ Nhĩ Kỳ là "i" hoá hoa thành "İ" và tên khách sai chính tả.
     */
    private static String upper(String name) {
        return name == null ? "" : name.trim().toUpperCase(Locale.ROOT);
    }
}
