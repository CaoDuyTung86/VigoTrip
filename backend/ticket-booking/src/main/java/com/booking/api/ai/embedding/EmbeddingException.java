package com.booking.api.ai.embedding;

/** Sinh embedding thất bại (chưa cấu hình, lỗi mạng, hoặc nhà cung cấp trả lỗi). */
public class EmbeddingException extends RuntimeException {

    public EmbeddingException(String message) {
        super(message);
    }

    public EmbeddingException(String message, Throwable cause) {
        super(message, cause);
    }
}
