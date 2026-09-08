package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Danh mục dịch vụ bổ sung: hành lý, suất ăn, bảo hiểm, xe đưa đón.
 *
 * <p>Mỗi dòng có một MÃ cố định ({@code BAGGAGE_20KG}, {@code MEAL_MY_Y}...) bên cạnh tên
 * tiếng Việt. Mã là thứ giao diện bám vào để xếp nhóm và tra bảng dịch; tên chỉ còn là chữ
 * hiển thị mặc định. Trước khi có mã, giao diện phải đoán nhóm bằng tiền tố của tên
 * ("Suất ăn - ", "Hành lý"), nên đổi tên một dòng là một lần âm thầm làm hỏng màn hình chọn
 * dịch vụ, và không có chỗ nào để móc bản dịch tiếng Anh vào.
 */
@Slf4j
@Configuration
public class AdditionalServiceSeeder {

    /** Nhóm dịch vụ. Phải khớp với SERVICE_CATEGORY trong my-react-app/src/utils/serviceCatalog.js. */
    public static final String CAT_BAGGAGE = "BAGGAGE";
    public static final String CAT_MEAL = "MEAL";
    public static final String CAT_INSURANCE = "INSURANCE";
    public static final String CAT_TRANSFER = "TRANSFER";

    /**
     * Một dòng trong danh mục.
     *
     * @param code    khoá máy đọc, cố định trọn đời; cũng là khoá tra bảng dịch ở frontend
     *                ({@code svc_<code>}) và khoá tra ảnh suất ăn (utils/mealImages.js)
     * @param viName  tên tiếng Việt, dùng làm chữ hiển thị mặc định khi thiếu bản dịch
     */
    private record Item(String code, String category, String viName, BigDecimal price) {
    }

    private static Item item(String code, String category, String viName, long price) {
        return new Item(code, category, viName, BigDecimal.valueOf(price));
    }

    /**
     * Danh mục chuẩn. Thứ tự khai ở đây là thứ tự khách nhìn thấy trên màn hình chọn dịch vụ,
     * vì controller trả về theo thứ tự id và các dòng được tạo lần lượt theo danh sách này.
     */
    private static final List<Item> CATALOG = List.of(
            item("BAGGAGE_15KG", CAT_BAGGAGE, "Hành lý ký gửi 15kg", 180000),
            item("BAGGAGE_20KG", CAT_BAGGAGE, "Hành lý ký gửi 20kg", 250000),
            item("BAGGAGE_30KG", CAT_BAGGAGE, "Hành lý ký gửi 30kg", 350000),

            item("INSURANCE_BASIC", CAT_INSURANCE, "Bảo hiểm du lịch cơ bản", 49000),
            item("INSURANCE_PREMIUM", CAT_INSURANCE, "Bảo hiểm du lịch cao cấp", 99000),

            item("TRANSFER_TAXI", CAT_TRANSFER, "Xe đưa đón tận nơi (Xanh SM)", 199000),

            item("MEAL_BANH_CHUNG", CAT_MEAL, "Suất ăn - Combo Bánh chưng chà bông, hạt điều & nước suối", 99000),
            item("MEAL_BUN_XAO_SINGAPORE", CAT_MEAL, "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều", 99000),
            item("MEAL_COM_CHIEN_THAI", CAT_MEAL, "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều", 99000),
            item("MEAL_COM_CHIEN_DUONG_CHAU_CHAY", CAT_MEAL, "Suất ăn - Combo Cơm chiên Dương Châu chay, nước suối & hạt điều", 99000),
            item("MEAL_COM_THIT_BO", CAT_MEAL, "Suất ăn - Combo Cơm thịt bò, hạt điều & nước suối", 99000),
            item("MEAL_MIEN_XAO_TOM_CUA", CAT_MEAL, "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều", 99000),
            item("MEAL_MY_Y", CAT_MEAL, "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều", 99000),
            item("MEAL_XOI_KHUC_GIO", CAT_MEAL, "Suất ăn - Combo Xôi khúc giò, hạt điều & nước suối", 99000),
            item("MEAL_XOI_MAN", CAT_MEAL, "Suất ăn - Combo Xôi mặn, hạt điều & nước suối", 99000),
            item("MEAL_HATTRICK_BIA", CAT_MEAL, "Suất ăn - Combo Hattrick Bia, khô gà & chả giò", 110000),
            item("MEAL_PENALTY_SODA", CAT_MEAL, "Suất ăn - Combo Penalty Soda dâu & hạt Macca", 100000));

