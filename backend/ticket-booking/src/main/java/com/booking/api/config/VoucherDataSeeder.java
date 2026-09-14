package com.booking.api.config;

import com.booking.api.entity.Provider;
import com.booking.api.entity.Voucher;
import com.booking.api.repository.ProviderRepository;
import com.booking.api.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class VoucherDataSeeder {

    private final VoucherRepository voucherRepository;
    private final ProviderRepository providerRepository;

    @Bean
    @Order(3)
    CommandLineRunner seedVoucherData() {
        return args -> {
            if (voucherRepository.count() > 0) {
                log.info("Voucher data already exists, skipping initial seed.");
                seedDemoVouchers();
                return;
            }

            log.info("Seeding voucher data...");

            Voucher welcome = new Voucher();
            welcome.setCode("WELCOME20");
            welcome.setDiscountPercent(20.0);
            welcome.setMaxDiscountAmount(100000.0);
            welcome.setMinOrderAmount(200000.0);
            welcome.setExpiryDate(LocalDateTime.now().plusMonths(3));
            welcome.setMaxUsage(100);
            welcome.setCurrentUsage(0);
            welcome.setDescription("Giảm 20% cho khách hàng mới (tối đa 100.000đ)");
            welcome.setIsActive(true);
            voucherRepository.save(welcome);

            Voucher summer = new Voucher();
            summer.setCode("SUMMER2026");
            summer.setDiscountPercent(15.0);
            summer.setMaxDiscountAmount(200000.0);
            summer.setMinOrderAmount(500000.0);
            summer.setExpiryDate(LocalDateTime.of(2026, 8, 31, 23, 59, 59));
            summer.setMaxUsage(50);
            summer.setCurrentUsage(0);
            summer.setDescription("Ưu đãi mùa hè — Giảm 15% (tối đa 200.000đ)");
            summer.setIsActive(true);
            voucherRepository.save(summer);

            Voucher aiPromo = new Voucher();
            aiPromo.setCode("AI_PROMO_10");
            aiPromo.setDiscountPercent(10.0);
            aiPromo.setMaxDiscountAmount(50000.0);
            aiPromo.setMinOrderAmount(100000.0);
            aiPromo.setExpiryDate(LocalDateTime.now().plusMonths(6));
            aiPromo.setMaxUsage(200);
            aiPromo.setCurrentUsage(0);
            aiPromo.setDescription("Mã riêng từ Chatbot AI — Giảm 10% (tối đa 50.000đ)");
            aiPromo.setIsActive(true);
            // Mã duy nhất KHÔNG lên dải tin chạy: chatbot phát nó cho từng người trong hội
            // thoại riêng, rao lên bảng điện tử thì cái tính riêng ấy thành vô nghĩa.
            aiPromo.setShowOnTicker(false);
            voucherRepository.save(aiPromo);

            Voucher vip = new Voucher();
            vip.setCode("VIP50");
            vip.setDiscountPercent(50.0);
            vip.setMaxDiscountAmount(500000.0);
            vip.setMinOrderAmount(1000000.0);
            vip.setExpiryDate(LocalDateTime.now().plusMonths(1));
            vip.setMaxUsage(10);
            vip.setCurrentUsage(0);
            vip.setDescription("Siêu giảm 50% cho đơn từ 1 triệu (tối đa 500.000đ, giới hạn 10 lượt)");
            vip.setIsActive(true);
            voucherRepository.save(vip);

            log.info("Seeded {} voucher codes.", voucherRepository.count());
            seedDemoVouchers();
        };
    }

    /**
     * Bộ mã thứ hai, mỗi mã phủ một nhánh mà bốn mã đầu không chạm tới: mã theo hãng, mã chưa tới
     * ngày, mã sắp hết lượt, mã sắp hết hạn, mã không có đơn tối thiểu, mã không lên bảng tin. Có
     * chúng thì trang ưu đãi, dải tin, check_voucher và nút lưu mã của trợ lý đều có dữ liệu để thử
     * từng trạng thái mà không phải vào trang quản trị tạo tay.
     *
     * <p><b>Thêm theo từng mã, không theo "bảng rỗng".</b> Guard {@code count() > 0} ở trên khiến
     * mọi môi trường đã chạy sẽ không bao giờ nhận thêm mã nào. Hệ quả cần biết: xoá hẳn một mã demo
     * thì lần khởi động sau nó quay lại — muốn bỏ thì TẮT mã đó trong trang quản trị, đúng lối "tắt
     * chứ không xoá" của màn hình ấy.
     */
    private void seedDemoVouchers() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, Provider> providers = providerRepository
                .findByProviderNameIn(List.of("Đường Sắt VN (VNR)", "Phương Trang (FUTA)", "Vietjet Air"))
                .stream()
                .collect(Collectors.toMap(Provider::getProviderName, Function.identity(), (a, b) -> a));

        List<Voucher> demo = List.of(
                voucher("AUTUMN2026", 12.0, 150000.0, 400000.0, null,
                        LocalDateTime.of(2026, 11, 30, 23, 59, 59), 300, 0,
                        "Ưu đãi mùa thu — giảm 12% (tối đa 150.000đ) cho đơn từ 400.000đ"),
                voucher("WEEKEND15", 15.0, 120000.0, 300000.0, null, now.plusMonths(2), 200, 0,
                        "Đi chơi cuối tuần — giảm 15% (tối đa 120.000đ) cho đơn từ 300.000đ"),
                voucher("FLASH40", 40.0, 200000.0, 500000.0, null, now.plusDays(3), 30, 0,
                        "Flash sale 3 ngày — giảm 40% (tối đa 200.000đ)"),
                voucher("LASTCALL30", 30.0, 250000.0, 600000.0, null, now.plusMonths(1), 5, 3,
                        "Chỉ còn vài lượt — giảm 30% (tối đa 250.000đ) cho đơn từ 600.000đ"),
                voucher("STUDENT10", 10.0, 60000.0, null, null, now.plusMonths(6), 500, 0,
                        "Sinh viên — giảm 10% (tối đa 60.000đ), không cần đơn tối thiểu"),
                voucher("TET2027", 20.0, 300000.0, 800000.0, LocalDateTime.of(2027, 1, 20, 0, 0),
                        LocalDateTime.of(2027, 2, 20, 23, 59, 59), 500, 0,
                        "Về quê ăn Tết Đinh Mùi — giảm 20% (tối đa 300.000đ), áp dụng từ 20/01/2027"),
                withProvider(voucher("VNR20", 20.0, 100000.0, 200000.0, null, now.plusMonths(2), 150, 0,
                        "Đi tàu Đường Sắt VN — giảm 20% (tối đa 100.000đ)"), providers.get("Đường Sắt VN (VNR)")),
                withProvider(voucher("FUTA15", 15.0, 80000.0, 150000.0, null, now.plusMonths(2), 150, 0,
                        "Xe khách Phương Trang — giảm 15% (tối đa 80.000đ)"), providers.get("Phương Trang (FUTA)")),
                withProvider(voucher("VIETJET12", 12.0, 150000.0, 800000.0, null, now.plusMonths(2), 100, 0,
                        "Bay cùng Vietjet Air — giảm 12% (tối đa 150.000đ) cho đơn từ 800.000đ"), providers.get("Vietjet Air")));

        // Mã theo đối tượng: rao lên bảng điện tử thì chẳng khác gì mời mọi người tự nhận là sinh viên.
        demo.stream().filter(v -> "STUDENT10".equals(v.getCode())).forEach(v -> v.setShowOnTicker(false));

        int added = 0;
        for (Voucher v : demo) {
            if (voucherRepository.findByCodeIgnoreCase(v.getCode()).isPresent()) {
                continue;
            }
            // Mã theo hãng mà chưa có hãng (seed hãng chưa chạy) thì bỏ qua lần này thay vì tạo ra một
            // mã áp dụng cho MỌI hãng — đúng loại sai lệch không ai nhận ra cho tới lúc đối soát tiền.
            if (v.getCode().matches("VNR20|FUTA15|VIETJET12") && v.getProvider() == null) {
                log.warn("Chưa có hãng cho mã {} — bỏ qua, lần khởi động sau sẽ thử lại.", v.getCode());
                continue;
            }
            voucherRepository.save(v);
            added++;
        }
        if (added > 0) {
            log.info("Seeded {} demo voucher codes.", added);
        }
    }

    private static Voucher voucher(String code, double percent, Double maxDiscount, Double minOrder,
                                   LocalDateTime start, LocalDateTime expiry, int maxUsage, int currentUsage,
                                   String description) {
        Voucher v = new Voucher();
        v.setCode(code);
        v.setDiscountPercent(percent);
        v.setMaxDiscountAmount(maxDiscount);
        v.setMinOrderAmount(minOrder);
        v.setStartDate(start);
        v.setExpiryDate(expiry);
        v.setMaxUsage(maxUsage);
        v.setCurrentUsage(currentUsage);
        v.setDescription(description);
        v.setIsActive(true);
        return v;
    }

    private static Voucher withProvider(Voucher v, Provider provider) {
        v.setProvider(provider);
        return v;
    }
}
