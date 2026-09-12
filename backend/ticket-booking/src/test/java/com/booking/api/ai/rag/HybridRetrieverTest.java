package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.ai.embedding.EmbeddingException;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra logic hợp nhất của HybridRetriever với embedding client giả trả vector tất
 * định — chạy hoàn toàn offline, không API key, không mạng.
 *
 * Ba chunk được gán ba vector trực giao nhau, nên "câu hỏi khớp chunk nào" là điều
 * kiểm soát được chính xác thay vì phụ thuộc vào hành vi thật của model.
 */
class HybridRetrieverTest {

    private static final float[] PETS_VECTOR = {1, 0, 0};
    private static final float[] BAGGAGE_VECTOR = {0, 1, 0};
    private static final float[] PAYMENT_VECTOR = {0, 0, 1};

    /** Embedding client giả: tra bảng câu hỏi -> vector, không có thì trả vector 0. */
    private static class StubEmbeddingClient implements EmbeddingClient {
        private final Map<String, float[]> vectors;
        private boolean available = true;
        private boolean throwOnEmbed = false;

        StubEmbeddingClient(Map<String, float[]> vectors) {
            this.vectors = vectors;
        }

        @Override
        public boolean isAvailable() {
            return available;
        }

        @Override
        public int dimensions() {
            return 3;
        }

        @Override
        public String modelName() {
            return "stub-embedding";
        }

        @Override
        public List<float[]> embedAll(List<String> texts) {
            if (throwOnEmbed) {
                throw new EmbeddingException("lỗi giả lập");
            }
            return texts.stream()
                    .map(t -> vectors.getOrDefault(t, new float[]{0, 0, 0}))
                    .toList();
        }
    }

    private KnowledgeChunkRepository repository;
    private InMemoryVectorStore vectorStore;
    private LexicalIndex lexicalIndex;
    private StubEmbeddingClient embeddingClient;
    private RagProperties properties;
    private HybridRetriever retriever;

    private static KnowledgeChunk chunk(long id, String docId, String title, String content, float[] vector) {
        return chunk(id, docId, title, content, vector, "vi");
    }

    private static KnowledgeChunk chunk(long id, String docId, String title, String content,
                                        float[] vector, String lang) {
        return KnowledgeChunk.builder()
                .id(id).docId(docId).title(title).content(content)
                .lang(lang).active(true)
                .embeddingBase64(VectorCodec.encode(vector))
                .embeddingModel("stub-embedding")
                .dimensions(vector.length)
                .build();
    }

    /**
     * Nạp lại chỉ mục bằng corpus song ngữ: mỗi chủ đề có một chunk tiếng Việt và một
     * chunk tiếng Anh mang CÙNG vector. Cùng vector là chủ ý — nó khiến nhánh ngữ nghĩa
     * không thể tự phân biệt hai bản dịch, nên nếu kết quả vẫn ra đúng ngôn ngữ thì đó
     * là công của bộ lọc chứ không phải may mắn của điểm cosine.
     */
    private void loadBilingualCorpus() {
        when(repository.findByActiveTrue()).thenReturn(List.of(
                chunk(1, "pets-bus", "Mang thú cưng lên xe khách",
                        "Xe khách cho phép mang thú cưng nhỏ trong lồng chuyên dụng dưới gầm xe.",
                        PETS_VECTOR),
                chunk(2, "baggage-plane", "Quy định hành lý máy bay",
                        "Vé máy bay gồm 7kg hành lý xách tay và 20kg hành lý ký gửi.",
                        BAGGAGE_VECTOR),
                chunk(11, "pets-bus-en", "Taking a pet on a bus",
                        "Buses accept small pets in a proper carrier placed under the coach.",
                        PETS_VECTOR, "en"),
                chunk(12, "baggage-plane-en", "Flight baggage allowance",
                        "A flight ticket includes 7kg of carry-on baggage and 20kg of checked baggage.",
                        BAGGAGE_VECTOR, "en")));
        retriever.reload();
    }

