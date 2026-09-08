package com.booking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private Long id;
    private LocalDateTime bookingDate;
    private BigDecimal totalPrice;
    private String status;

    // Trip info
    private String origin;
    private String destination;
    private LocalDateTime departureTime;
    private LocalDateTime arrivalTime;
    private String vehicleType;
    private String providerName;

    // Người liên hệ của đơn — nơi vé và thông báo chuyến đi được gửi tới
    private String contactName;
    private String contactEmail;
    private String contactPhone;

    // Seats
    private List<String> seatNumbers;

    // Ticket details (passenger name + seat)
    private List<TicketDetail> ticketDetails;

    /**
     * Dịch vụ bổ sung của đơn: mỗi phần tử gồm MÃ và tên tiếng Việt.
     *
     * <p>Trước đây chỉ là {@code List<String>} tên tiếng Việt, nên màn hình "Vé của tôi" chỉ
     * có chữ Việt để hiển thị: khách xem bản English đọc được mọi thứ trừ đúng dòng
     * "Services: Bảo hiểm du lịch cao cấp, Taxi đưa đón sân bay (Xanh SM)...". Có mã thì
     * frontend tra được bảng dịch, và vẫn còn tên để rơi về khi gặp dòng chưa có mã.
     */
    private List<ServiceRef> additionalServices;

    // Refund
    private BigDecimal refundAmount;

    // Refund status (for checking pending refund requests)
    private String refundStatus;

    private Boolean isCheckedIn;
    private LocalDateTime checkInDate;
    private Boolean noShow;
    private Boolean hasReviewed;

    /** Một dịch vụ bổ sung đã mua. {@code code} có thể null với dòng ngoài danh mục seed. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceRef {
        private String code;
        private String name;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TicketDetail {
        private Long ticketId;
        private String passengerName;
        private String seatNumber;
        private String seatType;
        private BigDecimal price;
        private String status;
    }
}
