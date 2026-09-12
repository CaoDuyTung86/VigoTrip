package com.booking.api.catalog;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tra địa điểm theo TÊN là cửa duy nhất giữa câu chat của khách và dữ liệu thật.
 *
 * <p>Khách gõ "Đà Nẵng" chứ không gõ {@code DAD}, nên trước đây mọi thứ nhận đầu vào từ người
 * dùng đều phải nhờ model đổi hộ tên sang mã. Chỗ đó đã trượt một lần rồi: mô tả công cụ dạy
 * model rằng {@code QNH} là Quy Nhơn, trong khi {@code QNH} là Quảng Ninh — khách hỏi thời tiết
 * Quy Nhơn thì nhận về nhiệt độ Hạ Long, cách nhau hơn tám trăm cây số và không có gì trên màn
 * hình cho thấy là sai.
 */
class PlaceCatalogNameLookupTest {

    @Test
    @DisplayName("Tra được theo tên tiếng Việt, có dấu hay không dấu, dính hay rời")
    void traDuocTheoTenTiengViet() {
        // Người Việt gõ không dấu rất phổ biến, và gõ dính hay gõ rời là tuỳ người.
        for (String cachViet : new String[] { "Đà Nẵng", "đà nẵng", "da nang", "Danang", "DANANG" }) {
            assertEquals("DAD", PlaceCatalog.resolveCode(cachViet).orElseThrow(), cachViet);
        }
        assertEquals("HAN", PlaceCatalog.resolveCode("Hà Nội").orElseThrow());
        assertEquals("HAN", PlaceCatalog.resolveCode("ha noi").orElseThrow());
    }

    @Test
    @DisplayName("Tên gọi khác cũng ra đúng nơi")
    void tenGoiKhacCungRaDungNoi() {
        // Gần như không ai gõ đủ "TP. Hồ Chí Minh".
        for (String cachGoi : new String[] { "Sài Gòn", "saigon", "TPHCM", "HCM", "Ho Chi Minh" }) {
            assertEquals("SGN", PlaceCatalog.resolveCode(cachGoi).orElseThrow(), cachGoi);
        }
    }

    @Test
    @DisplayName("QNH là Quảng Ninh chứ không phải Quy Nhơn")
    void qnhLaQuangNinh() {
        // Giao diện đặt vé gọi QNH là "Quảng Ninh", toạ độ trong danh mục là Hạ Long: hai tên của
        // cùng một nơi thì phải cùng tra ra một chỗ.
        assertEquals("QNH", PlaceCatalog.resolveCode("Quảng Ninh").orElseThrow());
        assertEquals("QNH", PlaceCatalog.resolveCode("Hạ Long").orElseThrow());

        // Còn Quy Nhơn thì hệ thống chưa có tuyến nào tới, nên phải trả rỗng để nơi gọi nói thẳng
        // là chưa hỗ trợ — chứ không được lặng lẽ đưa khách sang một tỉnh khác.
        assertTrue(PlaceCatalog.resolveCode("Quy Nhơn").isEmpty(),
                "Chưa hỗ trợ Quy Nhơn thì phải nói là chưa hỗ trợ");
    }

    @Test
    @DisplayName("Mã điểm vẫn tra được qua cùng một cửa")
    void maDiemVanTraDuoc() {
        // Nơi gọi không biết trước mình đang cầm tên hay mã, nên một cửa phải nhận cả hai.
        assertEquals("DAD", PlaceCatalog.resolveCode("DAD").orElseThrow());
        assertEquals("HUE", PlaceCatalog.resolveCode("hue").orElseThrow());
    }

    @Test
    @DisplayName("Chữ 'sân bay', 'ga', 'bến xe' đứng trước tên thì bỏ qua")
    void boQuaChuChiLoaiCongTrinh() {
        assertEquals("DAD", PlaceCatalog.resolveCode("sân bay Đà Nẵng").orElseThrow());
        assertEquals("HUI", PlaceCatalog.resolveCode("ga Huế").orElseThrow());
        assertEquals("SGN", PlaceCatalog.resolveCode("thành phố Hồ Chí Minh").orElseThrow());
    }

    @Test
    @DisplayName("Nơi không có trong danh mục thì rỗng, không chọn đại nơi gần giống")
    void noiLaThiRong() {
        assertTrue(PlaceCatalog.resolveCode("Tokyo").isEmpty());
        assertTrue(PlaceCatalog.resolveCode("Cà Mau").isEmpty());
        assertTrue(PlaceCatalog.resolveCode("").isEmpty());
        assertTrue(PlaceCatalog.resolveCode(null).isEmpty());
        assertTrue(PlaceCatalog.resolveCode("!!!").isEmpty());
    }

    @Test
    @DisplayName("Hai mã của cùng một thành phố tra theo tên ra cùng một nơi")
    void haiMaCungThanhPhoRaCungMotNoi() {
        PlaceCatalog.Place theoTen = PlaceCatalog.resolve("Huế").orElseThrow();
        assertEquals(PlaceCatalog.find("HUE").orElseThrow().cityId(), theoTen.cityId());
        assertEquals(PlaceCatalog.find("HUI").orElseThrow().cityId(), theoTen.cityId());
    }

    @Test
    @DisplayName("Danh sách tên tiếng Việt đủ để mách lại cho khách")
    void danhSachTenDuDeMachLai() {
        // Câu "chưa hỗ trợ nơi này" mà không kèm danh sách nơi tra được thì khách chỉ biết bỏ cuộc.
        assertTrue(PlaceCatalog.vietnameseNames().contains("Đà Nẵng"));
        assertTrue(PlaceCatalog.vietnameseNames().contains("Hà Nội"));
        // Mỗi nơi đúng một lần, dù nó mang hai mã.
        assertEquals(PlaceCatalog.vietnameseNames().size(),
                PlaceCatalog.vietnameseNames().stream().distinct().count());
    }
}
