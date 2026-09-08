package com.booking.api.service;

import com.booking.api.dto.SeatResponse;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Vehicle;
import com.booking.api.mapper.TripMapper;
import com.booking.api.realtime.SeatIdentity;
import com.booking.api.realtime.SeatOwnerTokenService;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Sơ đồ ghế trả qua REST phải nói cùng một thứ tiếng với sự kiện phát qua WebSocket.
 *
 * <p>Giao diện chỉ có một phép so duy nhất để biết "ghế này của tôi hay của người khác":
 * {@code seat.tempLockedBy === ownerToken}. Hai đường dữ liệu mà trả hai hệ quy chiếu khác
 * nhau thì phép so đó vô nghĩa — và người dùng là người trả giá: tải lại trang ở giữa luồng
 * đặt vé (lúc chỉ có đường REST chạy) là ghế họ đang tự giữ hiện ra như ghế người khác giữ.
 */
@ExtendWith(MockitoExtension.class)
class TripServiceSeatMapTest {

    private static final Long TRIP_ID = 1L;
    private static final Long VEHICLE_ID = 7L;
    private static final Long SEAT_ID = 42L;
    private static final String EMAIL = "khach@example.com";
    private static final String IDENTITY = SeatIdentity.ofUser(EMAIL);

    @Mock
    private TripRepository tripRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private TripMapper tripMapper;
    @Mock
    private com.booking.api.realtime.SeatStatusBroadcaster broadcaster;

    // Dùng bản thật chứ không mock: điều cần khoá lại là chuỗi REST trả ra khớp ĐÚNG chuỗi
    // WebSocket phát ra, mà cả hai đều đi qua lớp này. Mock đi thì test vẫn xanh kể cả khi
    // hai đường lại lệch nhau lần nữa.
    private final SeatOwnerTokenService ownerTokenService =
            new SeatOwnerTokenService("dGhpcy1pcy1hLXRlc3Qtc2VjcmV0LWtleS0zMi1ieXRlcy1sb25nIQ==");

    private SeatLockService seatLockService;
    private TripService tripService;

    @BeforeEach
    void setUp() {
        seatLockService = new SeatLockService(broadcaster);
        tripService = new TripService(tripRepository, seatRepository, ticketRepository,
                tripMapper, seatLockService, ownerTokenService);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(VEHICLE_ID);
        Trip trip = new Trip();
        trip.setId(TRIP_ID);
        trip.setVehicle(vehicle);

        Seat seat = new Seat();
        seat.setId(SEAT_ID);
        seat.setSeatNumber("A1");
        seat.setSeatType("ECONOMY");

        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(seatRepository.findByVehicleId(VEHICLE_ID)).thenReturn(List.of(seat));
        when(ticketRepository.existsByTripIdAndSeatId(TRIP_ID, SEAT_ID)).thenReturn(false);
    }

    private SeatResponse onlySeat() {
        List<SeatResponse> seats = tripService.getSeatsForTrip(TRIP_ID);
        assertEquals(1, seats.size());
        return seats.get(0);
    }

    @Test
    @DisplayName("Ghế đang bị giữ: trả mã ẩn danh khớp với mã phát qua WebSocket, không phải danh tính thô")
    void getSeatsForTrip_TraMaAnDanh_KhopVoiWebSocket() {
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, IDENTITY);

        String tempLockedBy = onlySeat().getTempLockedBy();

        // Đây là điều kiện thật sự cần: giao diện lấy ownerToken từ /app/whoami rồi so bằng
        // với chuỗi này. Khớp thì ghế của mình hiện đúng là của mình sau khi tải lại trang.
        assertEquals(ownerTokenService.tokenFor(IDENTITY), tempLockedBy);
    }

    @Test
    @DisplayName("Không rò email hay khoá thiết bị qua endpoint sơ đồ ghế công khai")
    void getSeatsForTrip_KhongRoDanhTinh() {
        seatLockService.lockSeat(TRIP_ID, SEAT_ID, IDENTITY);

        String tempLockedBy = onlySeat().getTempLockedBy();

        assertNotNull(tempLockedBy);
        assertFalse(tempLockedBy.contains(EMAIL), "email không được lọt ra ngoài");
        assertFalse(tempLockedBy.startsWith(SeatIdentity.USER_PREFIX), "danh tính thô không được lọt ra ngoài");
        assertFalse(tempLockedBy.startsWith(SeatIdentity.GUEST_PREFIX), "khoá thiết bị không được lọt ra ngoài");
    }

    @Test
    @DisplayName("Ghế trống thì không có chủ")
    void getSeatsForTrip_GheTrong_KhongCoChu() {
        assertNull(onlySeat().getTempLockedBy());
    }
}
