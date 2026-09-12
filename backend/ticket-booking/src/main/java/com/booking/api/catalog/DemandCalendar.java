package com.booking.api.catalog;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;

/**
 * Lịch nhu cầu đi lại: một ngày bất kỳ đắt hay rẻ hơn ngày thường bao nhiêu.
 *
 * <p>Đây là chỗ duy nhất biết "cao điểm" nghĩa là gì. Tách khỏi {@code TripSupplyService} vì nó
 * là dữ liệu tham chiếu về đời thật chứ không phải logic sinh chuyến: cùng một lịch này về sau
 * còn dùng được cho phần phân tích của màn Thống kê và cho khuyến nghị của chatbot.
 *
 * <p><b>Hệ số từ đâu ra.</b> Không có API nào cho không mùa vụ vé nội địa, nên các con số dưới
 * đây là hiệu chỉnh tay theo quy luật ai cũng quan sát được: đi chơi cuối tuần, về quê dịp lễ,
 * hè là mùa du lịch, tháng 9 - 10 là mùa thấp điểm. Chúng KHÔNG phải số đo thực tế và không nên
 * được trình bày như số đo thực tế; giá trị của chúng là làm dữ liệu seed có hình dạng của mùa
 * vụ thay vì phẳng lì hoặc ngẫu nhiên đều.
 *
 * <p><b>Vì sao lịch lễ phải gõ tay từng năm.</b> Tết và Giỗ Tổ là ngày âm lịch, không suy ra
 * được từ ngày dương nếu không kéo thêm một thư viện lịch âm. Với một dự án đã chốt mốc dừng
 * hỗ trợ, thêm phụ thuộc chỉ để biết Tết rơi vào đâu là không đáng. Đổi lại phải nhớ: hết bảng
 * là hết cao điểm Tết, và khi đó hệ thống vẫn chạy đúng, chỉ mất phần mùa vụ.
 */
public final class DemandCalendar {

    /**
     * Một khoảng cao điểm có ngày tháng cụ thể.
     *
     * @param from   ngày đầu, tính cả
     * @param to     ngày cuối, tính cả
     * @param factor hệ số nhân vào giá
     * @param label  để đọc log và để biết dòng này nói về dịp gì
     */
    private record Window(LocalDate from, LocalDate to, double factor, String label) {
        boolean covers(LocalDate date) {
            return !date.isBefore(from) && !date.isAfter(to);
        }
    }

    /**
     * Cao điểm theo ngày âm lịch, chép từ lịch đã công bố.
     *
     * <p>Mùng 1 Tết Bính Ngọ là 17/02/2026, mùng 1 Tết Đinh Mùi là 06/02/2027. Cửa sổ lấy rộng
     * hơn kỳ nghỉ vì đợt đi lại bắt đầu trước Tết cả tuần và kéo dài sau Tết.
     *
     * <p>Chưa khai Giỗ Tổ Hùng Vương (10/3 âm lịch) vì đó cũng là ngày âm và mỗi năm một khác;
     * thiếu nó chỉ làm mất một đỉnh nhỏ chứ không sai cái gì.
     */
    private static final List<Window> LUNAR_WINDOWS = List.of(
            new Window(LocalDate.of(2026, 2, 11), LocalDate.of(2026, 2, 24), 1.35, "Tết Bính Ngọ"),
            new Window(LocalDate.of(2027, 1, 31), LocalDate.of(2027, 2, 13), 1.35, "Tết Đinh Mùi"));

    /**
     * Cao điểm rơi đúng ngày dương hằng năm, nên khai một lần dùng mãi.
     *
     * <p>30/04 - 01/05 và 02/09 là kỳ nghỉ lễ dài nhất sau Tết; 01/01 ngắn hơn nên hệ số thấp hơn.
     */
    private record AnnualWindow(MonthDay from, MonthDay to, double factor, String label) {
        boolean covers(LocalDate date) {
            MonthDay md = MonthDay.from(date);
            return md.compareTo(from) >= 0 && md.compareTo(to) <= 0;
        }
    }

    private static final List<AnnualWindow> ANNUAL_WINDOWS = List.of(
            new AnnualWindow(MonthDay.of(12, 30), MonthDay.of(12, 31), 1.15, "Nghỉ Tết dương"),
            new AnnualWindow(MonthDay.of(1, 1), MonthDay.of(1, 2), 1.15, "Tết dương lịch"),
            new AnnualWindow(MonthDay.of(4, 28), MonthDay.of(5, 3), 1.28, "30/4 - 1/5"),
            new AnnualWindow(MonthDay.of(8, 31), MonthDay.of(9, 3), 1.22, "Quốc khánh 2/9"),
            new AnnualWindow(MonthDay.of(6, 1), MonthDay.of(8, 15), 1.12, "Cao điểm hè"),
            new AnnualWindow(MonthDay.of(9, 15), MonthDay.of(10, 31), 0.93, "Thấp điểm sau hè"));

    private DemandCalendar() {
    }

    /** Hệ số nhân cuối cùng cho một ngày khởi hành: mùa vụ nhân với thứ trong tuần. */
    public static double factorFor(LocalDate date) {
        return seasonFactor(date) * dayOfWeekFactor(date);
    }

    /**
     * Phần mùa vụ. Dịp âm lịch được xét trước và thắng, vì Tết có năm rơi vào tháng 1 có năm
     * rơi vào tháng 2 nên rất dễ đè lên một cửa sổ dương lịch khác.
     */
    public static double seasonFactor(LocalDate date) {
        for (Window window : LUNAR_WINDOWS) {
            if (window.covers(date)) {
                return window.factor();
            }
        }
        for (AnnualWindow window : ANNUAL_WINDOWS) {
            if (window.covers(date)) {
                return window.factor();
            }
        }
        return 1.0;
    }

    /**
     * Phần thứ trong tuần. Chiều đi dồn vào thứ sáu, chiều về dồn vào chủ nhật, còn thứ ba và
     * thứ tư là hai ngày rẻ nhất tuần.
     */
    public static double dayOfWeekFactor(LocalDate date) {
        return switch (date.getDayOfWeek()) {
            case FRIDAY -> 1.15;
            case SUNDAY -> 1.18;
            case SATURDAY -> 1.10;
            case MONDAY -> 1.05;
            case THURSDAY -> 0.97;
            case TUESDAY, WEDNESDAY -> 0.92;
        };
    }

    /** Tên dịp cao điểm của một ngày, rỗng nếu là ngày thường. Chỉ dùng để log và kiểm thử. */
    public static String peakLabel(LocalDate date) {
        for (Window window : LUNAR_WINDOWS) {
            if (window.covers(date)) {
                return window.label();
            }
        }
        for (AnnualWindow window : ANNUAL_WINDOWS) {
            if (window.covers(date)) {
                return window.label();
            }
        }
        return "";
    }
}
