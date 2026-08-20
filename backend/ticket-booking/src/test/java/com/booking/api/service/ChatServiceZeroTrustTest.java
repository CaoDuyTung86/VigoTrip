package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Quy tắc bảo mật quan trọng nhất của chatbot: người dùng A tuyệt đối không được xem
 * dữ liệu của người dùng B, kể cả khi model bị dụ sinh ra tham số username của người khác.
 *
 * Quy tắc này được ghi trong SRS nhưng trước đó không có test nào bảo vệ.
 */
class ChatServiceZeroTrustTest {

    private static final String JWT_USER = "chinhchu@example.com";
    private static final String VICTIM = "nannhan@example.com";

    private BookingRepository bookingRepository;
    private AIService aiService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        TripRepository tripRepository = mock(TripRepository.class);
        bookingRepository = mock(BookingRepository.class);
        VoucherRepository voucherRepository = mock(VoucherRepository.class);
        RouteRepository routeRepository = mock(RouteRepository.class);
        aiService = mock(AIService.class);
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);

        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of());
        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN"));
        when(hybridRetriever.retrieve(anyString())).thenReturn(List.of());
        when(bookingRepository.findByUserEmailOrderByBookingDateDesc(anyString())).thenReturn(List.of());
        when(bookingRepository.findByIdAndUserEmail(any(), anyString())).thenReturn(Optional.empty());

        chatService = new ChatService(tripRepository, bookingRepository, voucherRepository,
                routeRepository, aiService, mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class));
    }

    /** Chạy một lượt chat rồi lấy ra ToolHandler mà ChatService đã trao cho AIService. */
    private AIService.ToolHandler captureToolHandler(String username) {
        chatService.getChatResponse("vé của tôi đâu", username, "session-1", List.of(), "vi");

        ArgumentCaptor<AIService.ToolHandler> captor = ArgumentCaptor.forClass(AIService.ToolHandler.class);
        verify(aiService).getChatResponse(anyString(), anyList(), anyString(), captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("get_user_bookings: username do model gửi bị thay bằng danh tính JWT")
    void userBookingsAlwaysUseJwtIdentity() {
        AIService.ToolHandler handler = captureToolHandler(JWT_USER);

        // Model bị dụ sinh ra email của người khác.
        handler.executeTool("get_user_bookings", Map.of("username", VICTIM));

        verify(bookingRepository).findByUserEmailOrderByBookingDateDesc(JWT_USER);
    }

    @Test
    @DisplayName("get_booking_by_id: username do model gửi cũng bị thay bằng danh tính JWT")
    void bookingByIdAlsoUsesJwtIdentity() {
        // Schema tool không khai tham số username, nhưng model bị prompt-injection vẫn
        // có thể phát thêm trường đó — không được tin.
        AIService.ToolHandler handler = captureToolHandler(JWT_USER);

        handler.executeTool("get_booking_by_id", Map.of("bookingId", "42", "username", VICTIM));

        verify(bookingRepository).findByIdAndUserEmail(eq(42L), eq(JWT_USER));
    }

    @Test
    @DisplayName("Khách chưa đăng nhập không tra được đơn hàng của bất kỳ ai")
    void guestCannotReadAnyBookings() {
        AIService.ToolHandler handler = captureToolHandler(null);

        String bookings = handler.executeTool("get_user_bookings", Map.of("username", VICTIM));
        String byId = handler.executeTool("get_booking_by_id", Map.of("bookingId", "42", "username", VICTIM));

        assertThat(bookings).contains("chưa đăng nhập");
        assertThat(byId).contains("chưa đăng nhập");
        verify(bookingRepository, org.mockito.Mockito.never())
                .findByUserEmailOrderByBookingDateDesc(anyString());
        verify(bookingRepository, org.mockito.Mockito.never())
                .findByIdAndUserEmail(any(), anyString());
    }

    @Test
    @DisplayName("Luồng stream áp dụng đúng quy tắc như luồng thường")
    void streamingPathAppliesSameRule() {
        chatService.streamChatResponse("vé của tôi đâu", JWT_USER, "session-1", List.of(), "vi", chunk -> {
        });

        ArgumentCaptor<AIService.ToolHandler> captor = ArgumentCaptor.forClass(AIService.ToolHandler.class);
        verify(aiService).streamChatResponse(anyString(), anyList(), anyString(), captor.capture(), any());

        captor.getValue().executeTool("get_user_bookings", Map.of("username", VICTIM));

        verify(bookingRepository).findByUserEmailOrderByBookingDateDesc(JWT_USER);
    }

    @Test
    @DisplayName("Tham số không liên quan tới danh tính vẫn được giữ nguyên")
    void nonIdentityArgumentsArePreserved() {
        AIService.ToolHandler handler = captureToolHandler(JWT_USER);

        handler.executeTool("get_booking_by_id", Map.of("bookingId", "7"));

        // bookingId đi qua nguyên vẹn, chỉ danh tính bị ép về JWT.
        verify(bookingRepository).findByIdAndUserEmail(eq(7L), eq(JWT_USER));
    }

    @Test
    @DisplayName("Tham số null không làm sập tool handler")
    void handlesNullArguments() {
        AIService.ToolHandler handler = captureToolHandler(JWT_USER);

        String result = handler.executeTool("get_user_bookings", null);

        assertThat(result).isNotNull();
        verify(bookingRepository).findByUserEmailOrderByBookingDateDesc(JWT_USER);
    }
}
