package com.booking.api.enums;

import java.time.LocalDate;

/**
 * Kỳ báo cáo cho phần AI BI.
 *
 * Trước đây tầng phân tích chỉ nhận rời rạc `year` + `month`, và chỉ mỗi biểu đồ doanh thu
 * theo tháng là thực sự lọc theo hai tham số đó — top tuyến, doanh thu theo loại phương
 * tiện, top nhà cung cấp và số booking đều lấy ALL-TIME. Kết quả là báo cáo mở đầu bằng
 * "BÁO CÁO (Tháng 8/2026)" nhưng phần thân là số liệu từ đầu hệ thống, nên AI kết luận sai.
 *
 * Gom về một khái niệm kỳ duy nhất: mọi truy vấn nhận đúng một khoảng nửa mở
 * [start, endExclusive) tính từ đây, không chỗ nào tự diễn giải thời gian nữa.
 */
public enum ReportPeriod {

    MONTH,
    QUARTER,
    YEAR;

    /** Ngày đầu kỳ chứa {@code anchor}. */
    public LocalDate startOf(LocalDate anchor) {
        return switch (this) {
            case MONTH -> anchor.withDayOfMonth(1);
            case QUARTER -> anchor.withDayOfMonth(1).withMonth(firstMonthOfQuarter(anchor));
            case YEAR -> anchor.withDayOfYear(1);
        };
    }

    /** Ngày đầu kỳ KẾ TIẾP — dùng làm mốc kết thúc kiểu nửa mở, tránh lệch mili giây cuối ngày. */
    public LocalDate endExclusiveOf(LocalDate anchor) {
        LocalDate start = startOf(anchor);
        return switch (this) {
            case MONTH -> start.plusMonths(1);
            case QUARTER -> start.plusMonths(3);
            case YEAR -> start.plusYears(1);
        };
    }

    /** Ngày cuối cùng NẰM TRONG kỳ — chỉ để hiển thị, không dùng để truy vấn. */
    public LocalDate lastDayOf(LocalDate anchor) {
        return endExclusiveOf(anchor).minusDays(1);
    }

    /** Một ngày bất kỳ thuộc kỳ liền trước, dùng để so sánh tăng trưởng. */
    public LocalDate previousAnchor(LocalDate anchor) {
        return startOf(anchor).minusDays(1);
    }

    /** Một ngày bất kỳ thuộc kỳ liền sau. */
    public LocalDate nextAnchor(LocalDate anchor) {
        return endExclusiveOf(anchor);
    }

    public String label(LocalDate anchor) {
        LocalDate start = startOf(anchor);
        return switch (this) {
            case MONTH -> String.format("Tháng %d/%d", start.getMonthValue(), start.getYear());
            case QUARTER -> String.format("Quý %d/%d", quarterOf(start), start.getYear());
            case YEAR -> String.format("Năm %d", start.getYear());
        };
    }

    /**
     * Độ mịn của biểu đồ xu hướng trong kỳ: kỳ tháng vẽ theo NGÀY, kỳ quý và năm vẽ theo THÁNG.
     * Vẽ 365 cột cho một năm thì không đọc được, còn gộp cả tháng thành một cột thì kỳ tháng
     * chỉ còn đúng một cột.
     */
    public TrendBucket trendBucket() {
        return this == MONTH ? TrendBucket.DAY : TrendBucket.MONTH;
    }

    public enum TrendBucket {
        DAY,
        MONTH
    }

    public static int quarterOf(LocalDate date) {
        return ((date.getMonthValue() - 1) / 3) + 1;
    }

    private static int firstMonthOfQuarter(LocalDate date) {
        return ((quarterOf(date) - 1) * 3) + 1;
    }
}