    @BeforeEach
    void setUp() {
        List<KnowledgeChunk> chunks = List.of(
                chunk(1, "pets-bus", "Mang thú cưng lên xe khách",
                        "Xe khách cho phép mang thú cưng nhỏ trong lồng chuyên dụng dưới gầm xe.",
                        PETS_VECTOR),
                chunk(2, "baggage-plane", "Quy định hành lý máy bay",
                        "Vé máy bay gồm 7kg hành lý xách tay và 20kg hành lý ký gửi.",
                        BAGGAGE_VECTOR),
                chunk(3, "payment-methods", "Phương thức thanh toán",
                        "Hệ thống thanh toán qua cổng VNPAY với thẻ ATM và mã QR.",
                        PAYMENT_VECTOR));

        repository = mock(KnowledgeChunkRepository.class);
        when(repository.findByActiveTrue()).thenReturn(chunks);

        vectorStore = new InMemoryVectorStore();
        lexicalIndex = new LexicalIndex();
        embeddingClient = new StubEmbeddingClient(Map.of(
                "thú cưng", PETS_VECTOR,
                "hành lý thú cưng", PETS_VECTOR,
                "thanh toán", PAYMENT_VECTOR));

        properties = new RagProperties();
        properties.setTopK(3);
        properties.setCandidatesPerBranch(10);
        properties.setMinSimilarity(0.55);

        retriever = new HybridRetriever(repository, vectorStore, lexicalIndex,
                embeddingClient, properties, new SimpleMeterRegistry());
        retriever.reload();
    }

    private List<String> docIds(List<KnowledgeChunk> chunks) {
        return chunks.stream().map(KnowledgeChunk::getDocId).toList();
    }

    @Test
    @DisplayName("reload() nạp cả hai chỉ mục")
    void reloadPopulatesBothIndexes() {
        assertThat(vectorStore.size()).isEqualTo(3);
        assertThat(lexicalIndex.size()).isEqualTo(3);
    }

    @Test
    @DisplayName("Chunk xuất hiện ở CẢ hai nhánh được RRF đẩy lên đầu")
    void chunkInBothBranchesOutranksSingleBranchHit() {
        // "hành lý thú cưng": BM25 ưu tiên chunk hành lý (khớp 2 từ), còn nhánh ngữ nghĩa
        // trỏ vào chunk thú cưng. Chunk thú cưng có mặt ở cả hai nhánh nên phải lên đầu.
        List<KnowledgeChunk> result = retriever.retrieve("hành lý thú cưng", 3);

        assertThat(docIds(result)).first().isEqualTo("pets-bus");
        assertThat(docIds(result)).contains("baggage-plane");
    }

    @Test
    @DisplayName("Không có embedding client → lùi về BM25 thuần, vẫn trả kết quả")
    void fallsBackToLexicalWhenEmbeddingUnavailable() {
        embeddingClient.available = false;

        List<KnowledgeChunk> result = retriever.retrieve("quy định hành lý máy bay", 3);

        assertThat(docIds(result))
                .as("thiếu API key không được làm chatbot mất khả năng tra tri thức")
                .first().isEqualTo("baggage-plane");
    }

    @Test
    @DisplayName("Embedding ném lỗi → nuốt lỗi và lùi về BM25, không làm hỏng lượt chat")
    void fallsBackWhenEmbeddingThrows() {
        embeddingClient.throwOnEmbed = true;

        List<KnowledgeChunk> result = retriever.retrieve("thanh toán", 3);

        assertThat(docIds(result)).contains("payment-methods");
    }

    @Test
    @DisplayName("Chunk dưới ngưỡng min-similarity bị loại khỏi nhánh ngữ nghĩa")
    void filtersBelowMinSimilarity() {
        // Vector [1,0,0] trực giao với vector hành lý và thanh toán (cosine = 0),
        // nên nhánh ngữ nghĩa chỉ được phép trả về đúng chunk thú cưng.
        List<KnowledgeChunk> semanticOnly = retriever.retrieveSemanticOnly("thú cưng", 5);

        assertThat(docIds(semanticOnly)).containsExactly("pets-bus");
    }

    @Test
    @DisplayName("Tôn trọng topK")
    void respectsTopK() {
        assertThat(retriever.retrieve("vé thanh toán hành lý thú cưng", 1)).hasSize(1);
    }

