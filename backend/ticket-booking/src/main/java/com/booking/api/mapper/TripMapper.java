package com.booking.api.mapper;

import com.booking.api.dto.TripSearchResponse;
import com.booking.api.entity.Trip;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface TripMapper {

    @Mapping(target = "origin", source = "route.origin")
    @Mapping(target = "destination", source = "route.destination")
    @Mapping(target = "vehicleType", source = "vehicle.vehicleType")
    @Mapping(target = "providerId", source = "vehicle.provider.id")
    @Mapping(target = "providerName", source = "vehicle.provider.providerName")
    @Mapping(target = "totalSeats", ignore = true)
    @Mapping(target = "availableSeats", ignore = true)
    TripSearchResponse toTripSearchResponse(Trip trip);
}
