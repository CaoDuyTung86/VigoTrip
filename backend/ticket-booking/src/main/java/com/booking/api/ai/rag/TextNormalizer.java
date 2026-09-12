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
     *
     * Chữ Nhật và chữ Trung đi đường riêng, xem {@link #cjkBigrams(String)}.
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
        tokens.addAll(cjkBigrams(str));
        return tokens;
    }

    /**
     * Cắt chữ Nhật và chữ Trung thành cặp ký tự liền nhau (bigram).
     *
     * VÌ SAO CẦN ĐƯỜNG RIÊNG: nhánh Latin ở trên cắt theo {@code [^a-z0-9]+}, nên một
     * câu tiếng Nhật đi qua đó sẽ ra ĐÚNG KHÔNG TOKEN NÀO — chunk tiếng Nhật vô hình
     * với BM25, chỉ còn sống nhờ nhánh ngữ nghĩa.
     *
     * VÌ SAO LÀ BIGRAM CHỨ KHÔNG PHẢI TỪ: tiếng Nhật và tiếng Trung không có dấu cách
     * giữa các từ. Tách từ cho đúng cần từ điển hình thái (MeCab, Kuromoji, Jieba) —
     * thêm vài chục MB phụ thuộc cho một corpus trăm chunk. Bigram ký tự là cách làm
     * chuẩn mực cho đúng tình huống này: "手荷物" cho ra "手荷" và "荷物", câu hỏi chứa
     * "荷物" vẫn khớp được mà không cần biết ranh giới từ nằm ở đâu. Đổi lại có nhiễu —
     * vài cặp cắt ngang ranh giới từ thật — nhưng BM25 chấm theo tần suất nên cặp nhiễu
     * xuất hiện rải rác khắp corpus sẽ tự mất trọng số qua IDF.
     *
     * Dùng NFKC để katakana nửa độ rộng và chữ Latin toàn độ rộng quy về dạng chuẩn.
     * KHÔNG dùng {@link #normalize(String)} ở đây: nó tách rồi bỏ dấu phụ, mà với tiếng
     * Nhật thì dấu đục (゛) là dấu phụ — "が" sẽ biến thành "か", tức là đổi cả âm.
     */
    private static List<String> cjkBigrams(String str) {
        String normalized = Normalizer.normalize(str, Normalizer.Form.NFKC);
        List<String> bigrams = new ArrayList<>();
        List<String> run = new ArrayList<>();

        int i = 0;
        while (i < normalized.length()) {
            int codePoint = normalized.codePointAt(i);
            if (isCjk(codePoint)) {
                run.add(new String(Character.toChars(codePoint)));
            } else {
                flushRun(run, bigrams);
            }
            i += Character.charCount(codePoint);
        }
        flushRun(run, bigrams);
        return bigrams;
    }

    /** Một dãy ký tự CJK liền nhau thành các cặp; dãy chỉ một ký tự thì giữ nguyên ký tự đó. */
    private static void flushRun(List<String> run, List<String> bigrams) {
        if (run.isEmpty()) {
            return;
        }
        if (run.size() == 1) {
            bigrams.add(run.get(0));
        } else {
            for (int i = 0; i + 1 < run.size(); i++) {
                bigrams.add(run.get(i) + run.get(i + 1));
            }
        }
        run.clear();
    }

    /**
     * Ký tự có thuộc phần chữ CJK không.
     *
     * Dùng UnicodeScript thay vì tự liệt khoảng mã: khoảng mã CJK nằm rải rác ở nhiều
     * chỗ và còn được bổ sung qua từng phiên bản Unicode. Hai ngoại lệ phải thêm tay là
     * dấu trường âm ー và dấu lặp 々 — chúng thuộc script COMMON nhưng luôn đi liền
     * trong từ, cắt chúng ra khỏi dãy sẽ băm nhỏ từ một cách vô lý.
     */
    static boolean isCjk(int codePoint) {
        if (codePoint == 'ー' || codePoint == '々' || codePoint == '〆') {
            return true;
        }
        Character.UnicodeScript script = Character.UnicodeScript.of(codePoint);
        return script == Character.UnicodeScript.HAN
                || script == Character.UnicodeScript.HIRAGANA
                || script == Character.UnicodeScript.KATAKANA;
    }

    /** true khi chuỗi có ít nhất một ký tự CJK. Dùng để chọn cách so khớp từ đồng nghĩa. */
    public static boolean containsCjk(String str) {
        if (str == null) {
            return false;
        }
        return str.codePoints().anyMatch(TextNormalizer::isCjk);
    }
}
