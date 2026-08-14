package com.booking.api.service;

import com.booking.api.dto.SeatResponse;
import com.booking.api.dto.TripCalendarPriceResponse;
import com.booking.api.dto.TripSearchResponse;
import com.booking.api.entity.Seat;
import com.booking.api.entity.Trip;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.mapper.TripMapper;
import com.booking.api.repository.SeatRepository;
import com.booking.api.repository.TicketRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.service.SeatLockService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TripService {

        private final TripRepository tripRepository;
        private final SeatRepository seatRepository;
        private final TicketRepository ticketRepository;
        private final TripMapper tripMapper;
        private final SeatLockService seatLockService;

        @Transactional(readOnly = true)
        @Cacheable(value = "trips", key = "#from + #to + #date.toString() + #type + #passengers")
        public List<TripSearchResponse> searchTrips(String from,
                        String to,
                        LocalDate date,
                        String type,
                        Integer passengers) {
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime startOfDay = date.atStartOfDay();
                if (date.equals(now.toLocalDate()) && startOfDay.isBefore(now)) {
                        startOfDay = now;
                }
                LocalDateTime endOfDay = date.plusDays(1).atStartOfDay().minusNanos(1);

                String vehicleType = (type == null || type.isBlank()) ? null : type;

                List<Trip> trips = tripRepository.searchTrips(from, to, startOfDay, endOfDay, vehicleType);

                return trips.stream()
                                .filter(trip -> !trip.getDepartureTime().isBefore(now))
                                .map(trip -> {
                        TripSearchResponse response = tripMapper.toTripSearchResponse(trip);

                        int totalSeats = trip.getVehicle().getTotalSeats() != null
                                        ? trip.getVehicle().getTotalSeats()
                                        : 0;
                        long bookedCount = ticketRepository.countByTripId(trip.getId());
                        int availableSeats = Math.max(0, totalSeats - (int) bookedCount);

                        // nếu có tham số passengers thì lọc đủ chỗ
                        if (passengers != null && availableSeats < passengers) {
                                return null;
                        }

                        response.setTotalSeats(totalSeats);
                        response.setAvailableSeats(availableSeats);

                        return response;
                }).filter(java.util.Objects::nonNull).collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<SeatResponse> getSeatsForTrip(Long tripId) {
                Trip trip = tripRepository.findById(tripId)
                                .orElseThrow(() -> new ResourceNotFoundException("Chuyến đi", tripId));

                List<Seat> seats = seatRepository.findByVehicleId(trip.getVehicle().getId());

                return seats.stream()
                                .map(seat -> {
                                        boolean booked = ticketRepository.existsByTripIdAndSeatId(tripId, seat.getId());
                                        String tempLockedBy = seatLockService.getLockedBy(seat.getId());
                                        return new SeatResponse(
                                                         seat.getId(),
                                                         seat.getSeatNumber(),
                                                         seat.getSeatType(),
                                                         booked,
                                                         tempLockedBy);
                                })
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public TripSearchResponse getTripDetail(Long tripId) {
                Trip trip = tripRepository.findById(tripId)
                                .orElseThrow(() -> new ResourceNotFoundException("Chuyến đi", tripId));

                TripSearchResponse response = tripMapper.toTripSearchResponse(trip);

                int totalSeats = trip.getVehicle().getTotalSeats() != null
                                ? trip.getVehicle().getTotalSeats()
                                : 0;
                long bookedCount = ticketRepository.countByTripId(trip.getId());
                int availableSeats = Math.max(0, totalSeats - (int) bookedCount);

                response.setTotalSeats(totalSeats);
                response.setAvailableSeats(availableSeats);

                return response;
        }

        @Transactional(readOnly = true)
        @Cacheable(value = "calendar_prices", key = "#from + #to + #start.toString() + #end.toString() + #type + #passengers")
        public List<TripCalendarPriceResponse> getCalendarPrices(String from,
                        String to,
                        LocalDate start,
                        LocalDate end,
                        String type,
                        Integer passengers) {
                if (end.isBefore(start)) {
                        throw new IllegalArgumentException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu");
                }

                LocalDateTime now = LocalDateTime.now();
                LocalDateTime startTime = start.atStartOfDay();
                if (start.equals(now.toLocalDate()) && startTime.isBefore(now)) {
                        startTime = now;
                }
                LocalDateTime endTime = end.plusDays(1).atStartOfDay().minusNanos(1);

                String vehicleType = (type == null || type.isBlank()) ? null : type;
                List<Trip> trips = tripRepository.searchTrips(from, to, startTime, endTime, vehicleType);

                Map<LocalDate, java.math.BigDecimal> minPriceByDate = trips.stream()
                                .filter(trip -> !trip.getDepartureTime().isBefore(now))
                                .filter(trip -> {
                                        if (passengers == null) {
                                                return true;
                                        }
                                        int totalSeats = trip.getVehicle().getTotalSeats() != null
                                                        ? trip.getVehicle().getTotalSeats()
                                                        : 0;
                                        long bookedCount = ticketRepository.countByTripId(trip.getId());
                                        int availableSeats = Math.max(0, totalSeats - (int) bookedCount);
                                        return availableSeats >= passengers;
                                })
                                .collect(Collectors.groupingBy(
                                                t -> t.getDepartureTime().toLocalDate(),
                                                Collectors.reducing(
                                                                null,
                                                                Trip::getPrice,
                                                                (a, b) -> {
                                                                        if (a == null) return b;
                                                                        if (b == null) return a;
                                                                        return a.compareTo(b) <= 0 ? a : b;
                                                                })));

                return start.datesUntil(end.plusDays(1))
                                .map(d -> {
                                        java.math.BigDecimal minPrice = minPriceByDate.get(d);
                                        return new TripCalendarPriceResponse(d, minPrice, minPrice != null);
                                })
                                .collect(Collectors.toList());
        }
}
