package com.booking.api.service;

import com.booking.api.config.VNPayConfig;
import com.booking.api.dto.PaymentRequest;
import com.booking.api.dto.PaymentResponse;
import com.booking.api.entity.Booking;
import com.booking.api.entity.Payment;
import com.booking.api.entity.User;
import com.booking.api.exception.BookingException;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.repository.BookingRepository;
import com.booking.api.repository.PromotionRepository;
import com.booking.api.repository.UserRepository;
import com.booking.api.util.VNPayUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final PromotionRepository promotionRepository;
    private final VNPayConfig vnPayConfig;
    private final EmailService emailService;

    /**
     * Tạo URL thanh toán VNPay
     */
    public PaymentResponse createVNPayPayment(String email, PaymentRequest request, String ipAddress) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user"));

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        // Kiểm tra booking thuộc user
        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BookingException("Bạn không có quyền thanh toán booking này");
        }

        // Kiểm tra trạng thái booking
        if (!"PENDING".equals(booking.getStatus())) {
            throw new BookingException("Booking đã được thanh toán hoặc hủy");
        }

        // Tạo mã giao dịch nội bộ
        String txnRef = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        // Tính tiền (VNPay yêu cầu nhân 100 vì không dùng dấu thập phân)
        long amount = (long) (booking.getTotalPrice() * 100);

        // Xây dựng VNPay params
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", vnPayConfig.getTmnCode());
        params.put("vnp_Amount", String.valueOf(amount));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", "Thanh_toan_booking_" + booking.getId());
        params.put("vnp_OrderType", "billpayment");
        params.put("vnp_Locale", request.getLanguage() != null ? request.getLanguage() : "vn");
        params.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        params.put("vnp_IpAddr", ipAddress);
        params.put("vnp_CreateDate", VNPayUtil.formatDateTime(LocalDateTime.now()));

        if (request.getBankCode() != null && !request.getBankCode().isBlank()) {
            params.put("vnp_BankCode", request.getBankCode());
        }

        // Tạo hash
        String hashData = VNPayUtil.buildHashData(params);
        String secureHash = VNPayUtil.hmacSHA512(vnPayConfig.getHashSecret(), hashData);

        // Build URL
        String queryString = VNPayUtil.buildQueryString(params);
        String paymentUrl = vnPayConfig.getPayUrl() + "?" + queryString + "&vnp_SecureHash=" + secureHash;

        return new PaymentResponse(paymentUrl, txnRef, "Tạo thanh toán thành công. Chuyển hướng đến VNPay.");
    }

    /**
     * Xử lý callback từ VNPay sau khi thanh toán
     */
    @Transactional
    public String handleVNPayReturn(Map<String, String> params) {
        // Validate hash
        boolean isValid = VNPayUtil.validateHash(params, vnPayConfig.getHashSecret());
        if (!isValid) {
            return "INVALID_SIGNATURE";
        }

        String responseCode = params.get("vnp_ResponseCode");
        Long bookingId = parseBookingId(params.get("vnp_OrderInfo"));

        if (bookingId == null) return "INVALID_ORDER_INFO";

        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) return "BOOKING_NOT_FOUND";

        if ("00".equals(responseCode)) {
            // Only process if still pending to ensure idempotency
            if ("PENDING".equals(booking.getStatus())) {
                processSuccessfulPayment(booking, params);
            }
            return "SUCCESS";
        } else {
            if ("PENDING".equals(booking.getStatus())) {
                booking.setStatus("FAILED");
                bookingRepository.save(booking);
            }
            return "FAILED_" + responseCode;
        }
    }

    /**
     * Xử lý IPN từ VNPay (Server-to-Server)
     */
    @Transactional
    public Map<String, String> handleVNPayIPN(Map<String, String> params) {
        Map<String, String> response = new HashMap<>();
        try {
            // 1. Kiểm tra chữ ký
            if (!VNPayUtil.validateHash(params, vnPayConfig.getHashSecret())) {
                response.put("RspCode", "97");
                response.put("Message", "Invalid Signature");
                return response;
            }

            // 2. Kiểm tra đơn hàng
            Long bookingId = parseBookingId(params.get("vnp_OrderInfo"));
            if (bookingId == null) {
                response.put("RspCode", "01");
                response.put("Message", "Order not found");
                return response;
            }

            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null) {
                response.put("RspCode", "01");
                response.put("Message", "Order not found");
                return response;
            }

            // 3. Kiểm tra số tiền
            long vnpAmount = Long.parseLong(params.get("vnp_Amount"));
            if (vnpAmount != (long) (booking.getTotalPrice() * 100)) {
                response.put("RspCode", "04");
                response.put("Message", "Invalid Amount");
                return response;
            }

            // 4. Kiểm tra trạng thái đơn hàng
            if (!"PENDING".equals(booking.getStatus())) {
                response.put("RspCode", "02");
                response.put("Message", "Order already confirmed");
                return response;
            }

            // 5. Xử lý thanh toán
            String responseCode = params.get("vnp_ResponseCode");
            if ("00".equals(responseCode)) {
                processSuccessfulPayment(booking, params);
            } else {
                booking.setStatus("FAILED");
                bookingRepository.save(booking);
            }

            response.put("RspCode", "00");
            response.put("Message", "Confirm Success");

        } catch (Exception e) {
            response.put("RspCode", "99");
            response.put("Message", "Unknown Error");
        }
        return response;
    }

    private Long parseBookingId(String orderInfo) {
        if (orderInfo == null) return null;
        try {
            String[] parts = orderInfo.split("_");
            return Long.parseLong(parts[parts.length - 1].trim());
        } catch (Exception e) {
            return null;
        }
    }

    private void processSuccessfulPayment(Booking booking, Map<String, String> params) {
        booking.setStatus("CONFIRMED");

        String amountStr = params.get("vnp_Amount");
        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setPaymentMethod("VNPAY");
        payment.setPaymentDate(LocalDateTime.now());
        payment.setAmount(amountStr != null ? Double.parseDouble(amountStr) / 100 : booking.getTotalPrice());
        payment.setPaymentStatus("SUCCESS");

        if (booking.getPayments() == null) {
            booking.setPayments(new java.util.ArrayList<>());
        }
        booking.getPayments().add(payment);

        bookingRepository.save(booking);

        // Tích điểm cho User
        User user = booking.getUser();
        if (user != null) {
            int earnedPoints = (int) (booking.getTotalPrice() / 10000);
            int currentPoints = user.getPoints() == null ? 0 : user.getPoints();
            user.setPoints(currentPoints + earnedPoints);

            String levelName = UserService.getMembershipLevel(user.getPoints());
            if (!"Đồng".equalsIgnoreCase(levelName)) {
                promotionRepository.findByLevelName(levelName)
                        .or(() -> "Kim Cương".equals(levelName) ? promotionRepository.findByLevelName("Kim cương") : Optional.empty())
                        .ifPresent(user::setPromotion);
            }
            userRepository.save(user);
        }

        String seats = booking.getTickets() == null ? "" : booking.getTickets().stream()
                .map(t -> t.getSeat().getSeatNumber())
                .collect(Collectors.joining(", "));

        emailService.sendBookingConfirmation(
                booking.getUser().getEmail(),
                booking.getId(),
                booking.getTotalPrice(),
                seats
        );
    }
}
