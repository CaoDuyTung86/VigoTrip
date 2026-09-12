package com.booking.api.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        
        // Register custom caches with specific settings
        cacheManager.registerCustomCache("trips", Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .maximumSize(500)
                .build());
                
        cacheManager.registerCustomCache("calendar_prices", Caffeine.newBuilder()
                .expireAfterWrite(10, TimeUnit.MINUTES)
                .maximumSize(200)
                .build());
                
        cacheManager.registerCustomCache("vouchers", Caffeine.newBuilder()
                .expireAfterWrite(15, TimeUnit.MINUTES)
                .maximumSize(100)
                .build());
                
        // Dải tin chạy: endpoint công khai, client gọi lại mỗi lần cửa sổ được focus. TTL ngắn
        // hơn "vouchers" vì tin phải tự rụng khi voucher hết hạn, mà việc hết hạn thì không
        // có thao tác nào để bám vào mà xóa cache. Kích thước 4 chứ không phải 100: cache này
        // chỉ có đúng một khóa (phương thức không tham số).
        cacheManager.registerCustomCache("announcements", Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .maximumSize(4)
                .build());

        // Dự báo thời tiết theo (thành phố, ngày). TTL 60 phút vì dự báo cho MỘT NGÀY không đổi
        // từng phút, dù thời tiết thì đổi từng giờ. Cache giữ CẢ kết quả rỗng: lúc Open-Meteo
        // trục trặc, không cache thì mỗi lượt xem trang lại phải chờ hết giờ chờ mới chịu bỏ cuộc.
        // Sức chứa 500 đủ cho 12 thành phố nhân 8 ngày trong tầm dự báo, còn dư nhiều.
        cacheManager.registerCustomCache("weather", Caffeine.newBuilder()
                .expireAfterWrite(60, TimeUnit.MINUTES)
                .maximumSize(500)
                .build());

        cacheManager.registerCustomCache("routes", Caffeine.newBuilder()
                .expireAfterWrite(30, TimeUnit.MINUTES)
                .maximumSize(100)
                .build());
                
        return cacheManager;
    }
}
