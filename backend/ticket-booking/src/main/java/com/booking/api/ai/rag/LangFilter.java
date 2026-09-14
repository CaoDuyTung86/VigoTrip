package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;

import java.util.Locale;

/**
 * Quy tắc lọc chunk theo ngôn ngữ, dùng chung cho cả nhánh từ khóa lẫn nhánh ngữ nghĩa.
 *
 * Gom vào một chỗ vì hai chỉ mục PHẢI hiểu mã ngôn ngữ giống hệt nhau. Nếu một bên coi
 * "EN " khác "en" thì cùng một truy vấn sẽ lọc ở nhánh này mà không lọc ở nhánh kia, và
 * kết quả hợp nhất hai nhánh sẽ lệch theo cách rất khó lần ra.
 */
final class LangFilter {

    private LangFilter() {
    }

    /** Chuẩn hóa mã ngôn ngữ; rỗng, null hay toàn khoảng trắng đều thành null nghĩa là "không lọc". */
    static String normalize(String lang) {
        if (lang == null) {
            return null;
        }
        String value = lang.trim().toLowerCase(Locale.ROOT);
        return value.isEmpty() ? null : value;
    }

    /** true khi chunk thuộc ngôn ngữ đang lọc, hoặc khi không lọc gì cả. */
    static boolean accepts(String normalizedFilter, KnowledgeChunk chunk) {
        return normalizedFilter == null || normalizedFilter.equals(normalize(chunk.getLang()));
    }
}
