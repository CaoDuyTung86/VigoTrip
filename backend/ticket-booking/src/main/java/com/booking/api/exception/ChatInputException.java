package com.booking.api.exception;

/**
 * Lượt hỏi bị từ chối TRƯỚC khi gọi model: chưa nhập gì, quá dài, hoặc chưa qua CAPTCHA.
 *
 * Tách hẳn khỏi luồng nội dung là có chủ đích. Trước đây những câu này được đẩy xuống
 * client y như một mẩu câu trả lời bình thường, nên giao diện không có cách nào phân
 * biệt: nó gắn id/ref cho bong bóng "Captcha verification failed.", mời người dùng chấm
 * điểm chính câu thông báo lỗi đó, rồi đẩy luôn nó vào ngữ cảnh gửi lên model ở lượt sau.
 *
 * {@code code} là mã máy đọc, không phải câu chữ hiển thị: phần chữ do client dịch theo
 * ngôn ngữ đang chọn. Đặt tiếng Việt sẵn ở đây thì người dùng giao diện tiếng Nhật vẫn
 * nhận tiếng Việt.
 */
public class ChatInputException extends RuntimeException {

    /** Chưa nhập câu hỏi. */
    public static final String EMPTY_MESSAGE = "EMPTY_MESSAGE";
    /** Vượt quá giới hạn ký tự của một lượt hỏi. */
    public static final String MESSAGE_TOO_LONG = "MESSAGE_TOO_LONG";
    /** Khách vãng lai chưa qua Turnstile, hoặc token đã hết hạn / đã dùng rồi. */
    public static final String CAPTCHA_REQUIRED = "CAPTCHA_REQUIRED";

    private final String code;

    public ChatInputException(String code) {
        super(code);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
