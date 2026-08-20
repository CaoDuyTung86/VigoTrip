package com.booking.api.ai.llm;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Trần tổng số lời gọi LLM mỗi ngày.
 *
 * RateLimitingFilter chặn theo từng IP/người dùng, nhưng không đặt trần cho TOÀN hệ
 * thống — nhiều nguồn cộng lại vẫn đốt sạch quota (hoặc hóa đơn) của API. Đây là chốt
 * chặn cuối: vượt hạn mức thì trả lời tĩnh thay vì gọi ra ngoài.
 *
 * Bộ đếm nằm trong bộ nhớ tiến trình. Với kiến trúc một container trên Render thì đúng;
 * nếu sau này chạy nhiều instance, cần chuyển sang bộ đếm dùng chung.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LlmBudgetGuard {

    private final MeterRegistry meterRegistry;

    @Value("${llm.budget.daily-request-cap:2000}")
    private int dailyCap;

    private final AtomicInteger usedToday = new AtomicInteger(0);
    private volatile LocalDate currentDay = LocalDate.now();

    private Counter rejectedCounter;

    @PostConstruct
    void initMetrics() {
        rejectedCounter = Counter.builder("llm_budget_rejected_total")
                .description("Số request bị từ chối vì vượt trần ngân sách LLM theo ngày")
                .register(meterRegistry);
        Gauge.builder("llm_budget_used_today", usedToday, AtomicInteger::get)
                .description("Số lời gọi LLM đã dùng trong ngày hiện tại")
                .register(meterRegistry);
        log.info("[LlmBudget] Trần ngân sách LLM: {} request/ngày", dailyCap);
    }

    /**
     * Xin một suất gọi LLM. Trả về false khi đã chạm trần trong ngày.
     * Bộ đếm tự reset khi sang ngày mới.
     */
    public synchronized boolean tryConsume() {
        LocalDate today = LocalDate.now();
        if (!today.equals(currentDay)) {
            currentDay = today;
            usedToday.set(0);
        }
        if (usedToday.get() >= dailyCap) {
            rejectedCounter.increment();
            log.warn("[LlmBudget] Đã chạm trần {} request/ngày — từ chối gọi LLM.", dailyCap);
            return false;
        }
        usedToday.incrementAndGet();
        return true;
    }

    /** Thông báo trả về cho người dùng khi hết ngân sách trong ngày. */
    public String exhaustedMessage() {
        return "Trợ lý AI đã đạt giới hạn sử dụng trong ngày hôm nay. Vui lòng quay lại vào ngày mai, "
                + "hoặc liên hệ tổng đài để được hỗ trợ trực tiếp.";
    }
}
