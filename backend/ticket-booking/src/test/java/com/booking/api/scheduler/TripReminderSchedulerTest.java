package com.booking.api.scheduler;

import com.booking.api.entity.Booking;
import com.booking.api.entity.Route;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import com.booking.api.entity.User;
import com.booking.api.repository.BookingRepository;
import com.booking.api.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Nhắc lịch khởi hành")
class TripReminderSchedulerTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private TripReminderScheduler scheduler;

    private Booking booking;

    @BeforeEach
    void setUp() {
        Route route = new Route();
        route.setOrigin("HAN");
        route.setDestination("CXR");

        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setDepartureTime(LocalDateTime.now().plusHours(6));

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);

        User user = new User();
        user.setEmail("khach@example.com");

        booking = new Booking();
        booking.setId(52L);
        booking.setUser(user);
        booking.setStatus("CONFIRMED");
        booking.setTickets(List.of(ticket));

        when(bookingRepository.findConfirmedBookingsForReminder(any(), any()))
                .thenReturn(List.of(booking));
    }

    @Test
    @DisplayName("Giành được cờ thì gửi mail nhắc")
    void sendsReminderWhenClaimSucceeds() {
        when(bookingRepository.claimReminder(52L)).thenReturn(1);

        scheduler.sendTripReminders();

        verify(emailService).sendTripReminderEmail(
                eq("khach@example.com"), eq(52L), eq("HAN → CXR"), anyString(), any());
    }

    /**
     * Đây là cái chốt chống gửi trùng: hai lượt quét cùng nhìn thấy một đơn (hai instance
     * backend, hoặc lượt chạy ngay sau khi deploy lại chồng lên lượt trước) thì chỉ lượt
     * nào UPDATE được cờ mới gửi. Lượt trượt phải im lặng đi qua.
     */
    @Test
    @DisplayName("Không giành được cờ thì bỏ qua, không gửi mail lần hai")
    void skipsReminderWhenAlreadyClaimed() {
        when(bookingRepository.claimReminder(52L)).thenReturn(0);

        scheduler.sendTripReminders();

        verify(emailService, never()).sendTripReminderEmail(anyString(), anyLong(), anyString(), anyString(), any());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("Xếp mail vào hàng đợi hỏng thì trả cờ lại cho lượt quét sau")
    void releasesClaimWhenQueueingFails() {
        when(bookingRepository.claimReminder(52L)).thenReturn(1);
        org.mockito.Mockito.doThrow(new java.util.concurrent.RejectedExecutionException("pool đầy"))
                .when(emailService).sendTripReminderEmail(anyString(), anyLong(), anyString(), anyString(), any());

        scheduler.sendTripReminders();

        verify(bookingRepository, times(1)).save(booking);
        org.junit.jupiter.api.Assertions.assertEquals(Boolean.FALSE, booking.getReminderSent());
    }

    @Test
    @DisplayName("Tài khoản đã tắt thư nhắc thì không gửi, và không giành cờ để bật lại vẫn kịp")
    void skipsAccountsThatTurnedRemindersOff() {
        booking.getUser().setTripReminderOptIn(false);

        scheduler.sendTripReminders();

        verify(bookingRepository, never()).claimReminder(anyLong());
        verify(emailService, never()).sendTripReminderEmail(anyString(), anyLong(), anyString(), anyString(), any());
    }
}
