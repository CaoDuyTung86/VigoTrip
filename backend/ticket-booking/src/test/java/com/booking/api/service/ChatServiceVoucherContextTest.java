package com.booking.api.service;

import com.booking.api.ai.rag.HybridRetriever;
import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.repository.AdditionalServiceRepository;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.RouteRepository;
import com.booking.api.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Chatbot chỉ được gợi ý những mã giảm giá mà CHÍNH tài khoản đang chat còn dùng được.
 *
 * Trước đây ChatService lấy thẳng voucherRepository.findByIsActiveTrue() nên trợ lý không hề
 * biết mã nào đã hết hạn, hết lượt hay đã được chính khách này dùng rồi: khách dùng hết
 * voucher vẫn được chatbot mời lại đúng những mã đó.
 */
class ChatServiceVoucherContextTest {

    private static final String USER = "khach@example.com";

    private AIService aiService;
    private VoucherService voucherService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        TripRepository tripRepository = mock(TripRepository.class);
        BookingRepository bookingRepository = mock(BookingRepository.class);
        RouteRepository routeRepository = mock(RouteRepository.class);
        HybridRetriever hybridRetriever = mock(HybridRetriever.class);
        aiService = mock(AIService.class);
        voucherService = mock(VoucherService.class);

        when(routeRepository.findDistinctOrigins()).thenReturn(List.of("HAN"));
        when(routeRepository.findDistinctDestinations()).thenReturn(List.of("SGN"));
        when(hybridRetriever.retrieve(anyString())).thenReturn(List.of());

