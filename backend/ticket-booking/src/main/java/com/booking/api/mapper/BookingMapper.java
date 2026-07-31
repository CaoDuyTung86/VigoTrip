package com.booking.api.mapper;

import com.booking.api.dto.BookingResponse;
import com.booking.api.entity.AdditionalService;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Ticket;
import com.booking.api.entity.Trip;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.math.BigDecimal;
import java.util.List;

@Mapper(componentModel = "spring")
public interface BookingMapper {

    @Mapping(target = "id", source = "booking.id")
    @Mapping(target = "bookingDate", source = "booking.bookingDate")
    @Mapping(target = "totalPrice", source = "booking.totalPrice")
    @Mapping(target = "status", source = "booking.status")
    @Mapping(target = "origin", source = "trip.route.origin")
    @Mapping(target = "destination", source = "trip.route.destination")
    @Mapping(target = "departureTime", source = "trip.departureTime")
    @Mapping(target = "arrivalTime", source = "trip.arrivalTime")
    @Mapping(target = "vehicleType", source = "trip.vehicle.vehicleType")
    @Mapping(target = "providerName", source = "trip.vehicle.provider.providerName")
    @Mapping(target = "seatNumbers", source = "booking.tickets", qualifiedByName = "ticketsToSeatNumbers")
    @Mapping(target = "ticketDetails", source = "booking.tickets", qualifiedByName = "ticketsToDetails")
    @Mapping(target = "additionalServices", source = "booking.additionalServices", qualifiedByName = "servicesToNames")
    @Mapping(target = "refundAmount", source = "booking.refunds", qualifiedByName = "calculateRefundAmount")
    @Mapping(target = "refundStatus", source = "booking.refunds", qualifiedByName = "getRefundStatus")
    @Mapping(target = "isCheckedIn", source = "booking.isCheckedIn")
    @Mapping(target = "checkInDate", source = "booking.checkInDate")
    BookingResponse toBookingResponse(Booking booking, Trip trip);

    @Named("ticketsToSeatNumbers")
    default List<String> ticketsToSeatNumbers(List<Ticket> tickets) {
        if (tickets == null)
            return null;
        return tickets.stream()
                .map(t -> t.getSeat().getSeatNumber())
                .toList();
    }

    @Named("ticketsToDetails")
    default List<BookingResponse.TicketDetail> ticketsToDetails(List<Ticket> tickets) {
        if (tickets == null)
            return null;
        return tickets.stream()
                .map(t -> new BookingResponse.TicketDetail(
                        t.getId(),
                        t.getPassengerName(),
                        t.getSeat().getSeatNumber(),
                        t.getSeat().getSeatType(),
                        t.getPrice(),
                        t.getStatus() != null ? t.getStatus() : "ACTIVE"
                ))
                .toList();
    }

    @Named("servicesToNames")
    default List<String> servicesToNames(List<AdditionalService> services) {
        if (services == null) {
            return null;
        }
        return services.stream()
                .map(AdditionalService::getServiceName)
                .toList();
    }

    @Named("calculateRefundAmount")
    default BigDecimal calculateRefundAmount(List<com.booking.api.entity.Refund> refunds) {
        if (refunds == null || refunds.isEmpty()) return null;
        return refunds.stream()
                .filter(r -> "APPROVED".equals(r.getStatus()) || "COMPLETED".equals(r.getStatus()))
                .map(r -> r.getRefundAmount() != null ? r.getRefundAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Named("getRefundStatus")
    default String getRefundStatus(List<com.booking.api.entity.Refund> refunds) {
        if (refunds == null || refunds.isEmpty()) return null;
        // Return the most recent refund status
        return refunds.stream()
                .sorted((a, b) -> {
                    if (a.getRequestedAt() == null && b.getRequestedAt() == null) return 0;
                    if (a.getRequestedAt() == null) return 1;
                    if (b.getRequestedAt() == null) return -1;
                    return b.getRequestedAt().compareTo(a.getRequestedAt());
                })
                .findFirst()
                .map(com.booking.api.entity.Refund::getStatus)
                .orElse(null);
    }
}
