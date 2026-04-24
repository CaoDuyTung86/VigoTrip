package com.booking.api.mapper;

import com.booking.api.dto.AdminDTO.*;
import com.booking.api.entity.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface AdminMapper {

    Route toEntity(RouteRequest request);
    void updateEntity(RouteRequest request, @MappingTarget Route route);

    Provider toEntity(ProviderRequest request);
    void updateEntity(ProviderRequest request, @MappingTarget Provider provider);

    @Mapping(target = "provider", ignore = true)
    Vehicle toEntity(VehicleRequest request);
    void updateEntity(VehicleRequest request, @MappingTarget Vehicle vehicle);

    @Mapping(target = "route", ignore = true)
    @Mapping(target = "vehicle", ignore = true)
    Trip toEntity(TripRequest request);
    void updateEntity(TripRequest request, @MappingTarget Trip trip);
}