    /**
     * Tên cũ -> tên hiện hành. Đổi tên TẠI CHỖ thay vì xoá đi tạo lại để giữ nguyên
     * service_id: các đơn đã đặt vẫn đang tham chiếu tới những dòng này, xoá đi là lịch sử
     * đơn hàng mất tên dịch vụ đã mua.
     *
     * <p>Bốn dòng đầu là các suất ăn của bản cũ chưa có tiền tố "Suất ăn - ".
     *
     * <p>Dòng cuối sửa một lỗi thật, không phải đổi cho đẹp: dịch vụ này được chào bán trên
     * CẢ ba trang tàu / xe khách / máy bay, nhưng tên lại ghi cứng "sân bay". Trang tàu thậm
     * chí còn cắt tiền tố "Taxi đưa đón sân ga" — không khớp tên trong cơ sở dữ liệu nên
     * regex trượt và nhãn hiện nguyên cả câu "Taxi đưa đón sân bay (Xanh SM)" dưới tiêu đề
     * "Đưa đón tại ga".
     */
    private static final Map<String, String> LEGACY_RENAMES = new LinkedHashMap<>();
    static {
        LEGACY_RENAMES.put("Combo Mỳ Ý và Nước suối và Hạt điều", "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều");
        LEGACY_RENAMES.put("Combo Cơm chiên Thái và Nước suối và Hạt điều", "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều");
        LEGACY_RENAMES.put("Combo Miến xào Tôm cua và Nước suối và Hạt điều", "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều");
        LEGACY_RENAMES.put("Combo Bún xào Singapore và Nước suối và Hạt điều", "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều");
        LEGACY_RENAMES.put("Taxi đưa đón sân bay (Xanh SM)", "Xe đưa đón tận nơi (Xanh SM)");
    }

    /**
     * Thứ tự khai tường minh vì DemoBookingSeeder (@Order 4) cần danh mục dịch vụ có sẵn.
     * Bean CommandLineRunner không gắn @Order rơi vào LOWEST_PRECEDENCE, tức là chạy sau
     * cùng — trên cơ sở dữ liệu mới thì seeder demo sẽ không thấy dịch vụ nào để gắn vào đơn.
     */
    @Bean
    @Order(3)
    public CommandLineRunner initAdditionalServices(AdditionalServiceRepository repository) {
        return args -> {
            renameLegacyRows(repository);
            backfillCodes(repository);
            insertMissing(repository);
        };
    }

    /** Bước 1: đổi tên các dòng cũ, bỏ qua nếu tên đích đã có để không tạo trùng. */
    private void renameLegacyRows(AdditionalServiceRepository repository) {
        List<AdditionalService> existing = repository.findAll();
        for (AdditionalService svc : existing) {
            String newName = LEGACY_RENAMES.get(svc.getServiceName());
            if (newName == null) {
                continue;
            }
            boolean targetExists = existing.stream()
                    .anyMatch(s -> !s.getId().equals(svc.getId()) && newName.equals(s.getServiceName()));
            if (targetExists) {
                continue;
            }
            svc.setServiceName(newName);
            repository.save(svc);
            log.info("Đã chuẩn hoá tên dịch vụ #{} thành \"{}\"", svc.getId(), newName);
        }
    }

    /**
     * Bước 2: gắn mã và nhóm cho những dòng đã có sẵn, nhận diện theo tên.
     *
     * <p>Đây là bước chạy đúng MỘT lần có ý nghĩa, ngay sau khi cột service_code được thêm
     * vào: các dòng cũ đang để trống mã. Từ lần khởi động sau, mọi dòng đều đã có mã nên
     * vòng lặp này không sửa gì. Giá cố tình KHÔNG ghi đè — quản trị viên có thể đã chỉnh
     * giá trong lúc vận hành, và seed không có quyền lấn lên đó.
     */
    private void backfillCodes(AdditionalServiceRepository repository) {
        List<AdditionalService> existing = repository.findAll();
        int touched = 0;
        for (Item item : CATALOG) {
            AdditionalService row = existing.stream()
                    .filter(s -> item.code().equals(s.getServiceCode()))
                    .findFirst()
                    .orElseGet(() -> existing.stream()
                            .filter(s -> s.getServiceCode() == null && item.viName().equals(s.getServiceName()))
                            .findFirst()
                            .orElse(null));
            if (row == null) {
                continue;
            }
            if (item.code().equals(row.getServiceCode()) && item.category().equals(row.getCategory())) {
                continue;
            }
            row.setServiceCode(item.code());
            row.setCategory(item.category());
            repository.save(row);
            touched++;
        }
        if (touched > 0) {
            log.info("Đã gắn mã/nhóm cho {} dịch vụ bổ sung có sẵn", touched);
        }
    }

    /** Bước 3: bổ sung những dịch vụ còn thiếu (chạy lại nhiều lần vẫn cho kết quả như nhau). */
    private void insertMissing(AdditionalServiceRepository repository) {
        List<String> existingCodes = repository.findAll().stream()
                .map(AdditionalService::getServiceCode)
                .toList();
        List<AdditionalService> missing = CATALOG.stream()
                .filter(i -> !existingCodes.contains(i.code()))
                .map(i -> new AdditionalService(i.code(), i.category(), i.viName(), i.price()))
                .toList();
        if (!missing.isEmpty()) {
            repository.saveAll(missing);
            log.info("Đã thêm {} dịch vụ bổ sung còn thiếu", missing.size());
        }
    }

}
