package com.booking.api.ai.embedding;

import java.util.List;

/**
 * Sinh vector embedding cho văn bản.
 *
 * Tách thành interface để test chạy được hoàn toàn offline: HybridRetrieverTest tiêm
 * một bản cài đặt trả vector tất định, không cần API key cũng không cần mạng.
 */
public interface EmbeddingClient {

    /** false khi chưa cấu hình — bên gọi phải lùi về tìm kiếm từ khóa thuần. */
    boolean isAvailable();

    /** Số chiều của vector do client này sinh ra. */
    int dimensions();

    /** Tên model, để lưu kèm chunk nhằm phát hiện khi cần embed lại. */
    String modelName();

    /**
     * Embed nhiều văn bản một lượt. Thứ tự kết quả khớp thứ tự đầu vào.
     *
     * @throws EmbeddingException khi lời gọi thất bại
     */
    List<float[]> embedAll(List<String> texts);

    /** Tiện ích embed một văn bản. */
    default float[] embed(String text) {
        List<float[]> result = embedAll(List.of(text));
        return result.isEmpty() ? null : result.get(0);
    }
}
