package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nhánh BM25 là đường lui khi không có embedding, nên nó phải tự đứng vững —
 * đặc biệt với cách người Việt gõ thật: không dấu và dùng tiếng lóng.
 */
class LexicalIndexTest {

    private LexicalIndex index;

    private static KnowledgeChunk chunk(long id, String docId, String title, String content) {
        return KnowledgeChunk.builder()
                .id(id).docId(docId).title(title).content(content)
                .lang("vi").active(true)
                .build();
    }

    @BeforeEach
    void setUp() {
        index = new LexicalIndex();
        index.load(List.of(
                chunk(1, "pets-bus", "Mang thú cưng lên xe khách",
                        "Xe khách cho phép mang theo thú cưng nhỏ như chó, mèo, cún với điều kiện "
                                + "phải để trong lồng chuyên dụng và xếp ở khoang hành lý dưới gầm xe."),
                chunk(2, "baggage-plane", "Quy định hành lý máy bay",
                        "Vé máy bay tiêu chuẩn bao gồm 7kg hành lý xách tay và 20kg hành lý ký gửi."),
                chunk(3, "cancel-policy", "Chính sách hủy vé và mức hoàn tiền",
                        "Hủy vé trước giờ khởi hành trên 24 giờ được hoàn 100 phần trăm tiền vé. "
                                + "Hủy dưới 12 giờ sẽ không được hoàn tiền."),
                chunk(4, "payment-methods", "Các phương thức thanh toán được hỗ trợ",
                        "Hệ thống thanh toán trực tuyến qua cổng VNPAY, hỗ trợ thẻ ATM nội địa và quét mã QR.")));
    }

    private List<String> docIdsFor(String query) {
        return index.search(query, 3).stream().map(s -> s.chunk().getDocId()).toList();
    }

    @Test
    @DisplayName("Truy vấn có dấu khớp đúng chunk")
    void matchesAccentedQuery() {
        assertThat(docIdsFor("quy định hành lý máy bay")).first().isEqualTo("baggage-plane");
    }

    @Test
    @DisplayName("Truy vấn KHÔNG dấu khớp cùng chunk như truy vấn có dấu")
    void matchesUnaccentedQuery() {
        // Người Việt gõ không dấu rất phổ biến — đây là đường đi chính, không phải ngoại lệ.
        assertThat(docIdsFor("quy dinh hanh ly may bay")).first().isEqualTo("baggage-plane");
        assertThat(docIdsFor("thu cung")).first().isEqualTo("pets-bus");
    }

    @Test
    @DisplayName("Tiếng lóng khớp được nhờ mở rộng từ đồng nghĩa")
    void matchesSlangViaSynonymExpansion() {
        // "bùng vé" không hề xuất hiện trong nội dung chunk nào.
        assertThat(docIdsFor("bùng vé thì sao")).contains("cancel-policy");
        // "mấy cân" cũng vậy.
        assertThat(docIdsFor("được mang mấy cân")).contains("baggage-plane");
    }

    @Test
    @DisplayName("Giống chó cụ thể khớp được chunk thú cưng")
    void matchesSpecificDogBreed() {
        // "poodle" không có trong corpus, chỉ tới được qua bảng đồng nghĩa.
        assertThat(docIdsFor("tôi xách theo con poodle nhỏ có sao không")).contains("pets-bus");
    }

    @Test
    @DisplayName("Truy vấn không liên quan không trả về gì")
    void returnsNothingForUnrelatedQuery() {
        assertThat(index.search("blockchain cryptocurrency mining", 3)).isEmpty();
    }

    @Test
    @DisplayName("Tôn trọng giới hạn topK")
    void respectsTopK() {
        assertThat(index.search("vé", 2)).hasSizeLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Index rỗng trả về danh sách rỗng, không ném lỗi")
    void emptyIndexReturnsEmpty() {
        LexicalIndex empty = new LexicalIndex();
        empty.load(List.of());

        assertThat(empty.search("bất kỳ", 5)).isEmpty();
        assertThat(empty.size()).isZero();
    }

    @Test
    @DisplayName("Truy vấn rỗng hoặc null không làm sập")
    void handlesBlankQuery() {
        assertThat(index.search("", 3)).isEmpty();
        assertThat(index.search(null, 3)).isEmpty();
    }
}
