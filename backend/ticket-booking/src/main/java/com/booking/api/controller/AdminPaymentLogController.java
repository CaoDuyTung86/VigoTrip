package com.booking.api.controller;

import com.booking.api.dto.PaymentLogResponse;
import com.booking.api.entity.PaymentLog;
import com.booking.api.exception.BookingException;
import com.booking.api.service.PaymentLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Tra cứu nhật ký giao dịch cho người vận hành.
 *
 * CỐ Ý CHỈ CÓ TRA CỨU, KHÔNG CÓ DUYỆT DANH SÁCH. Đây là quyết định về bề mặt tấn công chứ
 * không phải chuyện tiết kiệm công: bảng này giữ 180 ngày lịch sử tiền nong, và trước khi
 * có màn hình thì muốn đọc nó phải có thông tin đăng nhập cơ sở dữ liệu — một nhóm rất nhỏ.
 * Mở ra web là hạ nó xuống thành "ai có phiên quản trị", cộng thêm mọi đường mất phiên
 * thường gặp (mất mật khẩu, XSS lấy token trong localStorage).
 *
 * Bắt buộc phải biết TRƯỚC mã giao dịch hoặc mã đơn là thứ giữ cho việc mở ra đó không
 * thành một cái vòi tải dữ liệu: mã giao dịch do chính khách khiếu nại cung cấp, nên người
 * chiếm được tài khoản quản trị cũng không lướt và không tải trọn được lịch sử. Đừng thêm
 * endpoint liệt kê vào đây vì "cho tiện" — tiện lợi đó không có ai đòi, còn cái mất thì có.
 *
 * Quyền: nằm dưới /api/admin/** nên SecurityConfig đã bắt ROLE_ADMIN. Ở đó còn một dòng
 * khai báo riêng cho đúng đường dẫn này, để nếu sau này ai nới lỏng luật chung thì endpoint
 * này không âm thầm nới theo.
 */
@RestController
@RequestMapping("/api/admin/payment-logs")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin - Nhật ký giao dịch", description = "Tra cứu dấu vết thanh toán khi có tranh chấp")
public class AdminPaymentLogController {

    private final PaymentLogService paymentLogService;

    @Operation(summary = "Tra cứu nhật ký theo mã giao dịch hoặc mã đơn",
            description = "Phải truyền ĐÚNG MỘT trong hai tham số. Không có đường liệt kê toàn bộ.")
    @GetMapping
    public List<PaymentLogResponse> lookup(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String transactionRef,
            @RequestParam(required = false) Long bookingId) {

        boolean hasTxnRef = transactionRef != null && !transactionRef.isBlank();
        boolean hasBookingId = bookingId != null;

        if (hasTxnRef == hasBookingId) {
            throw new BookingException(
                    "Cần đúng một trong hai: mã giao dịch (transactionRef) hoặc mã đơn (bookingId).");
        }

        // Ghi lại việc TRA CỨU, không chỉ việc thay đổi. Đây là dữ liệu tiền nong của người
        // khác; biết ai đã xem nó, xem của ai, là một phần của việc mở nó ra web — nếu tài
        // khoản quản trị bị chiếm thì đây là chỗ duy nhất còn dấu.
        log.info("[NhatKyThanhToan] {} tra cứu {}={}",
                userDetails.getUsername(),
                hasTxnRef ? "transactionRef" : "bookingId",
                hasTxnRef ? transactionRef : bookingId);

        List<PaymentLog> entries = hasTxnRef
                ? paymentLogService.findByTransactionRef(transactionRef)
                : paymentLogService.findByBookingId(bookingId);

        return entries.stream().map(PaymentLogResponse::from).toList();
    }
}
