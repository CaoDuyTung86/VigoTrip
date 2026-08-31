package com.booking.api.integration;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.*;
import com.booking.api.repository.*;
import com.booking.api.service.BookingService;
import com.booking.api.service.EmailService;
import com.booking.api.service.SeatLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BookingServiceIntegrationTest {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ProviderRepository providerRepository;

    @Autowired
    private RouteRepository routeRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private TicketRepository ticketRepository;

    @MockitoBean
    private EmailService emailService;

    @MockitoBean
    private SeatLockService seatLockService;

    private User savedUser;
    private Trip savedTrip;
    private Seat savedSeat;

    @BeforeEach
    void setUp() {
        // Mock seat lock service to allow seat reservation
        when(seatLockService.getLockedBy(anyLong())).thenReturn(null);

        // Seed test data in database
        User user = new User();
        user.setEmail("integration@example.com");
        user.setFullName("Integration User");
        user.setPassword("password123");
        user.setRole("ROLE_USER");
        user.setPoints(0);
        savedUser = userRepository.save(user);

        Provider provider = new Provider();
        provider.setProviderName("Test Transport Co");
        provider.setProviderType("BUS");
        Provider savedProvider = providerRepository.save(provider);

        Vehicle vehicle = new Vehicle();
        vehicle.setProvider(savedProvider);
        vehicle.setVehicleType("BUS");
        vehicle.setTotalSeats(30);
        Vehicle savedVehicle = vehicleRepository.save(vehicle);

        Seat seat = new Seat();
        seat.setVehicle(savedVehicle);
        seat.setSeatNumber("A01");
        seat.setSeatType("NORMAL");
        savedSeat = seatRepository.save(seat);

        Route route = new Route();
        route.setOrigin("Ha Noi");
        route.setDestination("Da Nang");
        Route savedRoute = routeRepository.save(route);

        Trip trip = new Trip();
        trip.setVehicle(savedVehicle);
        trip.setRoute(savedRoute);
        trip.setPrice(java.math.BigDecimal.valueOf(150000));
        trip.setDepartureTime(LocalDateTime.now().plusDays(5));
        trip.setArrivalTime(LocalDateTime.now().plusDays(5).plusHours(6));
        trip.setStatus("SCHEDULED");
        savedTrip = tripRepository.save(trip);
    }

    @Test
    @DisplayName("Integration Test: Đặt vé trọn vẹn từ Controller/Service lưu vào CSDL thực tế")
    void integration_CreateAndGetBookingDetail() {
        BookingRequest request = new BookingRequest();
        request.setTripId(savedTrip.getId());
        request.setSeatIds(Collections.singletonList(savedSeat.getId()));
        request.setPassengerNames(Collections.singletonList("Nguyen Van A"));

        // Execute create booking
        BookingResponse bookingResponse = bookingService.createBooking(savedUser.getEmail(), request);

        assertNotNull(bookingResponse);
        assertNotNull(bookingResponse.getId());
        assertEquals("PENDING", bookingResponse.getStatus());
        assertEquals(0, java.math.BigDecimal.valueOf(150000).compareTo(bookingResponse.getTotalPrice()));

        // Verify record in Database
        Booking entityInDb = bookingRepository.findById(bookingResponse.getId()).orElse(null);
        assertNotNull(entityInDb);
        assertEquals(savedUser.getId(), entityInDb.getUser().getId());
        assertEquals(1, entityInDb.getTickets().size());
        // Tên hành khách được chuẩn hoá về chữ hoa khi lưu, đúng quy ước tên trên vé.
        assertEquals("NGUYEN VAN A", entityInDb.getTickets().get(0).getPassengerName());

        // Verify booking detail retrieval
        BookingResponse fetchedDetail = bookingService.getBookingDetail(savedUser.getEmail(), bookingResponse.getId());
        assertEquals(bookingResponse.getId(), fetchedDetail.getId());

        // Verify user bookings list
        List<BookingResponse> userBookings = bookingService.getMyBookings(savedUser.getEmail());
        assertFalse(userBookings.isEmpty());
        assertEquals(1, userBookings.size());
    }

    @Test
    @DisplayName("Integration Test: Hủy vé và cập nhật trạng thái trong CSDL")
    void integration_CancelBookingFlow() {
        BookingRequest request = new BookingRequest();
        request.setTripId(savedTrip.getId());
        request.setSeatIds(Collections.singletonList(savedSeat.getId()));

        BookingResponse created = bookingService.createBooking(savedUser.getEmail(), request);

        // Cancel created booking
        BookingResponse cancelled = bookingService.cancelBooking(savedUser.getEmail(), created.getId());

        assertEquals("CANCELLED", cancelled.getStatus());

        Booking dbBooking = bookingRepository.findById(created.getId()).orElseThrow();
        assertEquals("CANCELLED", dbBooking.getStatus());
    }
}
