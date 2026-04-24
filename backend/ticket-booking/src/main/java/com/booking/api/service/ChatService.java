package com.booking.api.service;

import com.booking.api.entity.Trip;
import com.booking.api.entity.Booking;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    public String getChatResponse(String userMessage, String username) {
        if (geminiApiKey == null || geminiApiKey.trim().isEmpty() || "YOUR_API_KEY_HERE".equals(geminiApiKey)) {
            return "Xin lỗi, API Key của hệ thống AI chưa được cấu hình. Vui lòng liên hệ Admin.";
        }

        Page<Trip> upcomingTripsPage = tripRepository
                .findUpcomingTrips(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")), PageRequest.of(0, 20));
        List<Trip> upcomingTrips = upcomingTripsPage.getContent();

        StringBuilder contextBuilder = new StringBuilder();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        for (Trip trip : upcomingTrips) {
            String origin = trip.getRoute().getOrigin();
            String dest = trip.getRoute().getDestination();
            String time = trip.getDepartureTime() != null ? trip.getDepartureTime().format(fmt) : "N/A";
            String price = trip.getPrice() != null ? df.format(trip.getPrice()) : "0";
            String type = trip.getVehicle().getVehicleType();
            String provider = trip.getVehicle().getProvider() != null ? trip.getVehicle().getProvider()
                    .getProviderName() : "Không rõ";
            contextBuilder.append(String.format("%s→%s | %s | %s | %s | %s VND%n",
                    origin, dest, provider, type, time, price));
        }

        // Lấy lịch sử đặt vé của User (nếu đã đăng nhập)
        StringBuilder bookingContext = new StringBuilder();
        if (username != null) {
            List<Booking> userBookings = bookingRepository.findByUserEmailOrderByBookingDateDesc(username);
            if (userBookings != null && !userBookings.isEmpty()) {
                bookingContext.append("\nDỮ LIỆU ĐƠN HÀNG CỦA KHÁCH (Dùng để trả lời khi khách hỏi vé của họ):\n");
                for (Booking b : userBookings) {
                    String status = b.getStatus() != null ? b.getStatus() : "UNKNOWN";
                    String bookingTime = b.getBookingDate() != null ? b.getBookingDate().format(fmt) : "N/A";
                    String tripOrigin = "N/A";
                    String tripDest = "N/A";
                    if (b.getTickets() != null && !b.getTickets().isEmpty()
                            && b.getTickets().get(0).getTrip() != null) {
                        tripOrigin = b.getTickets().get(0).getTrip().getRoute().getOrigin();
                        tripDest = b.getTickets().get(0).getTrip().getRoute().getDestination();
                    }
                    bookingContext.append(String.format(
                            "- Mã đơn: %s | Tuyến: %s→%s | Ngày đặt: %s | Trạng thái: %s | Tổng tiền: %s VND%n",
                            b.getId(), tripOrigin, tripDest, bookingTime, status, df.format(b.getTotalPrice())));
                }
            }
        }

        String currentTime = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy"));
        String systemInstruction = "Bạn là trợ lý tư vấn thông minh của Datxe.com. Thời gian hiện tại: " + currentTime
                + ".\n\n" +
                "KIẾN THỨC HỆ THỐNG DATXE.COM:\n" +
                "- Hủy/Hoàn vé: Nếu < 4 tiếng trước giờ khởi hành thì KHÔNG được hủy. Nếu > 24 tiếng được hoàn 100%. Khách có thể thao tác tại mục 'Lịch sử đặt vé'.\n" +
                "- Thanh toán: Hiện tại dùng demo của VNPAY.\n" +
                "- Hỗ trợ kỹ thuật: Liên hệ SĐT: 0397148668.\n" +
                "- MÃ GIẢM GIÁ CÓ SẴN (chỉ tặng khi khách HỎI về giảm giá, ưu đãi, khuyến mãi):\n" +
                "  + WELCOME20: Giảm 20% (tối đa 100.000đ, đơn từ 200.000đ)\n" +
                "  + SUMMER2026: Giảm 15% (tối đa 200.000đ, đơn từ 500.000đ)\n" +
                "  + AI_PROMO_10: Giảm 10% (tối đa 50.000đ) — Mã ĐẶC BIỆT chỉ có khi chat với AI\n" +
                "  Khi tặng mã, dùng cú pháp [VOUCHER: MÃ_CODE] để hiển thị đẹp. VD: [VOUCHER: WELCOME20]\n\n" +
                "NGUYÊN TẮC TƯ VẤN:\n" +
                "- Tự nhiên, thân thiện, ngắn gọn (tối đa 150 từ).\n" +
                "- Không bịa thông tin chuyến đi.\n" +
                "- [QUAN TRỌNG VỀ NÚT BẤM]: Nếu hỏi ngược lại khách, gợi ý nút bấm bằng cú pháp [BTN: Tên Nút]. VD: '[BTN: Máy bay] [BTN: Tàu hỏa]'.\n"
                +
                "- [QUAN TRỌNG VỀ ĐIỀU HƯỚNG/LINK]: Nếu khách muốn đi đặt vé, hoặc đi đến trang quản lý, hãy thả Link để họ bấm vào bằng cú pháp [LINK: Tên hiển thị | /đường-dẫn]. "
                +
                "Các đường dẫn có sẵn: Đặt vé máy bay (/ve-may-bay), Tàu hỏa (/ve-tau-hoa), Xe khách (/xe-khach), Lịch sử đặt vé (/my-bookings). "
                +
                "Ví dụ: 'Bạn có thể đặt vé tại đây: [LINK: Đặt vé xe khách | /xe-khach]'\n\n" +
                "VÍ DỤ TRẢ LỜI:\n" +
                "Người dùng: \"Tôi muốn đặt vé từ Hà Nội đi Sài Gòn\"\n" +
                "Trợ lý: \"Hiện có 2 chuyến từ Hà Nội đi Sài Gòn...\n Bạn muốn đi xe gì? [BTN: Máy bay] [BTN: Tàu hỏa]\n Hoặc bạn có thể tự đặt tại:\"\n\n"
                +
                "DỮ LIỆU CHUYẾN ĐI:\n" +
                contextBuilder.toString() +
                bookingContext.toString();

        String url = "https://api.groq.com/openai/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(geminiApiKey);

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemInstruction);

        Map<String, Object> userMessageMap = new HashMap<>();
        userMessageMap.put("role", "user");
        userMessageMap.put("content", userMessage);

        Map<String, Object> body = new HashMap<>();
        body.put("model", "llama-3.3-70b-versatile");
        body.put("messages", List.of(systemMessage, userMessageMap));
        body.put("max_tokens", 1024);
        body.put("temperature", 0.3);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            Map<String, Object> responseBody = response.getBody();

            if (responseBody != null && responseBody.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    return (String) message.get("content");
                }
            }
            return "Xin lỗi, tôi không thể xử lý câu trả lời lúc này.";

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Lỗi HTTP khi gọi Groq API: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 429) {
                return "Hệ thống AI đang bận, vui lòng thử lại sau vài giây nhé! 🥀💔";
            } else if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                return "API Key Groq không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại.";
            } else if (e.getStatusCode().value() == 404) {
                return "Model AI không khả dụng trên Groq. Vui lòng liên hệ Admin.";
            }
            return "Đã có lỗi xảy ra khi kết nối máy chủ AI. Vui lòng thử lại sau.";
        } catch (Exception e) {
            log.error("Lỗi khi gọi Groq API", e);
            return "Đã có lỗi xảy ra khi kết nối với máy chủ AI. Vui lòng thử lại sau.";
        }
    }
}
