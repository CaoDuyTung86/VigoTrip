package com.booking.api.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "tuyen_duong", indexes = {
    @Index(name = "idx_route_origin", columnList = "origin"),
    @Index(name = "idx_route_destination", columnList = "destination"),
    @Index(name = "idx_route_origin_destination", columnList = "origin, destination")
})
@JsonIgnoreProperties({"trips"})
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "route_id")
    private Long id;

    @Column(name = "origin", nullable = false)
    private String origin;

    @Column(name = "destination", nullable = false)
    private String destination;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Trip> trips;
}
