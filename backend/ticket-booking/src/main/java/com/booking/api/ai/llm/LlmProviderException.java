package com.booking.api.ai.llm;

/**
 * Lỗi từ một nhà cung cấp LLM.
 *
 * {@code retryable} chỉ trả lời MỘT câu hỏi hẹp: có nên thử lại trên CHÍNH nhà cung
 * cấp này không? Đúng với 429, 5xx, timeout, lỗi mạng — những lỗi thoáng qua. Sai với
 * 4xx còn lại, vì gửi lại đúng request đó cho đúng endpoint đó chỉ nhận lại đúng lỗi đó.
 *
 * Nó KHÔNG quyết định có chuyển sang nhà cung cấp khác hay không — LlmRouter luôn
 * chuyển. Bản đầu tiên của lớp này gộp hai quyết định làm một và coi 4xx là "lỗi phía
 * ta nên đổi nhà cũng vô ích". Một phép thử chạy thật đã bác bỏ điều đó: Gemini trả
 * HTTP 400 (không phải 401) khi API key sai, nên một key hỏng làm sập toàn bộ chatbot
 * dù Groq vẫn khỏe và đã cấu hình. Lỗi xác thực, hạn mức và tên model đều là chuyện
 * RIÊNG của từng nhà cung cấp; không thể suy ra "request của ta sai" chỉ từ mã trạng thái.
 */
public class LlmProviderException extends RuntimeException {

    private final transient String providerName;
    private final boolean retryable;
    private final Integer statusCode;

    public LlmProviderException(String providerName, String message, boolean retryable, Integer statusCode,
                                Throwable cause) {
        super(message, cause);
        this.providerName = providerName;
        this.retryable = retryable;
        this.statusCode = statusCode;
    }

    public String getProviderName() {
        return providerName;
    }

    public boolean isRetryable() {
        return retryable;
    }

    public Integer getStatusCode() {
        return statusCode;
    }
}
