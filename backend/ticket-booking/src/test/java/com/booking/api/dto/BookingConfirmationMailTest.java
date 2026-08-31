package com.booking.api.dto;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Provider;
import com.booking.api.entity.Route;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BookingConfirmationMailTest {

    @Test
    @DisplayName("Gom đủ hành khách của đơn, mỗi ghế một dòng, tên đã in hoa")
    void from_collectsEveryPassengerUppercased() {
        Trip trip = trip("Hà Nội", "Vinh", "VigoTrip Express");
        Booking booking = booking(trip,
                ticket(trip, "2C", "Nguyễn Văn A"),
                ticket(trip, "2D", "trần thị bích"));

        BookingConfirmationMail mail = BookingConfirmationMail.from(booking);

        assertEquals(2, mail.passengers().size());
        assertEquals("NGUYỄN VĂN A", mail.passengers().get(0).name());
        assertEquals("2C", mail.passengers().get(0).seat());
        assertEquals("TRẦN THỊ BÍCH", mail.passengers().get(1).name());
        assertEquals("2D", mail.passengers().get(1).seat());
        assertEquals("2C, 2D", mail.seats());
    }

    @Test
    @DisplayName("Cắt khoảng trắng thừa và chịu được vé chưa có tên hành khách")
    void from_toleratesMissingName() {
        Trip trip = trip("Hà Nội", "Vinh", "VigoTrip Express");
        Booking booking = booking(trip,
                ticket(trip, "1A", "  le van c  "),
                ticket(trip, "1B", null));

        BookingConfirmationMail mail = BookingConfirmationMail.from(booking);

        assertEquals("LE VAN C", mail.passengers().get(0).name());
        assertEquals("", mail.passengers().get(1).name());
    }

    @Test
    @DisplayName("Đọc kèm hãng vận chuyển và giờ đến cho phần tóm tắt hành trình")
    void from_readsCarrierAndArrival() {
        Trip trip = trip("Hà Nội", "Vinh", "VigoTrip Express");
        BookingConfirmationMail mail = BookingConfirmationMail.from(booking(trip, ticket(trip, "2C", "A")));

        assertEquals("Hà Nội ➔ Vinh", mail.route());
        assertEquals("VigoTrip Express", mail.carrier());
        assertEquals("09:00 - 08/09/2026", mail.departureTime());
        assertEquals("15:30 - 08/09/2026", mail.arrivalTime());
    }

    @Test
    @DisplayName("Đơn chưa có vé không làm nổ hàm dựng mail")
    void from_handlesEmptyBooking() {
        Booking booking = new Booking();
        booking.setId(7L);
        booking.setTotalPrice(BigDecimal.ZERO);
        booking.setTickets(null);

        BookingConfirmationMail mail = BookingConfirmationMail.from(booking);

        assertTrue(mail.passengers().isEmpty());
        assertEquals("Đang cập nhật", mail.route());
        assertEquals("Đang cập nhật", mail.seats());
    }

    private Booking booking(Trip trip, Ticket... tickets) {
        Booking booking = new Booking();
        booking.setId(48L);
        booking.setTotalPrice(new BigDecimal("680000"));
        booking.setTickets(List.of(tickets));
        return booking;
    }

    private Ticket ticket(Trip trip, String seatNumber, String passengerName) {
        Seat seat = new Seat();
        seat.setSeatNumber(seatNumber);

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        ticket.setSeat(seat);
        ticket.setPassengerName(passengerName);
        return ticket;
    }

    private Trip trip(String origin, String destination, String providerName) {
        Route route = new Route();
        route.setOrigin(origin);
        route.setDestination(destination);

        Provider provider = new Provider();
        provider.setProviderName(providerName);

        Vehicle vehicle = new Vehicle();
        vehicle.setProvider(provider);

        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicle(vehicle);
        trip.setDepartureTime(LocalDateTime.of(2026, 9, 8, 9, 0));
        trip.setArrivalTime(LocalDateTime.of(2026, 9, 8, 15, 30));
        return trip;
    }
}
