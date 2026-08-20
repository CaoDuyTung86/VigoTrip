package com.booking.api.ai.llm;

/**
 * Loại tác vụ LLM. Mỗi loại có chuỗi nhà cung cấp riêng trong cấu hình
 * (llm.tasks.chat, llm.tasks.analysis) vì yêu cầu rất khác nhau:
 * chat cần độ trễ thấp và hỗ trợ function calling, còn analysis cần
 * cửa sổ ngữ cảnh lớn và chấp nhận chậm hơn.
 */
public enum LlmTask {
    CHAT,
    ANALYSIS
}
