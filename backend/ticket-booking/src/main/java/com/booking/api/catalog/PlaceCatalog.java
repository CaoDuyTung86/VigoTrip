package com.booking.api.catalog;

import com.booking.api.ai.rag.TextNormalizer;

import java.util.LinkedHashMap;
import java.util.List;
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

    /**
     * Tên đã chuẩn hoá -&gt; mã điểm chính.
     *
     * <p>Người dùng gõ "Đà Nẵng", "da nang" hay "sân bay Đà Nẵng" chứ không gõ {@code DAD}. Trước
     * đây chỉ có đường tra theo mã, nên mọi thứ nhận đầu vào từ người dùng đều phải nhờ model
     * đoán hộ cái mã — mà model đoán trượt thì ra một nơi khác hẳn: nó từng được dạy rằng
     * {@code QNH} là Quy Nhơn, trong khi {@code QNH} là Quảng Ninh.
     *
     * <p>Giá trị là MÃ chứ không phải {@link Place}, để nơi gọi còn biết đường ghi lại mã chính
     * thức của nơi vừa tra được.
     */
    private static final Map<String, String> CODE_BY_NAME = new LinkedHashMap<>();

    /** Danh sách tên tiếng Việt theo thứ tự khai báo, dùng để mách lại khi tra không ra. */
    private static final List<String> VIETNAMESE_NAMES;

    private static void register(Place place, String... codes) {
        for (String code : codes) {
            BY_CODE.put(code.toUpperCase(), place);
        }
        // Mã đầu tiên là mã chính: Huế khai HUI trước HUE thì tra theo tên trả về HUI. Với thời
        // tiết thì hai mã cho cùng một kết quả, nên chọn mã nào cũng được, miễn là ổn định.
        alias(codes[0], place.nameVi(), place.nameEn());
    }

    /** Thêm cách gọi khác cho một mã đã đăng ký. */
    private static void alias(String code, String... names) {
        for (String name : names) {
            CODE_BY_NAME.put(nameKey(name), code.toUpperCase());
        }
    }

    /**
     * Khoá tra tên: bỏ dấu, thường hoá, rồi bỏ luôn khoảng trắng và dấu câu.
     *
     * <p>Bỏ khoảng trắng để "Hà Nội", "ha noi" và "hanoi" rơi vào cùng một khoá — người Việt gõ
     * dính hay gõ rời đều rất phổ biến, và ép chọn một cách viết là ép sai.
     */
    private static String nameKey(String raw) {
        return TextNormalizer.normalize(raw == null ? "" : raw).replaceAll("[^a-z0-9]", "");
    }

    /**
     * Những chữ đứng trước tên nơi mà không thay đổi nơi đó là đâu.
     *
     * <p>"sân bay Đà Nẵng", "ga Huế", "bến xe Miền Đông" — phần đầu nói về loại công trình chứ
     * không nói về thành phố. Danh mục này mới chỉ có thành phố, nên cắt phần đầu đi là tra
     * được; khi bảng {@code diem_don_tra} ra đời thì phần đầu ấy mới thành thông tin thật.
     */
    private static final List<String> NAME_PREFIXES = List.of(
            "thanhpho", "tp", "sanbay", "gatau", "ga", "benxe", "city", "airport", "station");

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

        // Cách gọi khác. Tên chính thức không phải lúc nào cũng là tên người ta gõ: gần như không
        // ai gõ "TP. Hồ Chí Minh", và giao diện đặt vé gọi QNH là "Quảng Ninh" trong khi toạ độ ở
        // đây là Hạ Long — hai tên cùng một nơi thì phải cùng tra ra một chỗ.
        alias("SGN", "Sài Gòn", "Saigon", "Sai Gon", "HCM", "TPHCM", "TP HCM", "Ho Chi Minh",
                "Thành phố Hồ Chí Minh");
        alias("HAN", "Thủ đô Hà Nội", "Ha Noi");
        alias("QNH", "Quảng Ninh", "Quang Ninh", "Bãi Cháy", "Bai Chay");
        alias("DAD", "Danang");
        alias("HPH", "Haiphong");
        alias("SAP", "Sapa", "Lào Cai", "Lao Cai");
        alias("PQC", "Phu Quoc", "Đảo Phú Quốc");
        alias("VCL", "Chulai", "Quảng Nam", "Quang Nam", "Tam Kỳ", "Tam Ky");
        alias("DLI", "Dalat", "Lâm Đồng", "Lam Dong");
        alias("CXR", "Nhatrang", "Khánh Hòa", "Khanh Hoa");
        alias("HUI", "Thừa Thiên Huế", "Thua Thien Hue");
        alias("VII", "Nghệ An", "Nghe An");

        VIETNAMESE_NAMES = BY_CODE.values().stream()
                .map(Place::nameVi)
                .distinct()
                .toList();
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
     * Tra mã điểm từ đúng những gì người dùng gõ ra: một mã, một tên tiếng Việt, một tên tiếng
     * Anh, hay một cách gọi khác.
     *
     * <p>Nhận cả mã lẫn tên trong cùng một cửa vì nơi gọi không biết trước mình đang cầm cái gì:
     * chuỗi này đến từ câu chat của khách, đã qua tay model. Bắt nơi gọi phân biệt trước là bắt
     * nó đoán, mà đoán ở đây thì trượt.
     *
     * <p>Rỗng nghĩa là danh mục KHÔNG có nơi đó — nơi gọi phải nói thẳng là chưa hỗ trợ, tuyệt
     * đối không được chọn đại một nơi gần giống.
     */
    public static Optional<String> resolveCode(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String direct = text.trim().toUpperCase();
        if (BY_CODE.containsKey(direct)) {
            return Optional.of(direct);
        }

        String key = nameKey(text);
        if (key.isEmpty()) {
            return Optional.empty();
        }
        String found = CODE_BY_NAME.get(key);
        if (found != null) {
            return Optional.of(found);
        }

        for (String prefix : NAME_PREFIXES) {
            if (key.startsWith(prefix) && key.length() > prefix.length()) {
                String stripped = CODE_BY_NAME.get(key.substring(prefix.length()));
                if (stripped != null) {
                    return Optional.of(stripped);
                }
            }
        }
        return Optional.empty();
    }

    /** Như {@link #resolveCode(String)} nhưng trả thẳng địa điểm. */
    public static Optional<Place> resolve(String text) {
        return resolveCode(text).flatMap(PlaceCatalog::find);
    }

    /**
     * Tên tiếng Việt của mọi nơi đang có trong danh mục, mỗi nơi một lần.
     *
     * <p>Dùng để mách lại khi tra không ra: câu "chưa hỗ trợ nơi này" mà kèm danh sách nơi tra
     * được thì khách còn biết hỏi lại, chứ cụt lủn thì khách chỉ biết bỏ cuộc.
     */
    public static List<String> vietnameseNames() {
        return VIETNAMESE_NAMES;
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
