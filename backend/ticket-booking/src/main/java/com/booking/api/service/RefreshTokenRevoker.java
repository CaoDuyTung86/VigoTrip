package com.booking.api.service;

import com.booking.api.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Thu hồi một họ refresh token trong GIAO DỊCH RIÊNG.
 *
 * Lớp này tồn tại vì một lý do duy nhất, và nó không hiển nhiên chút nào:
 *
 * Khi phát hiện token bị dùng lại, {@link RefreshTokenService#rotate} làm hai việc — thu hồi
 * cả họ, rồi ném ngoại lệ để chặn người gọi. Nhưng @Transactional mặc định cuộn ngược mọi
 * thứ khi gặp RuntimeException, nên lệnh thu hồi bị xoá sạch ngay sau khi vừa chạy. Kết quả
 * là phản ứng quan trọng nhất của toàn bộ cơ chế chống trộm KHÔNG có tác dụng gì: đúng một
 * request bị từ chối, còn token của kẻ tấn công vẫn nằm nguyên đó, sống và dùng được.
 *
 * Lỗi này không lộ ra ở bất kỳ đâu — không log lỗi, không ngoại lệ, endpoint vẫn trả 401
 * đúng như mong đợi. Nó bị bắt bởi một dòng assert trong RefreshTokenRotationIntegrationTest:
 * "token hợp lệ của nạn nhân cũng phải chết theo".
 *
 * REQUIRES_NEW tách việc thu hồi sang một giao dịch độc lập: nó đã commit xong trước khi
 * ngoại lệ được ném ra, nên số phận của giao dịch ngoài không còn liên quan.
 *
 * Phải là một bean riêng chứ không phải một phương thức trong RefreshTokenService: Spring
 * hiện thực @Transactional bằng proxy, mà gọi phương thức của chính mình thì không đi qua
 * proxy — annotation sẽ bị bỏ qua lặng lẽ và ta quay về đúng con bọ vừa sửa.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenRevoker {

    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int revokeFamilyInNewTransaction(String familyId, String reason) {
        return refreshTokenRepository.revokeFamily(familyId, LocalDateTime.now(), reason);
    }
}