    @Test
    @DisplayName("rag.enabled=false tắt hẳn truy hồi")
    void returnsNothingWhenDisabled() {
        properties.setEnabled(false);

        assertThat(retriever.retrieve("thú cưng", 3)).isEmpty();
    }

    @Test
    @DisplayName("Truy vấn rỗng hoặc null trả về rỗng, không ném lỗi")
    void handlesBlankQuery() {
        assertThat(retriever.retrieve("", 3)).isEmpty();
        assertThat(retriever.retrieve(null, 3)).isEmpty();
    }

    @Test
    @DisplayName("Lọc theo ngôn ngữ: chỉ trả chunk đúng ngôn ngữ người đang hỏi")
    void filtersByRequestedLanguage() {
        loadBilingualCorpus();

        assertThat(docIds(retriever.retrieveForLanguage("hành lý thú cưng", "vi")))
                .containsExactlyInAnyOrder("pets-bus", "baggage-plane");
        assertThat(docIds(retriever.retrieveForLanguage("pet baggage", "en")))
                .containsExactlyInAnyOrder("pets-bus-en", "baggage-plane-en");
    }

    @Test
    @DisplayName("Bộ lọc áp cho cả nhánh ngữ nghĩa, kể cả khi hai bản dịch cùng vector")
    void filtersSemanticBranchToo() {
        loadBilingualCorpus();

        // "thú cưng" tra ra PETS_VECTOR, mà vector này thuộc về cả bản Việt lẫn bản Anh.
        assertThat(docIds(retriever.retrieveSemanticOnly("thú cưng", 5, "en")))
                .containsExactly("pets-bus-en");
        assertThat(docIds(retriever.retrieveSemanticOnly("thú cưng", 5, "vi")))
                .containsExactly("pets-bus");
    }

    @Test
    @DisplayName("Ngôn ngữ chưa có nội dung dịch thì không lọc, thay vì trả về rỗng")
    void fallsBackWhenLanguageHasNoContent() {
        loadBilingualCorpus();

        // ja chưa có chunk nào. Trả rỗng nghĩa là người hỏi tiếng Nhật mất sạch tri thức,
        // trong khi embedding đa ngôn ngữ vẫn thừa sức khớp câu hỏi đó với chunk tiếng Việt.
        assertThat(docIds(retriever.retrieveForLanguage("hành lý", "ja")))
                .as("ja chưa có bản dịch nên phải lùi về toàn corpus")
                .contains("baggage-plane");
    }

    @Test
    @DisplayName("Không truyền ngôn ngữ thì tìm trên toàn corpus")
    void noLanguageMeansNoFilter() {
        loadBilingualCorpus();

        assertThat(docIds(retriever.retrieveForLanguage("hành lý baggage", null)))
                .contains("baggage-plane", "baggage-plane-en");
        assertThat(docIds(retriever.retrieveForLanguage("hành lý baggage", "  ")))
                .contains("baggage-plane", "baggage-plane-en");
    }

    @Test
    @DisplayName("Mã ngôn ngữ viết hoa hay thừa khoảng trắng vẫn khớp")
    void normalizesLanguageCode() {
        loadBilingualCorpus();

        assertThat(docIds(retriever.retrieveForLanguage("pet baggage", " EN ")))
                .containsExactlyInAnyOrder("pets-bus-en", "baggage-plane-en");
    }

    @Test
    @DisplayName("Chunk chưa có embedding vẫn tra được qua nhánh từ khóa")
    void chunksWithoutEmbeddingStillSearchableLexically() {
        // Mô phỏng trạng thái sau khi seed mà chưa cấu hình embedding.
        KnowledgeChunk noVector = KnowledgeChunk.builder()
                .id(9L).docId("checkin-qr").title("Dùng mã QR để lên xe")
                .content("Khách đưa mã QR cho nhân viên soát vé quét để xác thực.")
                .lang("vi").active(true)
                .build();
        when(repository.findByActiveTrue()).thenReturn(List.of(noVector));
        retriever.reload();

        assertThat(vectorStore.size()).isZero();
        assertThat(docIds(retriever.retrieve("mã QR soát vé", 3))).containsExactly("checkin-qr");
    }
}
