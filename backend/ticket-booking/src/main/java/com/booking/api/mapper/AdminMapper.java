package com.booking.api.mapper;

import com.booking.api.dto.AdminDTO.*;
import com.booking.api.entity.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface AdminMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "currentUsage", ignore = true)
    @Mapping(target = "provider", ignore = true)
    Voucher toEntity(VoucherRequest request);

    /**
     * Tin nhập tay cho dải tin chạy. Trường {@code kind} là chuỗi trong request và enum trong
     * entity — MapStruct tự sinh phép chuyển, giá trị lạ sẽ bị chặn ngay ở lớp này thay vì
     * chui xuống CSDL thành một loại tin mà giao diện không biết vẽ ra sao.
     */
    @Mapping(target = "id", ignore = true)
    Announcement toEntity(AnnouncementRequest request);

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
