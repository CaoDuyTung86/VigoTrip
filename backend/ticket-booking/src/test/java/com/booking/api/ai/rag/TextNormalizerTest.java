package com.booking.api.ai.rag;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cách cắt token quyết định nhánh BM25 nhìn thấy gì. Bộ test này chốt hai thứ: nhánh
 * Latin không được đổi hành vi, và chữ CJK phải sinh ra token thay vì biến mất.
 */
class TextNormalizerTest {

    @Test
    @DisplayName("Bỏ dấu tiếng Việt và quy đ về d")
    void normalizesVietnamese() {
        assertThat(TextNormalizer.normalize("Hủy vé Đặt chỗ")).isEqualTo("huy ve dat cho");
    }

    @Test
    @DisplayName("Tách ranh giới chữ-số, bỏ token một ký tự")
    void tokenizesLatin() {
        assertThat(TextNormalizer.tokenize("mang 20kg hành lý"))
                .containsExactly("mang", "20", "kg", "hanh", "ly");
    }

    @Test
    @DisplayName("Chữ Nhật và chữ Trung cắt thành cặp ký tự liền nhau")
    void tokenizesCjkIntoBigrams() {
        // Không có bước này thì cả câu cho ra không token nào và chunk vô hình với BM25.
        assertThat(TextNormalizer.tokenize("手荷物")).containsExactly("手荷", "荷物");
        assertThat(TextNormalizer.tokenize("行李规定")).containsExactly("行李", "李规", "规定");
    }

    @Test
    @DisplayName("Câu hỏi và tài liệu khớp nhau qua bigram dùng chung")
    void queryAndDocumentShareBigrams() {
        // Người hỏi viết "荷物", tài liệu viết "手荷物" — chung bigram 荷物 là đủ để khớp.
        assertThat(TextNormalizer.tokenize("荷物は何キロ"))
                .containsAnyElementsOf(TextNormalizer.tokenize("手荷物の規定"));
    }

    @Test
    @DisplayName("Dãy chỉ một ký tự CJK vẫn thành token")
    void keepsSingleCjkCharacter() {
        // Bộ lọc "bỏ token 1 ký tự" của nhánh Latin không được áp cho chữ Hán: một chữ
        // đứng riêng vẫn là một từ đủ nghĩa.
        assertThat(TextNormalizer.tokenize("犬")).containsExactly("犬");
    }

    @Test
    @DisplayName("Giữ nguyên dấu đục của tiếng Nhật")
    void keepsJapaneseVoicedMarks() {
        // normalize() bỏ dấu phụ để phục vụ tiếng Việt; với tiếng Nhật thì làm vậy sẽ
        // biến が thành か, tức đổi hẳn âm. Nhánh CJK vì thế không đi qua normalize().
        assertThat(TextNormalizer.tokenize("がか")).containsExactly("がか");
        assertThat(TextNormalizer.tokenize("荷物が")).contains("物が");
    }

    @Test
    @DisplayName("Dấu trường âm và dấu lặp nằm trong cùng một dãy")
    void keepsProlongedAndIterationMarks() {
        assertThat(TextNormalizer.tokenize("カード")).containsExactly("カー", "ード");
        assertThat(TextNormalizer.tokenize("各々")).containsExactly("各々");
    }

    @Test
    @DisplayName("Katakana nửa độ rộng quy về dạng chuẩn")
    void normalizesHalfWidthKatakana() {
        assertThat(TextNormalizer.tokenize("ﾍﾟｯﾄ")).isEqualTo(TextNormalizer.tokenize("ペット"));
    }

    @Test
    @DisplayName("Câu trộn hai hệ chữ cho ra token của cả hai")
    void handlesMixedScripts() {
        List<String> tokens = TextNormalizer.tokenize("VNPAYで支払う");

        assertThat(tokens).contains("vnpay");
        assertThat(tokens).contains("支払");
    }

    @Test
    @DisplayName("Chuỗi rỗng hoặc null trả về rỗng")
    void handlesBlank() {
        assertThat(TextNormalizer.tokenize(null)).isEmpty();
        assertThat(TextNormalizer.tokenize("   ")).isEmpty();
    }
}
