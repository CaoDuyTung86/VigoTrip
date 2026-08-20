package com.booking.api.ai.llm;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Một nhà cung cấp LLM. Cố ý giữ ở mức "một lời gọi HTTP" chứ không ôm cả vòng lặp
 * function calling: nhờ vậy LlmRouter có thể chạy lại TOÀN BỘ thao tác trên nhà cung
 * cấp khác khi nhà đầu tiên hỏng, thay vì mắc kẹt giữa chừng với các tool_call_id chỉ
 * hợp lệ với nhà cung cấp cũ.
 *
 * Messages/tools dùng thẳng schema OpenAI dạng Map — mọi nhà cung cấp ta nhắm tới
 * (Gemini qua lớp tương thích OpenAI, Groq, OpenRouter) đều nói chung giao thức này.
 */
public interface LlmProvider {

    String name();

    String model();

    int maxTokens();

    double temperature();

    /**
     * Một lượt chat completion. Trả về object "message" thô theo schema OpenAI
     * (có thể chứa "content" hoặc "tool_calls").
     *
     * @throws LlmProviderException khi lời gọi hỏng; {@code retryable} cho biết có nên
     *                              chuyển sang nhà cung cấp khác hay không.
     */
    Map<String, Object> chatCompletion(List<Map<String, Object>> messages,
                                       List<Map<String, Object>> tools,
                                       double temperature,
                                       int maxTokens);

    /** Chat completion dạng stream, đẩy từng mẩu nội dung vào consumer. */
    void streamCompletion(List<Map<String, Object>> messages,
                          double temperature,
                          int maxTokens,
                          Consumer<String> chunkConsumer);
}
