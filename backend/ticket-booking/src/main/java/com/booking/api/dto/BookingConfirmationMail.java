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

    /**
     * Giờ khởi hành/đến, viết theo quy ước đọc được của từng thứ tiếng.
     *
     * <p>Không dùng chung một mẫu {@code dd/MM/yyyy} cho mọi ngôn ngữ: người đọc tiếng Anh
     * mặc định hiểu số đầu là THÁNG, nên "09/12/2026" của một chuyến ngày 9 tháng 12 sẽ được
     * đọc thành 12 tháng 9 — sai ba tháng, và sai một cách im lặng vì cả hai ngày đều có
     * thật. Viết tháng bằng chữ ("09 Dec 2026") thì không còn cách hiểu thứ hai.
     */
    private static final DateTimeFormatter DEPARTURE_FORMAT_VI =
            DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy");
    private static final DateTimeFormatter DEPARTURE_FORMAT_INTL =
            DateTimeFormatter.ofPattern("HH:mm - dd MMM yyyy", Locale.ENGLISH);

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

    /**
     * Bắt buộc gọi trong transaction đang mở, nếu không các quan hệ LAZY sẽ không nạp được.
     *
     * <p>Nhận {@link Locale} vì bản ghi này chứa ngày giờ đã định dạng sẵn. Chỗ nào chưa có
     * dữ liệu thì để {@code null} chứ không tự điền chữ "Đang cập nhật": câu chữ hiển thị
     * thuộc về EmailService (nơi có bảng dịch), còn ở đây mà điền cứng tiếng Việt thì lá mail
     * tiếng Anh của một đơn thiếu dữ liệu sẽ lẫn đúng một dòng tiếng Việt.
     */
    public static BookingConfirmationMail from(Booking booking, Locale locale) {
        DateTimeFormatter format = "vi".equals(locale == null ? null : locale.getLanguage())
                ? DEPARTURE_FORMAT_VI
                : DEPARTURE_FORMAT_INTL;
        List<Ticket> tickets = booking.getTickets() == null ? List.of() : booking.getTickets();

        String seats = tickets.stream()
                .map(t -> t.getSeat().getSeatNumber())
                .collect(Collectors.joining(", "));

        List<Passenger> passengers = tickets.stream()
                .map(t -> new Passenger(upper(t.getPassengerName()), t.getSeat().getSeatNumber()))
                .toList();

        String route = null;
        String departureTime = null;
        String arrivalTime = null;
        String carrier = null;
        if (!tickets.isEmpty()) {
            Trip trip = tickets.get(0).getTrip();
            if (trip != null) {
                if (trip.getRoute() != null) {
                    route = trip.getRoute().getOrigin() + " ➔ " + trip.getRoute().getDestination();
                }
                if (trip.getDepartureTime() != null) {
                    departureTime = trip.getDepartureTime().format(format);
                }
                if (trip.getArrivalTime() != null) {
                    arrivalTime = trip.getArrivalTime().format(format);
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
                seats.isEmpty() ? null : seats,
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
