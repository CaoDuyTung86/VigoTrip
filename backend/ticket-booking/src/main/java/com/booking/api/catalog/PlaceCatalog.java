package com.booking.api.catalog;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.Set;

/**
 * Danh mục địa điểm: mã điểm -&gt; thành phố có toạ độ thật.
 *
 * <p>Trước đây mã điểm chỉ là chuỗi tự do trong {@code tuyen_duong.origin/destination}, không
 * gắn với chỗ nào trên bản đồ. Mọi thứ cần biết "đi bao xa" đều phải bịa: nguồn cung chuyến
 * bốc thời gian chạy và giá bằng xúc xắc, nên xe khách Hà Nội đi Sài Gòn mất 3 tiếng còn bay
 * Hà Nội đi Nha Trang có khi rẻ hơn bay Hà Nội đi Huế. Có toạ độ là có cự ly, có cự ly là suy
 * ra được thời gian chạy và giá sàn thay vì bốc thăm.
 *
 * <p><b>Một thành phố, nhiều mã.</b> Hàng không dùng mã IATA còn tàu - xe dùng mã ga - bến, nên
 * cùng một nơi đang mang hai mã: {@code HUI}/{@code HUE} là Huế, {@code CXR}/{@code NTR} là Nha
 * Trang, {@code DLI}/{@code DLT} là Đà Lạt, {@code VII}/{@code VIN} là Vinh. Ở đây cả hai mã trỏ
 * về CÙNG một {@link Place} với cùng {@code cityId}, nên mọi thứ tính theo thành phố (cự ly, và
 * sau này là dự báo thời tiết) không còn bị tách đôi. Bản thân việc gộp mã không xoá được mã
 * trùng khỏi danh mục tuyến, đó là việc của bảng {@code dia_diem} về sau.
 *
 * <p><b>Vì sao là hằng số trong mã nguồn chứ chưa phải bảng trong CSDL.</b> Đây là dữ liệu tham
 * chiếu gần như không đổi, và giữ trong mã thì không cần migration, không cần lo môi trường nào
 * đã seed môi trường nào chưa. Khi bảng {@code dia_diem} của mục Map ra đời, bảng đó nên được
 * seed TỪ đây rồi mới xoá chỗ này, chứ không phải gõ lại toạ độ lần nữa.
 *
 * <p>Toạ độ lấy ở trung tâm thành phố (không phải toạ độ sân bay hay nhà ga), vì nơi dùng đến
 * chúng là cự ly giữa hai thành phố và dự báo thời tiết cho nơi khách sẽ đến.
 */
public final class PlaceCatalog {

    /** Bán kính Trái Đất trung bình theo IUGG, dùng cho công thức haversine. */
    private static final double EARTH_RADIUS_KM = 6371.0088;

    /**
     * Một địa điểm có thật.
     *
     * @param cityId   khoá thành phố, dùng để gộp các mã cùng chỉ một nơi
     * @param nameVi   tên tiếng Việt, khớp với bảng dịch của {@code CitySelector}
     * @param nameEn   tên tiếng Anh
     * @param latitude vĩ độ
     * @param longitude kinh độ
     */
    public record Place(String cityId, String nameVi, String nameEn, double latitude, double longitude) {
    }

    private static final Map<String, Place> BY_CODE = new LinkedHashMap<>();

    private static void register(Place place, String... codes) {
        for (String code : codes) {
            BY_CODE.put(code.toUpperCase(), place);
        }
    }

    static {
        register(new Place("hanoi", "Hà Nội", "Hanoi", 21.0285, 105.8542), "HAN");
        register(new Place("hochiminh", "TP. Hồ Chí Minh", "Ho Chi Minh City", 10.8231, 106.6297), "SGN");
        register(new Place("danang", "Đà Nẵng", "Da Nang", 16.0544, 108.2022), "DAD");
        register(new Place("haiphong", "Hải Phòng", "Hai Phong", 20.8449, 106.6881), "HPH");
        register(new Place("phuquoc", "Phú Quốc", "Phu Quoc", 10.2270, 103.9670), "PQC");
        register(new Place("chulai", "Chu Lai", "Chu Lai", 15.4059, 108.7060), "VCL");
        register(new Place("sapa", "Sa Pa", "Sa Pa", 22.3364, 103.8438), "SAP");
        register(new Place("halong", "Hạ Long", "Ha Long", 20.9599, 107.0448), "QNH");

        // Bốn nơi dưới đây mang hai mã vì hàng không và đường sắt - đường bộ đặt tên khác nhau.
        register(new Place("hue", "Huế", "Hue", 16.4637, 107.5909), "HUI", "HUE");
        register(new Place("nhatrang", "Nha Trang", "Nha Trang", 12.2388, 109.1967), "CXR", "NTR");
        register(new Place("dalat", "Đà Lạt", "Da Lat", 11.9404, 108.4583), "DLI", "DLT");
        register(new Place("vinh", "Vinh", "Vinh", 18.6796, 105.6813), "VII", "VIN");
    }

    private PlaceCatalog() {
    }

    /** Tra một mã điểm. Rỗng nghĩa là mã chưa có trong danh mục, không phải mã sai. */
    public static Optional<Place> find(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(BY_CODE.get(code.trim().toUpperCase()));
    }

    /** Mọi mã đang khai báo. Dùng cho kiểm thử đối chiếu với danh mục tuyến. */
    public static Set<String> codes() {
        return Set.copyOf(BY_CODE.keySet());
    }

    /**
     * Cự ly đường chim bay giữa hai mã điểm, tính bằng km.
     *
     * <p>Đây CHỈ là đường chim bay, không phải chiều dài đường sắt hay quốc lộ. Phần chênh do
     * đường vòng được nuốt vào "tốc độ hiệu dụng" của từng loại phương tiện bên
     * {@code TripSupplyService}: cùng một cự ly chim bay, tàu và xe đi lâu hơn máy bay không chỉ
     * vì chậm hơn mà còn vì đi đường dài hơn.
     *
     * @return rỗng nếu một trong hai mã chưa có trong danh mục
     */
    public static OptionalDouble distanceKm(String originCode, String destinationCode) {
        Optional<Place> origin = find(originCode);
        Optional<Place> destination = find(destinationCode);
        if (origin.isEmpty() || destination.isEmpty()) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(haversineKm(origin.get(), destination.get()));
    }

    private static double haversineKm(Place a, Place b) {
        double dLat = Math.toRadians(b.latitude() - a.latitude());
        double dLon = Math.toRadians(b.longitude() - a.longitude());
        double lat1 = Math.toRadians(a.latitude());
        double lat2 = Math.toRadians(b.latitude());

        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(h)));
    }
}
