package com.booking.api.ai.llm;

/**
 * Không còn nhà cung cấp LLM nào phục vụ được yêu cầu: chưa cấu hình nhà nào,
 * tất cả đều hỏng, hoặc tất cả đều đang bị circuit breaker tạm loại.
 */
public class LlmUnavailableException extends RuntimeException {

    public LlmUnavailableException(String message) {
        super(message);
    }

    public LlmUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
