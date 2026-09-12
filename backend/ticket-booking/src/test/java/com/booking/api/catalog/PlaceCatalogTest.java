package com.booking.api.catalog;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.OptionalDouble;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Danh mục địa điểm là chỗ duy nhất biết hai mã điểm cách nhau bao xa, và cả thời gian chạy lẫn
 * giá của nguồn cung chuyến đều dựng trên đó. Sai một toạ độ là sai theo cả bảng giá, mà sai
 * kiểu đó thì nhìn màn hình không thấy gì bất thường — nên khoá lại bằng test.
 */
class PlaceCatalogTest {

    @Test
    @DisplayName("Hai mã của cùng một thành phố trỏ về cùng một nơi")
    void maDoiTroVeCungMotThanhPho() {
        // Hàng không dùng mã IATA, tàu và xe dùng mã ga - bến, nhưng Huế thì vẫn chỉ có một Huế.
        String[][] cacCapMaTrung = { { "HUI", "HUE" }, { "CXR", "NTR" }, { "DLI", "DLT" }, { "VII", "VIN" } };

        for (String[] cap : cacCapMaTrung) {
            PlaceCatalog.Place a = PlaceCatalog.find(cap[0]).orElseThrow();
            PlaceCatalog.Place b = PlaceCatalog.find(cap[1]).orElseThrow();

            assertEquals(a.cityId(), b.cityId(), cap[0] + " và " + cap[1] + " phải là cùng một thành phố");
            assertEquals(0.0, PlaceCatalog.distanceKm(cap[0], cap[1]).orElseThrow(), 0.001,
                    "Cùng một nơi thì cự ly phải bằng 0");
        }
    }

    @Test
    @DisplayName("Cự ly khớp với mấy mốc đã biết")
    void cuLyKhopMocDaBiet() {
        // Đường chim bay, không phải chiều dài đường sắt hay quốc lộ.
        assertEquals(1138, PlaceCatalog.distanceKm("HAN", "SGN").orElseThrow(), 30);
        assertEquals(606, PlaceCatalog.distanceKm("HAN", "DAD").orElseThrow(), 20);
        assertEquals(89, PlaceCatalog.distanceKm("HAN", "HPH").orElseThrow(), 10);
    }

    @Test
    @DisplayName("Đi và về cùng một cự ly")
    void diVaVeCungCuLy() {
        assertEquals(PlaceCatalog.distanceKm("HAN", "SGN").orElseThrow(),
                PlaceCatalog.distanceKm("SGN", "HAN").orElseThrow(), 0.001);
    }

    @Test
    @DisplayName("Mã lạ trả về rỗng chứ không ném lỗi")
    void maLaTraVeRong() {
        assertTrue(PlaceCatalog.find("ZZZ").isEmpty());
        assertTrue(PlaceCatalog.find(null).isEmpty());
        assertTrue(PlaceCatalog.find("  ").isEmpty());

        OptionalDouble khongTraDuoc = PlaceCatalog.distanceKm("HAN", "ZZZ");
        assertTrue(khongTraDuoc.isEmpty(), "Thiếu một đầu thì không được bịa ra cự ly");
    }

    @Test
    @DisplayName("Viết thường hay viết hoa đều tra được")
    void khongPhanBietHoaThuong() {
        assertEquals(PlaceCatalog.find("HAN").orElseThrow(), PlaceCatalog.find("han").orElseThrow());
    }
}