        chatService = new ChatService(tripRepository, bookingRepository, voucherService,
                routeRepository, mock(AdditionalServiceRepository.class),
                aiService, mock(RestTemplate.class), hybridRetriever,
                mock(ChatHistoryService.class), mock(ChatMetricService.class),
                new ChatMessageRefRegistry(24, 50000));
    }

    private VoucherPublicDTO voucher(String code, boolean available, String reason) {
        return VoucherPublicDTO.builder()
                .code(code)
                .discountPercent(20.0)
                .maxDiscountAmount(100000.0)
                .minOrderAmount(200000.0)
                .maxUsage(10)
                .currentUsage(2)
                .startDate(LocalDateTime.now().minusDays(1))
                .expiryDate(LocalDateTime.now().plusDays(30))
                .available(available)
                .unavailableReason(reason)
                .alreadyUsed(!available)
                .build();
    }

    /** Chạy một lượt chat rồi lấy ra system prompt mà ChatService đã dựng. */
    private String captureSystemInstruction(String username) {
        chatService.getChatResponse("cho mình xin mã giảm giá", username, "session-1", List.of(), "vi", null);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(aiService).getChatResponse(captor.capture(), anyList(), anyString(), any());
        return captor.getValue();
    }

    @Test
    @DisplayName("Danh sách voucher được lấy theo đúng tài khoản đang chat")
    void vouchersAreFetchedForTheLoggedInAccount() {
        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of());

        captureSystemInstruction(USER);

        verify(voucherService).getPublicVouchers(null, null, USER);
    }

    @Test
    @DisplayName("Mã khách đã dùng bị xếp sang nhóm CẤM gợi ý, không nằm trong nhóm dùng được")
    void usedVoucherIsNotOfferedAgain() {
        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of(
                voucher("CONDUNGDUOC", true, null),
                voucher("DADUNGROI", false, "Bạn đã dùng mã này rồi (mỗi mã chỉ dùng được 1 lần).")));

        String prompt = captureSystemInstruction(USER);

        int usableSection = prompt.indexOf("MÃ KHÁCH ĐANG DÙNG ĐƯỢC");
        int blockedSection = prompt.indexOf("MÃ KHÔNG DÙNG ĐƯỢC");
        assertThat(usableSection).isGreaterThan(-1);
        assertThat(blockedSection).isGreaterThan(usableSection);

        // Mã còn dùng được nằm ở nhóm trên, mã đã dùng chỉ xuất hiện ở nhóm cấm bên dưới.
        assertThat(prompt.indexOf("CONDUNGDUOC")).isBetween(usableSection, blockedSection);
        assertThat(prompt.indexOf("DADUNGROI")).isGreaterThan(blockedSection);
        assertThat(prompt).contains("mỗi mã chỉ dùng được 1 lần");
    }

    @Test
    @DisplayName("Dùng hết voucher: prompt cấm gợi ý bất kỳ mã nào thay vì đọc lại danh sách cũ")
    void noUsableVoucherLeavesNoCodeToOffer() {
        when(voucherService.getPublicVouchers(any(), any(), any())).thenReturn(List.of(
                voucher("DADUNGROI", false, "Bạn đã dùng mã này rồi (mỗi mã chỉ dùng được 1 lần).")));

        String prompt = captureSystemInstruction(USER);

        assertThat(prompt).doesNotContain("MÃ KHÁCH ĐANG DÙNG ĐƯỢC");
        assertThat(prompt).contains("KHÔNG CÒN MÃ NÀO DÙNG ĐƯỢC");
        assertThat(prompt).contains("/uu-dai");
    }

    @Test
    @DisplayName("Khách chưa đăng nhập: vẫn xem được mã còn hiệu lực kèm lời nhắc đăng nhập")
    void guestGetsGenericListWithLoginHint() {
        when(voucherService.getPublicVouchers(any(), any(), any()))
                .thenReturn(List.of(voucher("CONDUNGDUOC", true, null)));

        String prompt = captureSystemInstruction(null);

        verify(voucherService).getPublicVouchers(null, null, null);
        assertThat(prompt).contains("CONDUNGDUOC");
        assertThat(prompt).contains("Khách chưa đăng nhập");
    }

    @Test
    @DisplayName("Mỗi mã được nêu kèm điều kiện admin đặt ra: đơn tối thiểu, số lượt còn lại, hạn dùng")
    void voucherConditionsAreSpelledOut() {
        when(voucherService.getPublicVouchers(any(), any(), any()))
                .thenReturn(List.of(voucher("CONDUNGDUOC", true, null)));

        String prompt = captureSystemInstruction(USER);

        assertThat(prompt).contains("đơn tối thiểu 200.000 VND");
        assertThat(prompt).contains("còn 8 lượt");
        assertThat(prompt).contains("hạn dùng ");
        // Danh sách trong prompt chưa đối chiếu giá trị đơn hàng nên phải nói rõ điều đó,
        // nếu không trợ lý sẽ khẳng định chắc nịch một mã mà khách chưa đủ điều kiện dùng.
        assertThat(prompt).contains("check_voucher");
    }

    @Test
    @DisplayName("check_voucher: biết tổng tiền thì trả lời chính xác số tiền được giảm")
    void checkVoucherWithOrderAmountReturnsExactDiscount() {
        when(voucherService.validateVoucherForUser(anyString(), any(), any(), anyString()))
                .thenReturn(Map.of("valid", true, "discountAmount", new BigDecimal("150000")));

        String answer = chatService.executeTool("check_voucher",
                Map.of("code", "VIP50", "orderAmount", "300.000 VND", "username", USER), "session-1");

        ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
        verify(voucherService).validateVoucherForUser(eq("VIP50"), amount.capture(), eq(null), eq(USER));
        assertThat(amount.getValue()).isEqualByComparingTo("300000");
        assertThat(answer).contains("ÁP DỤNG ĐƯỢC").contains("150.000");
    }

    @Test
    @DisplayName("check_voucher: đơn chưa đạt tối thiểu thì trả về đúng lý do của luồng đặt vé")
    void checkVoucherRejectsOrderBelowMinimum() {
        when(voucherService.validateVoucherForUser(anyString(), any(), any(), anyString()))
                .thenReturn(Map.of("valid", false,
                        "message", "Đơn hàng tối thiểu 1.000.000 VND để áp dụng mã này."));

        String answer = chatService.executeTool("check_voucher",
                Map.of("code", "VIP50", "orderAmount", "300000", "username", USER), "session-1");

        assertThat(answer).contains("KHÔNG ÁP DỤNG ĐƯỢC");
        assertThat(answer).contains("Đơn hàng tối thiểu 1.000.000 VND");
    }

    @Test
    @DisplayName("check_voucher: chưa biết tổng tiền thì nêu điều kiện chứ không kết luận bừa")
    void checkVoucherWithoutOrderAmountOnlyStatesConditions() {
        when(voucherService.getPublicVouchers(any(), any(), any()))
                .thenReturn(List.of(voucher("VIP50", true, null)));

        String answer = chatService.executeTool("check_voucher",
                Map.of("code", "vip50", "username", USER), "session-1");

        assertThat(answer).contains("đơn tối thiểu 200.000 VND");
        assertThat(answer).contains("CHƯA BIẾT tổng tiền");
        verify(voucherService, never()).validateVoucherForUser(anyString(), any(), any(), anyString());
    }

    @Test
    @DisplayName("check_voucher: mã khách đã dùng thì báo ngay lý do, không cần tổng tiền")
    void checkVoucherReportsUsedCode() {
        when(voucherService.getPublicVouchers(any(), any(), any()))
                .thenReturn(List.of(voucher("DADUNGROI", false,
                        "Bạn đã dùng mã này rồi (mỗi mã chỉ dùng được 1 lần).")));

        String answer = chatService.executeTool("check_voucher",
                Map.of("code", "DADUNGROI", "username", USER), "session-1");

        assertThat(answer).contains("KHÔNG dùng được");
        assertThat(answer).contains("mỗi mã chỉ dùng được 1 lần");
    }

    @Test
    @DisplayName("Số tiền model gửi lên được đọc đúng dù viết kiểu nào; không đọc được thì trả null")
    void moneyParsingToleratesModelFormatting() {
        assertThat(ChatService.parseMoney("300000")).isEqualByComparingTo("300000");
        assertThat(ChatService.parseMoney("1.200.000 VND")).isEqualByComparingTo("1200000");
        assertThat(ChatService.parseMoney("300k")).isEqualByComparingTo("300000");
        assertThat(ChatService.parseMoney("2 triệu")).isEqualByComparingTo("2000000");
        // Không có số nào: phải là null để người gọi biết là CHƯA có ngữ cảnh đơn hàng,
        // tuyệt đối không được hiểu thành đơn 0 đồng rồi kết luận mã không dùng được.
        assertThat(ChatService.parseMoney("")).isNull();
        assertThat(ChatService.parseMoney("null")).isNull();
        assertThat(ChatService.parseMoney("chưa biết")).isNull();
    }
}
