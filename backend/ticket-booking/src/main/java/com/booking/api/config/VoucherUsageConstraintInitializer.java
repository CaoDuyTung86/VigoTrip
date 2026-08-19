package com.booking.api.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

/**
 * Tạo unique index có lọc trên (user_id, voucher_code) cho các đơn chưa hủy — chốt chặn
 * ở tầng database cho quy tắc "mỗi tài khoản chỉ dùng một mã giảm giá đúng 1 lần".
 *
 * Vì sao cần tới database chứ không chỉ kiểm tra trong service: hai request đặt vé chạy
 * song song đều đọc thấy "chưa dùng mã này" trước khi bất kỳ request nào kịp ghi booking,
 * nên cả hai cùng qua cửa. Chỉ có ràng buộc ở database mới chặn được, vì nó được đánh giá
 * ngay tại thời điểm INSERT.
 *
 * Bắt buộc phải là index CÓ LỌC (filtered/partial), không dùng unique constraint thường:
 *  - Đa số booking không có mã (voucher_code = NULL) mà SQL Server coi các NULL là trùng nhau,
 *    nên unique thường sẽ chỉ cho phép mỗi tài khoản đúng 1 đơn không dùng mã.
 *  - Đơn đã CANCELLED (hủy/hết hạn giữ chỗ) hoặc FAILED (thanh toán hỏng) thì mã được trả
 *    lại cho người dùng, nên phải nằm ngoài phạm vi unique.
 *
 * Chỉ SQL Server và PostgreSQL hỗ trợ cú pháp này. Với database khác (H2 trong test)
 * bước này được bỏ qua — lúc đó chỉ còn lớp kiểm tra ở service.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class VoucherUsageConstraintInitializer {

    public static final String INDEX_NAME = "uq_booking_user_voucher_active";
    private static final String TABLE = "dat_ve";
    // Phải khớp BookingRepository.VOUCHER_RELEASING_STATUSES.
    // Filtered index của SQL Server không cho dùng NOT IN nên phải viết thành các phép <> nối bằng AND.
    private static final String FILTER =
            "voucher_code IS NOT NULL AND status <> 'CANCELLED' AND status <> 'FAILED'";

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    @Bean
    @Order(1)
    CommandLineRunner ensureVoucherUsageConstraint() {
        return args -> {
            String product = detectDatabaseProduct();
            if (product == null) {
                return;
            }

            String existsSql = switch (product) {
                case "MICROSOFT SQL SERVER" -> "SELECT COUNT(*) FROM sys.indexes WHERE name = '" + INDEX_NAME + "'";
                case "POSTGRESQL" -> "SELECT COUNT(*) FROM pg_indexes WHERE indexname = '" + INDEX_NAME + "'";
                default -> null;
            };

            if (existsSql == null) {
                log.warn("Database '{}' không hỗ trợ filtered unique index — bỏ qua {}. "
                        + "Quy tắc mỗi mã dùng 1 lần chỉ còn được kiểm tra ở tầng service.", product, INDEX_NAME);
                return;
            }

            try {
                Integer existing = jdbcTemplate.queryForObject(existsSql, Integer.class);
                if (existing != null && existing > 0) {
                    return;
                }

                List<Map<String, Object>> duplicates = findDuplicates();
                if (!duplicates.isEmpty()) {
                    log.error("Không tạo được {} vì đang có {} cặp (user_id, voucher_code) bị trùng ở các đơn chưa hủy: {}. "
                            + "Cần rà soát và xử lý các đơn này (hủy đơn thừa hoặc xóa mã khỏi đơn) rồi khởi động lại.",
                            INDEX_NAME, duplicates.size(), duplicates);
                    return;
                }

                createIndex(product);
                log.info("Đã tạo {} — mỗi tài khoản chỉ giữ được 1 đơn chưa hủy cho mỗi mã giảm giá.", INDEX_NAME);
            } catch (Exception e) {
                // Không chặn ứng dụng khởi động: lớp kiểm tra ở service vẫn còn tác dụng.
                log.error("Không tạo được {}: {}", INDEX_NAME, e.getMessage());
            }
        };
    }

    /**
     * SQL Server bắt buộc QUOTED_IDENTIFIER phải ON thì mới cho tạo filtered index (lỗi 1934).
     * Driver JDBC vốn đã bật sẵn, nhưng đặt lại ngay trên chính connection chạy CREATE cho chắc.
     */
    private void createIndex(String product) {
        String createSql = "CREATE UNIQUE INDEX " + INDEX_NAME
                + " ON " + TABLE + " (user_id, voucher_code) WHERE " + FILTER;
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (Statement statement = connection.createStatement()) {
                if ("MICROSOFT SQL SERVER".equals(product)) {
                    statement.execute("SET QUOTED_IDENTIFIER ON");
                }
                statement.execute(createSql);
            }
            return null;
        });
    }

    private List<Map<String, Object>> findDuplicates() {
        return jdbcTemplate.queryForList(
                "SELECT user_id, voucher_code, COUNT(*) AS so_don FROM " + TABLE
                        + " WHERE " + FILTER
                        + " GROUP BY user_id, voucher_code HAVING COUNT(*) > 1");
    }

    private String detectDatabaseProduct() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.getMetaData().getDatabaseProductName().toUpperCase();
        } catch (Exception e) {
            log.warn("Không đọc được loại database, bỏ qua việc tạo {}: {}", INDEX_NAME, e.getMessage());
            return null;
        }
    }
}
