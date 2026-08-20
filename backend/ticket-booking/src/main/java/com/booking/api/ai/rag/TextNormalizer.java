package com.booking.api.ai.rag;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Chuẩn hóa văn bản tiếng Việt cho nhánh tìm kiếm từ khóa.
 *
 * Tách ra từ ChatService (trước đây là method private removeAccents) để cả
 * LexicalIndex lẫn phần mở rộng từ đồng nghĩa dùng chung đúng một cách chuẩn hóa —
 * nếu index và truy vấn chuẩn hóa khác nhau thì sẽ không bao giờ khớp.
 *
 * Người Việt gõ không dấu rất phổ biến ("thu cung", "huy ve"), nên bỏ dấu là bắt buộc
 * chứ không phải tối ưu thêm.
 */
public final class TextNormalizer {

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
    private static final Pattern DIGIT_THEN_LETTER = Pattern.compile("(\\d)([a-z])");
    private static final Pattern LETTER_THEN_DIGIT = Pattern.compile("([a-z])(\\d)");

    private TextNormalizer() {
    }

    /** Bỏ dấu tiếng Việt và quy đổi đ/Đ về d. */
    public static String removeAccents(String str) {
        if (str == null) {
            return "";
        }
        String nfd = Normalizer.normalize(str, Normalizer.Form.NFD);
        return COMBINING_MARKS.matcher(nfd).replaceAll("")
                .replace('đ', 'd')
                .replace('Đ', 'D');
    }

    /** Chuẩn hóa đầy đủ: thường hóa + bỏ dấu. Dùng cho so khớp chuỗi con. */
    public static String normalize(String str) {
        return removeAccents(str == null ? "" : str.toLowerCase());
    }

    /**
     * Tách thành token đã chuẩn hóa cho BM25. Bỏ token 1 ký tự: tiếng Việt có từ đơn
     * một âm tiết nhưng khi đã bỏ dấu thì token 1 ký tự hầu như chỉ là nhiễu.
     */
    public static List<String> tokenize(String str) {
        List<String> tokens = new ArrayList<>();
        if (str == null || str.isBlank()) {
            return tokens;
        }
        // Tách ranh giới chữ-số để "7kg" thành "7 kg". Không tách thì tài liệu ghi
        // "20kg" sẽ không bao giờ khớp câu hỏi "mang được bao nhiêu kg" — lỗi này đã
        // được bộ đo rag-eval.yml phát hiện.
        String normalized = normalize(str);
        normalized = DIGIT_THEN_LETTER.matcher(normalized).replaceAll("$1 $2");
        normalized = LETTER_THEN_DIGIT.matcher(normalized).replaceAll("$1 $2");

        for (String token : NON_ALPHANUMERIC.split(normalized)) {
            if (token.length() > 1) {
                tokens.add(token);
            }
        }
        return tokens;
    }
}
