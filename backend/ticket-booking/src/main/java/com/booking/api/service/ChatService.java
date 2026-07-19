package com.booking.api.service;

import com.booking.api.dto.MessageDto;
import com.booking.api.entity.Trip;
import com.booking.api.entity.Booking;
import com.booking.api.repository.TripRepository;
import com.booking.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final AIService aiService;

    // Giới hạn an toàn
    private static final int MAX_USER_MESSAGE_LENGTH = 500; // ký tự
    private static final int MAX_HISTORY_PAIRS_FRONTEND = 10; // cặp tối đa nhận từ Frontend

    public String getChatResponse(String userMessage, String username, List<MessageDto> history) {
        // --- Phòng thủ đầu vào ---
        if (userMessage == null || userMessage.isBlank()) {
            return "Bạn chưa nhập câu hỏi.";
        }
        // Giới hạn độ dài tin nhắn
        if (userMessage.length() > MAX_USER_MESSAGE_LENGTH) {
            return "Tin nhắn của bạn quá dài (tối đa 500 ký tự). Vui lòng rút gọn và thử lại.";
        }

        // Sliding window: chỉ lấy tối đa MAX_HISTORY_PAIRS_FRONTEND*2 items từ Frontend
        List<MessageDto> safeHistory = new ArrayList<>();
        if (history != null && !history.isEmpty()) {
            int startIndex = Math.max(0, history.size() - MAX_HISTORY_PAIRS_FRONTEND * 2);
            safeHistory = history.subList(startIndex, history.size());
        }

        // --- Lấy dữ liệu RAG ---
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
        String systemInstruction = "Bạn là Son — trợ lý đặt vé siêu thân thiện và nhiệt tình của Datxe.com. Thời gian hiện tại: "
                + currentTime + ".\n\n" +

                "PHONG CÁCH GIAO TIẾP:\n" +
                "- Nói chuyện như một người bạn thực sự: tự nhiên, xưng hô lịch sự nhưng gần gũi (mình - bạn, Son - bạn), vui vẻ và ấm áp.\n"
                +
                "- Sử dụng các từ đệm tự nhiên như: 'nhé', 'nha', 'thế', 'nè', 'ạ', 'giúp mình'.\n" +
                "- Câu trả lời phải ngắn gọn, súc tích (dưới 120 từ), không giải thích dài dòng lê thê.\n" +
                "- TUYỆT ĐỐI CẤM sử dụng các từ ngữ mang tính kỹ thuật, lộ thông tin hệ thống hoặc data dump như:\n" +
                "  + 'trong danh sách được cung cấp', 'theo danh sách của bạn', 'dữ liệu chuyến đi của chúng tôi'\n" +
                "  + 'không tìm thấy chuyến nào trong cơ sở dữ liệu', 'danh sách chuyến đi hiện có'\n" +
                "  Thay vào đó hãy nói tự nhiên: 'Tiếc quá chặng này hiện mình chưa thấy chuyến bay nào nè', 'Hiện tại mình chỉ thấy có xe khách chạy tuyến này thôi á, bạn xem thử nha'.\n\n"
                +

                "QUY TẮC TÌM KIẾM & HỎI THÔNG TIN:\n" +
                "- Khi khách hàng yêu cầu tìm vé hoặc hỏi vé rẻ nhất (ví dụ: 'Tìm vé máy bay rẻ nhất', 'Có chuyến nào đi Đà Nẵng không?'):\n"
                +
                "  1. KHÔNG được vội vã trả lời ngay là 'Không có chuyến nào'.\n" +
                "  2. Hãy hỏi khách các thông tin còn thiếu để lọc chuyến chính xác: **Điểm đi, Điểm đến, và Ngày đi mong muốn**.\n"
                +
                "  Ví dụ: 'Bạn muốn đi từ đâu đến đâu và đi vào ngày nào để Son tìm vé máy bay rẻ nhất giúp bạn nè?' hoặc 'Bạn đi từ đâu đến Đà Nẵng và đi ngày nào thế?'\n"
                +
                "- Khi khách đã cung cấp đủ thông tin (hoặc thông tin đã rõ ràng trong ngữ cảnh):\n" +
                "  1. Đối chiếu với dữ liệu chuyến đi bên dưới.\n" +
                "  2. Nếu có: Liệt kê tối đa 3 chuyến rẻ nhất/phù hợp nhất và gợi ý họ đặt vé kèm LINK.\n" +
                "  3. Nếu không có phương tiện họ yêu cầu (ví dụ: không có máy bay) nhưng có phương tiện khác (xe khách, tàu hỏa) trên cùng chặng: Gợi ý phương tiện thay thế một cách tinh tế. Ví dụ: 'Tuyến HAN-SGN hiện mình không có chuyến bay nào nhưng có xe khách giường nằm chạy lúc 05:00 giá chỉ 420.000đ nè, bạn có muốn xem thử không?'\n\n"
                +

                "KIẾN THỨC VỀ DỊCH VỤ:\n" +
                "- Hủy vé: Trước 24h hoàn 100%. Từ 4h - 24h: liên hệ hỗ trợ. Dưới 4h: không được hoàn hủy.\n" +
                "- Cách hủy: Vào phần [LINK: Lịch sử đặt vé | /my-bookings] rồi chọn hủy.\n" +
                "- Thanh toán: Cổng VNPAY.\n" +
                "- Hỗ trợ khẩn cấp: Hotline 0397148398.\n" +
                "- Tặng mã giảm giá khi khách hỏi ưu đãi: WELCOME20 (giảm 20% tối đa 100k cho đơn từ 200k), SUMMER2026 (giảm 15% tối đa 200k cho đơn từ 500k), AI_PROMO_10 (giảm 10% tối đa 50k - mã độc quyền AI). Sử dụng cú pháp [VOUCHER: MÃ_VOUCHER].\n\n"
                +

                "ĐIỀU HƯỚNG:\n" +
                "- Đặt vé máy bay: [LINK: Đặt vé máy bay | /ve-may-bay]\n" +
                "- Đặt vé tàu hỏa: [LINK: Đặt vé tàu hỏa | /ve-tau-hoa]\n" +
                "- Đặt vé xe khách: [LINK: Đặt vé xe khách | /xe-khach]\n" +
                "- Lịch sử đặt vé: [LINK: Lịch sử đặt vé | /my-bookings]\n" +
                "- Gợi ý nút lựa chọn nếu cần hỏi thêm: [BTN: Vé máy bay] [BTN: Vé xe khách]\n\n" +

                "DỮ LIỆU CHUYẾN ĐI HỆ THỐNG:\n" +
                contextBuilder.toString() +
                bookingContext.toString();

        return aiService.getChatResponse(systemInstruction, safeHistory, userMessage);
    }
}
