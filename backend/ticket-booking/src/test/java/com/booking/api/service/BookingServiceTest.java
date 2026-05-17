package com.booking.api.service;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.*;
import com.booking.api.exception.BookingException;
import com.booking.api.mapper.BookingMapper;
import com.booking.api.repository.*;

import io.jsonwebtoken.lang.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private AdditionalServiceRepository additionalServiceRepository;
    @Mock
    private BookingMapper bookingMapper;
    @Mock
    private EmailService emailService;
    @Mock
    private VoucherService voucherService;
    @Mock
    private SeatLockService seatLockService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private BookingService bookingService;

    private User user;
    private Trip trip;
    private Seat seat;
    private BookingRequest request;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("test@example.com");
        user.setFullName("Test User");
        user.setPoints(0);

        Vehicle vehicle = new Vehicle();
        vehicle.setVehicleType("BUS");
        vehicle.setTotalSeats(40);

        trip = new Trip();
        trip.setId(1L);
        trip.setPrice(100000.0);
        trip.setDepartureTime(LocalDateTime.now().plusDays(1));
        trip.setVehicle(vehicle);

        seat = new Seat();
        seat.setId(1L);
        seat.setSeatNumber("A1");
        seat.setSeatType("NORMAL");

        request = new BookingRequest();
        request.setTripId(1L);
        request.setSeatIds(Arrays.asList(1L));
    }

    @Test
    void createBooking_Success() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(trip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(seat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(false);
        when(seatLockService.getLockedBy(1L)).thenReturn(null);
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        BookingResponse response = bookingService.createBooking("test@example.com", request);

        assertNotNull(response);
        verify(bookingRepository, times(1)).save(any(Booking.class));
        verify(seatLockService, times(1)).removeLockBySeatId(1L);
    }

    @Test
    void createBooking_Fail_TripDeparted() {
        trip.setDepartureTime(LocalDateTime.now().minusHours(1));
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(trip));

        assertThrows(BookingException.class, () -> {
            bookingService.createBooking("test@example.com", request);
        });
    }

    @Test
    void createBooking_Fail_SeatAlreadyBooked() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(tripRepository.findById(1L)).thenReturn(Optional.of(trip));
        when(seatRepository.findByIdWithLock(1L)).thenReturn(Optional.of(seat));
        when(ticketRepository.existsByTripIdAndSeatId(1L, 1L)).thenReturn(true);

        BookingException exception = assertThrows(BookingException.class, () -> {
            bookingService.createBooking("test@example.com", request);
        });
        assertTrue(exception.getMessage().contains("đã được đặt"));
    }

    @Test
    void cancelBooking_WithFullRefund() {
        Booking booking = new Booking();
        booking.setId(1L);
        booking.setUser(user);
        booking.setTotalPrice(100000.0);
        booking.setStatus("CONFIRMED");
        
        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        booking.setTickets(Collections.singletonList(ticket));

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.cancelBooking("test@example.com", 1L);

        assertEquals("CANCELLED", booking.getStatus());
        assertEquals(1, booking.getRefunds().size());
        assertEquals(100000.0, booking.getRefunds().get(0).getRefundAmount());
    }

    @Test
    void checkIn_Success() {
        Booking booking = new Booking();
        booking.setId(1L);
        booking.setStatus("CONFIRMED");
        booking.setIsCheckedIn(false);

        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(bookingMapper.toBookingResponse(any(), any())).thenReturn(new BookingResponse());

        bookingService.checkIn(1L);

        assertTrue(booking.getIsCheckedIn());
        assertNotNull(booking.getCheckInDate());
        verify(bookingRepository).save(booking);
    }
}
