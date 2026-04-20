package com.booking.api.mapper;

import com.booking.api.dto.UserResponse;
import com.booking.api.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "membershipLevel", ignore = true)
    @Mapping(target = "discountPercent", ignore = true)
    @Mapping(target = "hasPassword", ignore = true)
    UserResponse toUserResponse(User user);
}
