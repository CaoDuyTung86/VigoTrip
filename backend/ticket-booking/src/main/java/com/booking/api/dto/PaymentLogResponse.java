package com.booking.api.dto;

import com.booking.api.entity.PaymentLog;

import java.time.LocalDateTime;

/**
 * Một dòng nhật ký giao dịch, dạng đưa ra ngoài API.
 *
 * Có DTO riêng thay vì trả thẳng entity vì hai lý do đều liên quan tới an toàn: entity đi
 * thẳng ra ngoài thì mọi cột thêm vào sau này tự động lộ theo mà không ai phải quyết định
 * gì, và nó kéo theo cả trạng thái JPA của đối tượng. Ở đây danh sách trường là một lựa
 * chọn có ý thức, đọc một lần là biết những gì đang được đưa ra.
 */
public record PaymentLogResponse(
        Long id,
        LocalDateTime createdAt,
        String channel,
        Long bookingId,
        String transactionRef,
        Boolean signatureValid,
        String outcome,
        String sourceIp,
        String actor,
        String requestPayload,
        String responsePayload) {

    public static PaymentLogResponse from(PaymentLog log) {
        return new PaymentLogResponse(
                log.getId(),
                log.getCreatedAt(),
                log.getChannel() == null ? null : log.getChannel().name(),
                log.getBookingId(),
                log.getTransactionRef(),
                log.getSignatureValid(),
                log.getOutcome(),
                log.getSourceIp(),
                log.getActor(),
                log.getRequestPayload(),
                log.getResponsePayload());
    }
}
