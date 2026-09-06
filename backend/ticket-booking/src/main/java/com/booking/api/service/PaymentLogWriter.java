package com.booking.api.service;

import com.booking.api.entity.PaymentLog;
import com.booking.api.repository.PaymentLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi một dòng nhật ký trong TRANSACTION RIÊNG, tách khỏi transaction đang gọi.
 *
 * VÌ SAO PHẢI TÁCH: nếu dòng nhật ký nằm chung transaction với luồng xử lý callback thì nó
 * rollback cùng luồng đó. Nghĩa là đúng những lượt hỏng — lượt mà ta cần bằng chứng nhất —
 * lại là lượt không để lại gì. Một nhật ký chỉ ghi được lúc mọi thứ suôn sẻ thì vô dụng.
 *
 * CÁI GIÁ: trong lúc ghi, tiến trình giữ HAI connection cùng lúc (một của transaction ngoài
 * đang bị treo, một của transaction này). Pool đang là 10 (xem application.yml), còn callback
 * thanh toán thì thưa, nên khoảng cách còn rất rộng. Nhưng đây là con số cần nhớ nếu sau này
 * có ý định gọi hàm ghi này trong một vòng lặp dài.
 *
 * Lớp để package-private vì không ai ngoài {@link PaymentLogService} được gọi thẳng: gọi
 * thẳng là bỏ qua lớp nuốt lỗi, và một lỗi ghi nhật ký sẽ đánh sập luồng thanh toán thật.
 * Riêng phương thức phải để public — Spring chỉ bảo đảm chèn được transaction vào phương
 * thức public.
 */
@Service
@RequiredArgsConstructor
class PaymentLogWriter {

    private final PaymentLogRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(PaymentLog entry) {
        repository.save(entry);
    }
}
