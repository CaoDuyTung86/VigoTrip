package com.booking.api.catalog;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Lịch nhu cầu là thứ làm cho dữ liệu seed có hình dạng của mùa vụ. Nếu nó phẳng thì biểu đồ
 * doanh thu bên màn Thống kê cũng phẳng, và phần nhận định của AI không có gì để nói.
 */
class DemandCalendarTest {

    @Test
    @DisplayName("Tết đắt hơn ngày thường cùng thứ trong tuần")
    void tetDatHonNgayThuong() {
        // 17/02/2026 là mùng 1 Tết Bính Ngọ và rơi vào thứ ba; 10/03/2026 cũng là thứ ba.
        LocalDate tet = LocalDate.of(2026, 2, 17);
        LocalDate ngayThuong = LocalDate.of(2026, 3, 10);

        assertEquals(tet.getDayOfWeek(), ngayThuong.getDayOfWeek(), "Phải so hai ngày cùng thứ");
        assertTrue(DemandCalendar.factorFor(tet) > DemandCalendar.factorFor(ngayThuong),
                "Cao điểm Tết mà không đắt hơn ngày thường thì lịch nhu cầu vô nghĩa");
        assertEquals("Tết Bính Ngọ", DemandCalendar.peakLabel(tet));
    }

    @Test
    @DisplayName("Cuối tuần đắt hơn giữa tuần")
    void cuoiTuanDatHonGiuaTuan() {
        LocalDate chuNhat = LocalDate.of(2026, 3, 15);
        LocalDate thuTu = LocalDate.of(2026, 3, 11);

        assertTrue(DemandCalendar.dayOfWeekFactor(chuNhat) > DemandCalendar.dayOfWeekFactor(thuTu));
    }

    @Test
    @DisplayName("Hè cao điểm, tháng 9 - 10 thấp điểm")
    void muaVuTheoThang() {
        double he = DemandCalendar.seasonFactor(LocalDate.of(2026, 7, 8));
        double thuong = DemandCalendar.seasonFactor(LocalDate.of(2026, 11, 4));
        double thapDiem = DemandCalendar.seasonFactor(LocalDate.of(2026, 10, 7));

        assertTrue(he > thuong, "Hè phải cao hơn ngày thường");
        assertTrue(thapDiem < thuong, "Sau hè phải thấp hơn ngày thường");
    }

    @Test
    @DisplayName("Mấy dịp lễ ngày dương được nhận ra ở mọi năm")
    void leNgayDuongLapLaiHangNam() {
        assertEquals("30/4 - 1/5", DemandCalendar.peakLabel(LocalDate.of(2026, 4, 30)));
        assertEquals("30/4 - 1/5", DemandCalendar.peakLabel(LocalDate.of(2031, 4, 30)));
        assertEquals("Quốc khánh 2/9", DemandCalendar.peakLabel(LocalDate.of(2029, 9, 2)));
    }

    @Test
    @DisplayName("Hết bảng lịch âm thì mất cao điểm Tết chứ không vỡ")
    void ngoaiTamBangLichAmVanChay() {
        // Tết 2035 không có trong bảng. Chấp nhận mất một đỉnh, miễn là vẫn trả về một hệ số hợp lệ.
        double heSo = DemandCalendar.factorFor(LocalDate.of(2035, 2, 8));

        assertTrue(heSo > 0.5 && heSo < 2.0, "Hệ số phải nằm trong khoảng dùng được, đang là " + heSo);
    }
}
