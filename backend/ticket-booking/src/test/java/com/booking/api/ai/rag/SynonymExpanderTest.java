package com.booking.api.ai.rag;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bảng từ đồng nghĩa tách theo ngôn ngữ, và phép so khớp theo ranh giới từ.
 *
 * Hai thứ này đi cùng nhau nên kiểm cùng chỗ: tách bảng mà vẫn khớp chuỗi con thì một
 * câu hỏi tiếng Anh vẫn dính khóa tiếng Việt nằm lọt trong từ khác.
 */
class SynonymExpanderTest {

    @Test
    @DisplayName("Câu hỏi tiếng Việt được mở rộng bằng bảng tiếng Việt")
    void expandsVietnameseQuery() {
        List<String> tokens = SynonymExpander.expand("cho tôi hỏi mang được mấy cân hành lý", "vi");

        assertThat(tokens).contains("hanh", "ly", "vali", "kg");
    }

    @Test
    @DisplayName("Câu hỏi tiếng Anh chỉ nhận từ đồng nghĩa tiếng Anh")
    void expandsEnglishQueryWithoutVietnameseTokens() {
        List<String> tokens = SynonymExpander.expand("how heavy can my suitcase be", "en");

        assertThat(tokens).contains("baggage", "luggage");
        assertThat(tokens)
                .as("chỉ mục đã bị lọc chỉ còn chunk tiếng Anh, nhét từ khóa tiếng Việt "
                        + "vào truy vấn thì không khớp được gì")
                .doesNotContain("hanh", "ly");
    }

    @Test
    @DisplayName("Bảng tiếng Anh nối được các biến thể mà BM25 không tự nối")
    void coversEnglishMorphology() {
        // BM25 ở đây so khớp mặt chữ: "cancel" không tự khớp "cancellation".
        assertThat(SynonymExpander.expand("i want to cancel", "en"))
                .contains("cancellation", "refund");
        assertThat(SynonymExpander.expand("i already paid", "en"))
                .contains("payment");
    }

    @Test
    @DisplayName("Khớp theo ranh giới từ: khóa nằm lọt trong từ khác thì không tính")
    void matchesWholeWordsOnly() {
        // "chọn" bỏ dấu thành "chon", có chứa "cho" — khóa thú cưng. Khớp chuỗi con sẽ
        // nhét cả đống từ về chó mèo vào một câu hỏi chỉ nói chuyện chọn ghế.
        assertThat(SynonymExpander.expand("chọn ghế xong bao lâu phải trả tiền", "vi"))
                .doesNotContain("meo");

        // "cùng" bỏ dấu thành "cung", chứa khóa "cun".
        assertThat(SynonymExpander.expand("lưu thông tin người đi cùng", "vi"))
                .doesNotContain("meo");

        // Còn khi đúng là một từ thì vẫn phải khớp: "chó" là khóa thật, không phải
        // mảnh vỡ của từ khác.
        assertThat(SynonymExpander.expand("tôi mang theo con chó", "vi"))
                .contains("thu", "cung");
    }

    @Test
    @DisplayName("Ngôn ngữ chưa có bảng riêng thì áp mọi bảng")
    void unknownLanguageUsesEveryTable() {
        // Ngôn ngữ lạ cũng không bị lọc chỉ mục, nên truy vấn được với sang mọi kho từ.
        assertThat(SynonymExpander.expand("hành lý baggage", "fr"))
                .contains("vali", "luggage");
        assertThat(SynonymExpander.expand("hành lý baggage", null))
                .contains("vali", "luggage");
    }

    @Test
    @DisplayName("Khóa tiếng Nhật và tiếng Trung khớp theo chuỗi con, vì không có dấu cách")
    void matchesCjkKeysAsSubstrings() {
        // 「犬を連れて行けますか」 không có ranh giới từ nào để dựa vào.
        assertThat(SynonymExpander.expand("犬を連れて行けますか", "ja"))
                .contains("ペッ", "ット", "動物");
        assertThat(SynonymExpander.expand("可以带狗上车吗", "zh"))
                .contains("宠物", "动物");
    }

    @Test
    @DisplayName("Câu hỏi tiếng Nhật không nhận từ đồng nghĩa của ngôn ngữ khác")
    void japaneseQueryStaysInJapaneseTable() {
        assertThat(SynonymExpander.expand("ペットを連れて行けますか", "ja"))
                .doesNotContain("thu", "cung", "pets");
    }

    @Test
    @DisplayName("Giữ token gốc, không lặp token")
    void keepsOriginalTokensWithoutDuplicates() {
        List<String> tokens = SynonymExpander.expand("hủy vé hoàn tiền", "vi");

        assertThat(tokens).startsWith("huy", "ve", "hoan", "tien");
        assertThat(tokens).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("Truy vấn rỗng trả về rỗng, không ném lỗi")
    void handlesBlankQuery() {
        assertThat(SynonymExpander.expand("", "vi")).isEmpty();
        assertThat(SynonymExpander.expand(null, "en")).isEmpty();
    }
}
