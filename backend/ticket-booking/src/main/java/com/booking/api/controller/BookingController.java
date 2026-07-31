package com.booking.api.controller;

import com.booking.api.dto.BookingRequest;
import com.booking.api.dto.BookingResponse;
import com.booking.api.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody BookingRequest request) {
        BookingResponse response = bookingService.createBooking(userDetails.getUsername(), request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getMyBookings(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<BookingResponse> responses = bookingService.getMyBookings(userDetails.getUsername());
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBookingDetail(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        BookingResponse response = bookingService.getBookingDetail(userDetails.getUsername(), id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        BookingResponse response = bookingService.cancelBooking(userDetails.getUsername(), id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<BookingResponse> completeBooking(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        BookingResponse response = bookingService.completeBooking(userDetails.getUsername(), id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{bookingId}/tickets/{ticketId}/cancel")
    public ResponseEntity<BookingResponse> cancelTicket(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long bookingId,
            @PathVariable Long ticketId) {
        BookingResponse response = bookingService.cancelTicket(userDetails.getUsername(), bookingId, ticketId);
        return ResponseEntity.ok(response);
    }

    /**
     * Check-in vé — CHỈ ADMIN hoặc PROVIDER (nhân viên soát vé) được phép.
     * User thường KHÔNG thể tự check-in vé của mình.
     */
    @PostMapping("/{id}/check-in")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ADMIN', 'ROLE_PROVIDER', 'PROVIDER')")
    public ResponseEntity<BookingResponse> checkIn(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        String performedBy = userDetails.getUsername();
        BookingResponse response = bookingService.checkIn(id, performedBy);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent-checkins")
    public ResponseEntity<List<BookingResponse>> getRecentCheckIns(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<BookingResponse> responses = bookingService.getRecentCheckIns(userDetails.getUsername());
        return ResponseEntity.ok(responses);
    }
}
