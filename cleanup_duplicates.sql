DELETE FROM ve WHERE seat_id IN (
    SELECT seat_id FROM cho_ngoi WHERE vehicle_id NOT IN (
        SELECT MIN(vehicle_id) FROM phuong_tien GROUP BY provider_id, vehicle_type, total_seats
    )
);
DELETE FROM cho_ngoi WHERE vehicle_id NOT IN (
    SELECT MIN(vehicle_id) FROM phuong_tien GROUP BY provider_id, vehicle_type, total_seats
);
DELETE FROM phuong_tien WHERE vehicle_id NOT IN (
    SELECT MIN(vehicle_id) FROM phuong_tien GROUP BY provider_id, vehicle_type, total_seats
);
