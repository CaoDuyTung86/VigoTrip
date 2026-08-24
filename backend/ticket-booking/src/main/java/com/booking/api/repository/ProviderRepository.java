package com.booking.api.repository;

import com.booking.api.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProviderRepository extends JpaRepository<Provider, Long> {

    /** Những thương hiệu do một tài khoản đối tác vận hành. */
    @Query("SELECT p.id FROM Provider p WHERE p.ownerUser.id = :userId")
    List<Long> findIdsByOwnerUserId(@Param("userId") Long userId);

    @Query("SELECT p.providerName FROM Provider p WHERE p.ownerUser.id = :userId ORDER BY p.providerName")
    List<String> findNamesByOwnerUserId(@Param("userId") Long userId);

    @Query("SELECT p.id FROM Provider p")
    List<Long> findAllIds();

    List<Provider> findByProviderNameIn(List<String> providerNames);
}
