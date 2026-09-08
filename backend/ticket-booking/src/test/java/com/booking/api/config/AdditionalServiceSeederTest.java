package com.booking.api.config;

import com.booking.api.entity.AdditionalService;
import com.booking.api.repository.AdditionalServiceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.CommandLineRunner;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Đường di trú dữ liệu của bảng dich_vu_bo_sung.
 *
 * <p>Vì sao đáng viết test: {@code backfillCodes} chỉ chạy có ý nghĩa đúng MỘT lần, ngay lần
 * khởi động đầu sau khi cột service_code được thêm vào — và chạy thẳng trên dữ liệu thật của
 * Neon, nơi đã có đơn hàng tham chiếu tới từng dòng. Sai ở đây thì hoặc màn hình chọn dịch vụ
 * trống trơn (không dòng nào có nhóm), hoặc danh mục nhân đôi (tạo dòng mới thay vì gắn mã cho
 * dòng cũ) — cả hai đều chỉ lộ ra sau khi đã deploy.
 */
class AdditionalServiceSeederTest {

    private AdditionalServiceRepository repository;
    private List<AdditionalService> table;
    private CommandLineRunner seeder;

    /** Bảng giả giữ trạng thái giữa các lượt save, để chạy seeder nhiều lần như thật. */
    @BeforeEach
    void setUp() {
        table = new ArrayList<>();
        repository = mock(AdditionalServiceRepository.class);
        AtomicLong nextId = new AtomicLong(100);

        when(repository.findAll()).thenAnswer(inv -> new ArrayList<>(table));
        doAnswer(inv -> {
            AdditionalService svc = inv.getArgument(0);
            if (svc.getId() == null) {
                svc.setId(nextId.getAndIncrement());
                table.add(svc);
            }
            return svc;
        }).when(repository).save(any(AdditionalService.class));
        doAnswer(inv -> {
            List<AdditionalService> batch = inv.getArgument(0);
            for (AdditionalService svc : batch) {
                if (svc.getId() == null) {
                    svc.setId(nextId.getAndIncrement());
                }
                table.add(svc);
            }
            return batch;
        }).when(repository).saveAll(anyList());

        seeder = new AdditionalServiceSeeder().initAdditionalServices(repository);
    }

    private AdditionalService legacyRow(long id, String name, long price) {
        AdditionalService svc = new AdditionalService();
        svc.setId(id);
        svc.setServiceName(name);
        svc.setPrice(BigDecimal.valueOf(price));
        return svc;
    }

    private AdditionalService find(String name) {
        return table.stream().filter(s -> name.equals(s.getServiceName())).findFirst().orElse(null);
    }

    @Test
    @DisplayName("Cơ sở dữ liệu trắng: dựng đủ danh mục, dòng nào cũng có mã và nhóm")
    void seedsFullCatalogOnEmptyDatabase() throws Exception {
        seeder.run();

        assertThat(table).isNotEmpty();
        assertThat(table).allSatisfy(svc -> {
            assertThat(svc.getServiceCode()).as("mã của %s", svc.getServiceName()).isNotBlank();
            assertThat(svc.getCategory()).as("nhóm của %s", svc.getServiceName()).isNotBlank();
        });
        assertThat(table).extracting(AdditionalService::getCategory)
                .contains("BAGGAGE", "MEAL", "INSURANCE", "TRANSFER");
    }

    @Test
    @DisplayName("Dữ liệu cũ được gắn mã tại chỗ, GIỮ NGUYÊN service_id vì đơn cũ đang tham chiếu")
    void backfillsExistingRowsInPlace() throws Exception {
        table.add(legacyRow(7L, "Hành lý ký gửi 20kg", 250_000));
        table.add(legacyRow(8L, "Bảo hiểm du lịch cơ bản", 49_000));

        seeder.run();

        AdditionalService baggage = find("Hành lý ký gửi 20kg");
        assertThat(baggage.getId()).as("id phải giữ nguyên, không được tạo dòng mới").isEqualTo(7L);
        assertThat(baggage.getServiceCode()).isEqualTo("BAGGAGE_20KG");
        assertThat(baggage.getCategory()).isEqualTo("BAGGAGE");

        assertThat(find("Bảo hiểm du lịch cơ bản").getId()).isEqualTo(8L);
        assertThat(find("Bảo hiểm du lịch cơ bản").getServiceCode()).isEqualTo("INSURANCE_BASIC");

        // Đúng một dòng cho mỗi mã: gắn mã cho dòng cũ chứ không thêm dòng trùng bên cạnh.
        assertThat(table.stream().filter(s -> "BAGGAGE_20KG".equals(s.getServiceCode()))).hasSize(1);
    }

    @Test
    @DisplayName("Không ghi đè giá quản trị viên đã chỉnh trong lúc vận hành")
    void doesNotOverwriteAdminEditedPrice() throws Exception {
        table.add(legacyRow(7L, "Hành lý ký gửi 20kg", 299_000));

        seeder.run();

        assertThat(find("Hành lý ký gửi 20kg").getPrice()).isEqualByComparingTo(BigDecimal.valueOf(299_000));
    }

    @Test
    @DisplayName("Dòng taxi tên cũ được đổi tên rồi gắn mã, vẫn là một dòng duy nhất")
    void renamesLegacyTaxiThenCodesIt() throws Exception {
        table.add(legacyRow(9L, "Taxi đưa đón sân bay (Xanh SM)", 199_000));

        seeder.run();

        assertThat(find("Taxi đưa đón sân bay (Xanh SM)")).as("tên cũ không còn").isNull();
        AdditionalService transfer = find("Xe đưa đón tận nơi (Xanh SM)");
        assertThat(transfer.getId()).isEqualTo(9L);
        assertThat(transfer.getServiceCode()).isEqualTo("TRANSFER_TAXI");
        assertThat(transfer.getCategory()).isEqualTo("TRANSFER");
        assertThat(table.stream().filter(s -> "TRANSFER_TAXI".equals(s.getServiceCode()))).hasSize(1);
    }

    @Test
    @DisplayName("Suất ăn bản cũ thiếu tiền tố cũng đổi tên rồi gắn mã, không tạo bản sao")
    void renamesLegacyMealsThenCodesThem() throws Exception {
        table.add(legacyRow(3L, "Combo Mỳ Ý và Nước suối và Hạt điều", 99_000));

        seeder.run();

        AdditionalService meal = find("Suất ăn - Combo Mỳ Ý, nước suối & hạt điều");
        assertThat(meal.getId()).isEqualTo(3L);
        assertThat(meal.getServiceCode()).isEqualTo("MEAL_MY_Y");
        assertThat(table.stream().filter(s -> "MEAL_MY_Y".equals(s.getServiceCode()))).hasSize(1);
    }

    @Test
    @DisplayName("Chạy lại nhiều lần không sinh thêm dòng nào — mỗi lần khởi động app là một lần chạy")
    void isIdempotentAcrossRestarts() throws Exception {
        seeder.run();
        int afterFirst = table.size();

        seeder.run();
        seeder.run();

        assertThat(table).hasSize(afterFirst);
    }

    @Test
    @DisplayName("Dòng lạ ngoài danh mục được giữ nguyên, không mã và không nhóm")
    void leavesUnknownRowsAlone() throws Exception {
        table.add(legacyRow(50L, "Dịch vụ quản trị viên tự thêm", 10_000));

        seeder.run();

        AdditionalService custom = find("Dịch vụ quản trị viên tự thêm");
        assertThat(custom).isNotNull();
        assertThat(custom.getServiceCode()).isNull();
        assertThat(custom.getCategory()).isNull();
    }
}
