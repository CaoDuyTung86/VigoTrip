package com.booking.api.service;

import com.booking.api.dto.MessageDto;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Trip;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService implements AIService.ToolHandler {

    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final AIService aiService;

    // Giới hạn an toàn
    private static final int MAX_USER_MESSAGE_LENGTH = 500; // ký tự
    private static final int MAX_HISTORY_PAIRS_FRONTEND = 10; // cặp tối đa nhận từ Frontend

    // State Caching cho từng User Session (Caffeine Cache với TTL 30 phút chống rò rỉ bộ nhớ)
    private final com.github.benmanes.caffeine.cache.Cache<String, Map<String, String>> sessionCache = com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
            .expireAfterAccess(30, java.util.concurrent.TimeUnit.MINUTES)
            .maximumSize(2000)
            .build();

    // RAG Knowledge Base với Tiếng Việt & Từ đồng nghĩa (Synonym-aware RAG Engine)
    private static final Map<String, String> FAQ_DB = Map.of(
        "PETS", "Quy định thú cưng: Máy bay không cho phép mang thú cưng lên khoang hành khách. Xe khách cho phép mang thú cưng nhỏ nếu để trong lồng chuyên dụng dưới gầm xe.",
        "CANCEL", "Chính sách hủy vé: Hủy trước 24h khởi hành được hoàn 100%. Hủy trước 12h hoàn 50%. Dưới 12h không được hoàn tiền. Khách hàng truy cập mục [Lịch sử đặt vé] để hủy.",
        "BAGGAGE", "Quy định hành lý: Máy bay bao gồm 7kg xách tay + 20kg ký gửi. Xe khách miễn phí tối đa 20kg/hành khách.",
        "CHILDREN", "Vé trẻ em: Dưới 2 tuổi miễn phí (ngồi cùng người lớn). Từ 2-12 tuổi tính 75% giá vé người lớn.",
        "PAYMENT", "Phương thức thanh toán: Hệ thống hỗ trợ thanh toán trực tuyến qua VNPAY (Thẻ ATM, QR Code, Visa/Mastercard, Ví điện tử).",
        "PROMO", "Mã giảm giá hiện có: WELCOME20 (giảm 20%), SUMMER2026 (giảm 15%), AI_PROMO_10 (giảm 10% độc quyền AI)."
    );

    // Từ điển đồng nghĩa & Không dấu (Synonyms & Normalized Keywords)
    private static final Map<String, List<String>> SYNONYM_MAP = Map.of(
        "PETS", List.of("thú cưng", "thu cung", "chó", "cho", "mèo", "meo", "pet", "động vật", "dong vat", "cún", "cun"),
        "CANCEL", List.of("hủy vé", "huy ve", "trả vé", "tra ve", "đổi vé", "doi ve", "hoàn vé", "hoan ve", "bùng vé", "bung ve", "cancel"),
        "BAGGAGE", List.of("hành lý", "hanh ly", "vali", "xách tay", "xach tay", "ký gửi", "ky gui", "mấy kg", "may kg", "mấy cân", "may can", "luggage", "baggage"),
        "CHILDREN", List.of("trẻ em", "tre em", "em bé", "em be", "bé", "be", "trẻ nhỏ", "tre nho", "baby", "kid", "nhỏ tuổi"),
        "PAYMENT", List.of("thanh toán", "thanh toan", "chuyển khoản", "chuyen khoan", "vnpay", "ví", "vi", "thẻ", "the", "trả tiền", "tra tien", "pay"),
        "PROMO", List.of("khuyến mãi", "khuyen mai", "giảm giá", "giam gia", "voucher", "mã", "ma", "discount", "ưu đãi", "uu dai", "rẻ hơn", "re hon")
    );

    private String removeAccents(String str) {
        if (str == null) return "";
        String nfdNormalizedString = java.text.Normalizer.normalize(str, java.text.Normalizer.Form.NFD);
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        return pattern.matcher(nfdNormalizedString).replaceAll("").replace('đ', 'd').replace('Đ', 'D');
    }

    @Override
    public String executeTool(String functionName, Map<String, Object> arguments) {
        return executeTool(functionName, arguments, "default_session");
    }

    public String executeTool(String functionName, Map<String, Object> arguments, String sessionKey) {
        log.info("Executing Tool: {} with args: {} (sessionKey={})", functionName, arguments, sessionKey);

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.getDefault());
        symbols.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,###", symbols);

        if ("search_trips".equals(functionName)) {
            String origin = arguments != null && arguments.containsKey("origin") ? String.valueOf(arguments.get("origin")) : null;
            String destination = arguments != null && arguments.containsKey("destination") ? String.valueOf(arguments.get("destination")) : null;
            String vehicleType = arguments != null && arguments.containsKey("vehicleType") ? String.valueOf(arguments.get("vehicleType")) : null;
            String dateStr = arguments != null && arguments.containsKey("departureDate") ? String.valueOf(arguments.get("departureDate")) : null;
            String timeSlot = arguments != null && arguments.containsKey("timeSlot") ? String.valueOf(arguments.get("timeSlot")) : null;

            LocalDateTime startOfDay = LocalDateTime.now();
            LocalDateTime endOfDay = LocalDateTime.of(2099, 12, 31, 23, 59, 59);

            if (dateStr != null && !dateStr.isBlank() && !"null".equals(dateStr)) {
                try {
                    java.time.LocalDate date = java.time.LocalDate.parse(dateStr);
                    startOfDay = date.atStartOfDay();
                    endOfDay = date.atTime(23, 59, 59);

                    // Nâng cấp lọc theo khung giờ (Time Slot Filter)
                    if (timeSlot != null && !timeSlot.isBlank() && !"null".equals(timeSlot)) {
                        String ts = timeSlot.toUpperCase();
                        if ("MORNING".equals(ts) || ts.contains("SÁNG") || ts.contains("SANG")) {
                            startOfDay = date.atTime(5, 0, 0);
                            endOfDay = date.atTime(12, 0, 0);
                        } else if ("AFTERNOON".equals(ts) || ts.contains("CHIỀU") || ts.contains("CHIEU") || ts.contains("TRƯA") || ts.contains("TRUA")) {
                            startOfDay = date.atTime(12, 0, 0);
                            endOfDay = date.atTime(18, 0, 0);
                        } else if ("EVENING".equals(ts) || ts.contains("TỐI") || ts.contains("TOI") || ts.contains("ĐÊM") || ts.contains("DEM")) {
                            startOfDay = date.atTime(18, 0, 0);
                            endOfDay = date.atTime(23, 59, 59);
                        } else if ("EARLY_MORNING".equals(ts)) {
                            startOfDay = date.atTime(0, 0, 0);
                            endOfDay = date.atTime(5, 0, 0);
                        } else if (timeSlot.matches("\\d{1,2}:\\d{2}")) {
                            try {
                                java.time.LocalTime targetTime = java.time.LocalTime.parse(timeSlot);
                                startOfDay = date.atTime(targetTime.minusHours(2));
                                endOfDay = date.atTime(targetTime.plusHours(2));
                            } catch (Exception ex) {
                                log.warn("Lỗi parse exact timeSlot: {}", timeSlot);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Lỗi parse ngày: {}", dateStr);
                }
            }

            // Lưu vào State Caching theo sessionKey
            String effectiveKey = (sessionKey != null && !sessionKey.isBlank()) ? sessionKey : "default_session";
            Map<String, String> cache = sessionCache.get(effectiveKey, k -> new java.util.concurrent.ConcurrentHashMap<>());
            if (origin != null && !origin.isBlank() && !"null".equals(origin)) cache.put("origin", origin);
            if (destination != null && !destination.isBlank() && !"null".equals(destination)) cache.put("destination", destination);
            if (dateStr != null && !dateStr.isBlank() && !"null".equals(dateStr)) cache.put("date", dateStr);
            if (timeSlot != null && !timeSlot.isBlank() && !"null".equals(timeSlot)) cache.put("timeSlot", timeSlot);

            List<Trip> trips = tripRepository.searchTripsFlexible(origin, destination, vehicleType, startOfDay, endOfDay,
                    PageRequest.of(0, 4));  // Giới hạn 4 kết quả — tránh bloat token ở lần gọi API 2 (function calling)

            if (trips.isEmpty()) {
                return "Không tìm thấy chuyến đi phù hợp nào trong hệ thống.";
            }

            StringBuilder sb = new StringBuilder();
            sb.append("DANH SÁCH CHUYẾN ĐI TÌM THẤY:\n");
            for (Trip t : trips) {
                String orig = t.getRoute() != null ? t.getRoute().getOrigin() : "N/A";
                String dest = t.getRoute() != null ? t.getRoute().getDestination() : "N/A";
                String time = t.getDepartureTime() != null ? t.getDepartureTime().format(fmt) : "N/A";
                String price = t.getPrice() != null ? df.format(t.getPrice()) : "0";
                String type = t.getVehicle() != null ? t.getVehicle().getVehicleType() : "N/A";
                String provider = t.getVehicle() != null && t.getVehicle().getProvider() != null
                        ? t.getVehicle().getProvider().getProviderName()
                        : "N/A";

                sb.append(String.format("- Tuyến: %s → %s | Hãng: %s | Loại: %s | Giờ đi: %s | Giá: %s VND%n",
                        orig, dest, provider, type, time, price));
            }
            return sb.toString();

        } else if ("get_user_bookings".equals(functionName)) {
            String username = arguments != null && arguments.containsKey("username")
                    ? String.valueOf(arguments.get("username"))
                    : null;
            if (username == null || username.isBlank() || "null".equals(username)) {
                return "Khách hàng chưa đăng nhập nên không có lịch sử đơn hàng.";
            }

            List<Booking> userBookings = bookingRepository.findByUserEmailOrderByBookingDateDesc(username)
                    .stream().limit(5).toList(); // Chỉ lấy 5 booking gần nhất — tránh bloat token
            if (userBookings == null || userBookings.isEmpty()) {
                return "Khách hàng hiện chưa có đơn hàng/vé đã đặt nào.";
            }

            StringBuilder sb = new StringBuilder();
            sb.append("DANH SÁCH VÉ ĐÃ ĐẶT CỦA KHÁCH:\n");
            for (Booking b : userBookings) {
                String status = b.getStatus() != null ? b.getStatus() : "UNKNOWN";
                String bookingTime = b.getBookingDate() != null ? b.getBookingDate().format(fmt) : "N/A";
                String tripOrigin = "N/A";
                String tripDest = "N/A";
                if (b.getTickets() != null && !b.getTickets().isEmpty() && b.getTickets().get(0).getTrip() != null) {
                    tripOrigin = b.getTickets().get(0).getTrip().getRoute().getOrigin();
                    tripDest = b.getTickets().get(0).getTrip().getRoute().getDestination();
                }
                sb.append(String.format(
                        "- Mã đơn: #%s | Tuyến: %s→%s | Ngày đặt: %s | Trạng thái: %s | Tổng tiền: %s VND%n",
                        b.getId(), tripOrigin, tripDest, bookingTime, status, df.format(b.getTotalPrice())));
            }
            return sb.toString();
        }

        return "Công cụ không hợp lệ.";
    }

    private String buildSystemInstruction(String username, String sessionKey, String userMessage) {
        String currentTime = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy"));
        String userContextStr = username != null ? "Email khách hàng hiện tại: " + username
                : "Khách hàng chưa đăng nhập";

        // Retrieve RAG Context (Synonym & Accent-aware RAG Engine)
        StringBuilder ragContext = new StringBuilder();
        if (userMessage != null && !userMessage.isBlank()) {
            String lowerMsg = userMessage.toLowerCase();
            String normalizedMsg = removeAccents(lowerMsg);

            java.util.Set<String> matchedCategories = new java.util.HashSet<>();
            SYNONYM_MAP.forEach((category, synonyms) -> {
                for (String syn : synonyms) {
                    if (lowerMsg.contains(syn) || normalizedMsg.contains(syn)) {
                        matchedCategories.add(category);
                        break;
                    }
                }
            });

            matchedCategories.forEach(cat -> {
                if (FAQ_DB.containsKey(cat)) {
                    ragContext.append("- ").append(FAQ_DB.get(cat)).append("\n");
                }
            });
        }

        // Retrieve State Cache
        StringBuilder cacheContext = new StringBuilder();
        String effectiveKey = (sessionKey != null && !sessionKey.isBlank()) ? sessionKey : "default_session";
        Map<String, String> cache = sessionCache.getIfPresent(effectiveKey);
        if (cache != null && !cache.isEmpty()) {
            cacheContext.append("Khách hàng đang quan tâm tuyến đường: ");
            if (cache.containsKey("origin")) cacheContext.append("Từ ").append(cache.get("origin")).append(" ");
            if (cache.containsKey("destination")) cacheContext.append("Đến ").append(cache.get("destination")).append(" ");
            if (cache.containsKey("date")) cacheContext.append("Ngày ").append(cache.get("date")).append(" ");
            if (cache.containsKey("timeSlot")) cacheContext.append("Giờ: ").append(cache.get("timeSlot"));
            cacheContext.append(". ");
        }

        return "Bạn là Son — trợ lý đặt vé siêu thân thiện và nhiệt tình của Datxe.com. Thời gian hiện tại: "
                + currentTime + ".\n" +
                userContextStr + ".\n" +
                (cacheContext.length() > 0 ? cacheContext.toString() + "\n" : "") +
                "\n" +

                "PHONG CÁCH GIAO TIẾP:\n" +
                "- Nói chuyện như một người bạn thực sự: tự nhiên, xưng hô lịch sự nhưng gần gũi (mình - bạn, Son - bạn), vui vẻ và ấm áp.\n"
                +
                "- Sử dụng các từ đệm tự nhiên như: 'nhé', 'nha', 'thế', 'nè', 'ạ', 'giúp mình'.\n" +
                "- Câu trả lời phải ngắn gọn, súc tích (dưới 120 từ), không giải thích dài dòng lê thê.\n" +
                "- TUYỆT ĐỐI CẤM sử dụng các từ ngữ mang tính kỹ thuật, lộ thông tin hệ thống hoặc data dump như:\n" +
                "  + 'trong danh sách được cung cấp', 'theo danh sách của bạn', 'dữ liệu chuyến đi của chúng tôi'\n" +
                "  + 'không tìm thấy chuyến nào trong cơ sở dữ liệu', 'danh sách chuyến đi hiện có'\n" +
                "  Thay vào đó hãy nói tự nhiên: 'Tiếc quá chặng này hiện Son chưa thấy có chuyến bay nào', 'Hiện tại Son thấy có xe khách chạy tuyến này thôi á, bạn xem thử nha'.\n\n"
                +

                "HƯỚNG DẪN DÙNG CÔNG CỤ (TOOLS):\n" +
                "- Bạn có công cụ `search_trips` để tìm chuyến đi động từ hệ thống. Hãy chủ động gọi công cụ này khi khách hỏi về chuyến đi, tuyến đường, hoặc tìm vé rẻ nhất!\n"
                +
                "- QUAN TRỌNG - Khi gọi `search_trips`, phải dùng MÃ sân bay/ga/bến xe, KHÔNG dùng tên thành phố:\n" +
                "  Hà Nội → HAN | TP.HCM/Sài Gòn/HCM → SGN | Đà Nẵng → DAD | Hải Phòng → HPH\n" +
                "  Huế → HUE | Vinh → VIN | Sapa → SAP | Quy Nhơn → QNH | Nha Trang → NTR | Đà Lạt → DLT\n" +
                "  Ví dụ: 'Hà Nội đi Sài Gòn' → origin='HAN', destination='SGN'\n" +
                "- Bạn có công cụ `get_user_bookings` để tra cứu vé đã đặt của khách. Hãy gọi công cụ này khi khách hỏi về đơn hàng hoặc vé của họ.\n"
                +
                "- Khi khách hỏi tìm vé mà thiếu thông tin (điểm đi, điểm đến, ngày đi) → bạn có thể hỏi thêm điểm đi/đến hoặc gọi `search_trips` với thông tin hiện có.\n\n"
                +

                "KIẾN THỨC VỀ DỊCH VỤ (RAG Context):\n" +
                (ragContext.length() > 0 ? ragContext.toString() : "- Không có FAQ bổ sung.\n") +
                "- Tặng mã giảm giá khi khách hỏi ưu đãi: WELCOME20 (giảm 20%), SUMMER2026 (giảm 15%), AI_PROMO_10 (giảm 10%). Sử dụng cú pháp [VOUCHER: MÃ_VOUCHER].\n\n"
                +

                "ĐIỀU HƯỚNG:\n" +
                "- Đặt vé máy bay: [LINK: Đặt vé máy bay | /ve-may-bay]\n" +
                "- Đặt vé tàu hỏa: [LINK: Đặt vé tàu hỏa | /ve-tau-hoa]\n" +
                "- Đặt vé xe khách: [LINK: Đặt vé xe khách | /xe-khach]\n" +
                "- Lịch sử đặt vé: [LINK: Lịch sử đặt vé | /my-bookings]\n" +
                "- Gợi ý nút lựa chọn nếu cần hỏi thêm: [BTN: Vé máy bay] [BTN: Vé xe khách]\n";
    }

    public String getChatResponse(String userMessage, String username, String sessionKey, List<MessageDto> history) {
        // --- Phòng thủ đầu vào ---
        if (userMessage == null || userMessage.isBlank()) {
            return "Bạn chưa nhập câu hỏi.";
        }
        if (userMessage.length() > MAX_USER_MESSAGE_LENGTH) {
            return "Tin nhắn của bạn quá dài (tối đa 500 ký tự). Vui lòng rút gọn và thử lại.";
        }

        List<MessageDto> safeHistory = new ArrayList<>();
        if (history != null && !history.isEmpty()) {
            int startIndex = Math.max(0, history.size() - MAX_HISTORY_PAIRS_FRONTEND * 2);
            safeHistory = history.subList(startIndex, history.size());
        }

        String effectiveKey = (username != null && !username.isBlank()) ? username : sessionKey;
        String systemInstruction = buildSystemInstruction(username, effectiveKey, userMessage);

        // Pass ToolHandler callback
        return aiService.getChatResponse(systemInstruction, safeHistory, userMessage, (fnName, args) -> {
            if ("get_user_bookings".equals(fnName) && username != null) {
                if (args == null)
                    args = Map.of("username", username);
                else {
                    Map<String, Object> newArgs = new java.util.HashMap<>(args);
                    newArgs.put("username", username);
                    args = newArgs;
                }
            }
            return executeTool(fnName, args, effectiveKey);
        });
    }

    public void streamChatResponse(String userMessage, String username, String sessionKey, List<MessageDto> history,
            java.util.function.Consumer<String> chunkConsumer) {
        if (userMessage == null || userMessage.isBlank()) {
            chunkConsumer.accept("Bạn chưa nhập câu hỏi.");
            return;
        }
        if (userMessage.length() > MAX_USER_MESSAGE_LENGTH) {
            chunkConsumer.accept("Tin nhắn của bạn quá dài (tối đa 500 ký tự). Vui lòng rút gọn và thử lại.");
            return;
        }

        List<MessageDto> safeHistory = new ArrayList<>();
        if (history != null && !history.isEmpty()) {
            int startIndex = Math.max(0, history.size() - MAX_HISTORY_PAIRS_FRONTEND * 2);
            safeHistory = history.subList(startIndex, history.size());
        }

        String effectiveKey = (username != null && !username.isBlank()) ? username : sessionKey;
        String systemInstruction = buildSystemInstruction(username, effectiveKey, userMessage);

        aiService.streamChatResponse(systemInstruction, safeHistory, userMessage, (fnName, args) -> {
            if ("get_user_bookings".equals(fnName) && username != null) {
                if (args == null)
                    args = Map.of("username", username);
                else {
                    Map<String, Object> newArgs = new java.util.HashMap<>(args);
                    newArgs.put("username", username);
                    args = newArgs;
                }
            }
            return executeTool(fnName, args, effectiveKey);
        }, chunkConsumer);
    }
}
