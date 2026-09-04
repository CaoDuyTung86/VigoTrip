package com.booking.api.service;

import com.booking.api.dto.ChatFeedbackRequest;
import com.booking.api.entity.ChatFeedback;
import com.booking.api.repository.ChatFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * /api/chat/feedback là endpoint permitAll và có ghi DB, còn messageRef thì do client sinh
 * ra — nên một mã bịa ra cũng phải bị từ chối, nếu không bảng dùng để đo chất lượng chatbot
 * là chỗ ai cũng bơm số vào được.
 *
 * Ba nhánh ở đây là ba câu hỏi tách bạch: mã lạ có bị chặn không, khách vãng lai đánh giá
 * bình thường có lọt qua không, và người đã đăng nhập chấm điểm một câu trả lời cũ (sổ trong
 * bộ nhớ đã trắng sau khi server khởi động lại) có còn lọt qua không.
 */
class ChatFeedbackServiceRefGuardTest {

    private static final String USER = "chinhchu@example.com";

    private ChatFeedbackRepository repository;
    private ChatHistoryService chatHistoryService;
    private ChatMessageRefRegistry refRegistry;
    private ChatFeedbackService service;

    @BeforeEach
    void setUp() {
        repository = mock(ChatFeedbackRepository.class);
        chatHistoryService = mock(ChatHistoryService.class);
        refRegistry = new ChatMessageRefRegistry(24, 50000);

        when(repository.findByMessageRef(anyString())).thenReturn(Optional.empty());
        when(chatHistoryService.isHistoryAllowed(anyString())).thenReturn(true);
        when(chatHistoryService.ownsMessageRef(any(), any())).thenReturn(false);

        service = new ChatFeedbackService(repository, chatHistoryService, refRegistry);
        // Hai trường này bình thường do @Value bơm vào; test đơn vị không có context Spring.
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "retentionDays", 30);
    }

    private static ChatFeedbackRequest request(String messageRef) {
        ChatFeedbackRequest req = new ChatFeedbackRequest();
        req.setMessageRef(messageRef);
        req.setRating("UP");
        req.setSessionId("session-1");
        req.setLanguage("vi");
        return req;
    }

    @Test
    @DisplayName("Mã không do server cấp thì không được ghi dòng nào")
    void tuChoiMaBiaRa() {
        boolean saved = service.submit(request("ma-bia-ra-tu-curl"), null);

        assertThat(saved).isFalse();
        verify(repository, never()).save(any(ChatFeedback.class));
    }

    @Test
    @DisplayName("Khách vãng lai đánh giá câu trả lời vừa nhận thì vẫn ghi nhận bình thường")
    void chapNhanMaVuaCap() {
        refRegistry.register("ref-that-01");

        boolean saved = service.submit(request("ref-that-01"), null);

        assertThat(saved).isTrue();
        verify(repository).save(any(ChatFeedback.class));
    }

    @Test
    @DisplayName("Sổ trong bộ nhớ trắng sau restart: người đã đăng nhập vẫn chấm được câu trả lời cũ của mình")
    void chapNhanMaNamTrongLichSuCuaChinhMinh() {
        when(chatHistoryService.ownsMessageRef(USER, "ref-cu-trong-db")).thenReturn(true);

        boolean saved = service.submit(request("ref-cu-trong-db"), USER);

        assertThat(saved).isTrue();
        verify(repository).save(any(ChatFeedback.class));
    }

    @Test
    @DisplayName("Lịch sử của người khác không mở đường cho mã lạ")
    void khongMuonDuocQuyenTuNguoiKhac() {
        when(chatHistoryService.ownsMessageRef(USER, "ref-cua-nguoi-khac")).thenReturn(false);

        boolean saved = service.submit(request("ref-cua-nguoi-khac"), USER);

        assertThat(saved).isFalse();
        verify(repository, never()).save(any(ChatFeedback.class));
    }
}
