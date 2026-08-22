package com.booking.api.repository;

import com.booking.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Tra cứu người dùng theo email, KHÔNG phân biệt hoa/thường.
     *
     * Vì sao viết tay bằng @Query thay vì để Spring Data suy ra từ tên method:
     *  1. Email trên thực tế không phân biệt hoa/thường. Nếu người dùng đăng ký
     *     "Abc@gmail.com" rồi sau đó đăng nhập Google (Google luôn trả "abc@gmail.com"),
     *     phép so sánh "=" của Postgres sẽ không khớp → hệ thống tạo TÀI KHOẢN THỨ HAI.
     *  2. Với những bản ghi trùng đã lỡ sinh ra trước khi có unique constraint,
     *     derived query trả Optional sẽ ném IncorrectResultSizeDataAccessException →
     *     login 500 và mọi request đã xác thực đều 403. ORDER BY + LIMIT 1 giúp hệ thống
     *     vẫn chạy (luôn lấy bản ghi gốc, cũ nhất) trong lúc chờ dọn dữ liệu trùng.
     */
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email) ORDER BY u.id ASC LIMIT 1")
    Optional<User> findByEmail(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    boolean existsByEmail(@Param("email") String email);

    /** Dùng cho tác vụ dọn dẹp / chẩn đoán dữ liệu trùng email. */
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email) ORDER BY u.id ASC")
    List<User> findAllByEmailIgnoreCase(@Param("email") String email);
}
