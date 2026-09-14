package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.ai.embedding.EmbeddingException;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Truy hồi lai: nhánh ngữ nghĩa (vector) là nhánh chính, nhánh từ khóa (BM25) bù chỗ trống.
 *
 * Kết quả giữ nguyên thứ tự của nhánh Vector. BM25 chỉ lấp những chỗ còn lại khi Vector trả
 * chưa đủ topK (chunk dưới ngưỡng cosine bị loại), và không bao giờ đẩy một chunk lên trên
 * chunk mà Vector đã xếp. Đây không phải "tăng trọng số cho Vector": không có điểm nào được
 * cộng, BM25 đứng hẳn sau.
 *
 * Trước 14/09/2026 hai nhánh được hợp nhất bằng Reciprocal Rank Fusion. Trên bộ vàng hai cách
 * ngang nhau (126/132 câu đúng hạng 1), nhưng trên câu hỏi chưa dùng để chọn cấu hình RRF thua:
 * chunk sai có mặt ở CẢ hai nhánh cộng điểm vượt chunk đúng mà chỉ Vector xếp đầu. P@1 tiếng
 * Việt + lọc lang: 49 câu người thật gõ 63.3% → 73.5%, 55 câu holdout 80.0% → 94.5%, 32 câu có
 * mã voucher/mã đơn 81.2% → 90.6%. Xem experiments.md 14/09 bên vi-rag-eval.
 *
 * Suy giảm êm: nếu embedding không dùng được (thiếu API key, hoặc lời gọi hỏng),
 * nhánh ngữ nghĩa trả rỗng và kết quả rơi về đúng BM25 thuần — chatbot vẫn tra được
 * tri thức thay vì hỏng hẳn.
 *
 * Lọc theo ngôn ngữ ({@link #retrieveForLanguage}) áp cho CẢ hai nhánh trước khi hợp
 * nhất, chứ không cắt bớt sau khi đã xếp hạng. Lọc sau sẽ làm rỗng dần danh sách ứng
 * viên: lấy 10 ứng viên mỗi nhánh rồi bỏ đi những cái khác ngôn ngữ thì có khi chỉ còn
 * 2-3 cái để hợp nhất, trong khi corpus vẫn còn thừa chunk đúng ngôn ngữ xếp ngay dưới.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HybridRetriever {

    private final KnowledgeChunkRepository repository;
    private final VectorStore vectorStore;
    private final LexicalIndex lexicalIndex;
    private final EmbeddingClient embeddingClient;
    private final RagProperties properties;
    private final MeterRegistry meterRegistry;

    /** Nạp lại cả hai chỉ mục từ DB. Gọi lúc khởi động và sau khi sửa knowledge base. */
    public void reload() {
        List<KnowledgeChunk> chunks = repository.findByActiveTrue();
        vectorStore.load(chunks);
        lexicalIndex.load(chunks);
        log.info("[RAG] Đã nạp {} chunk (vector: {}, từ khóa: {}).",
                chunks.size(), vectorStore.size(), lexicalIndex.size());
    }

    /** Truy hồi với topK lấy từ cấu hình, không lọc ngôn ngữ. */
    public List<KnowledgeChunk> retrieve(String query) {
        return retrieve(query, properties.getTopK());
    }

    /**
     * Truy hồi tri thức cùng ngôn ngữ với người đang hỏi, topK lấy từ cấu hình.
     *
     * Đây là đường mà lượt chat thật đi qua: ngôn ngữ đến từ lựa chọn trên giao diện,
     * cùng nguồn với mã ngôn ngữ đã ép vào system prompt. Trả về chunk đúng ngôn ngữ
     * không chỉ cho câu trả lời sát hơn, nó còn cắt hẳn phần token mà LLM phải bỏ ra
     * để dịch ngữ cảnh trước khi trả lời.
     *
     * Ngôn ngữ chưa có nội dung dịch (hiện là `ja`, `zh`) tự động không lọc, xem
     * {@link LexicalIndex#search(String, int, String)}.
     */
    public List<KnowledgeChunk> retrieveForLanguage(String query, String lang) {
        return retrieve(query, properties.getTopK(), lang);
    }

    public List<KnowledgeChunk> retrieve(String query, int topK) {
        return retrieve(query, topK, null);
    }

    public List<KnowledgeChunk> retrieve(String query, int topK, String lang) {
        if (!properties.isEnabled() || query == null || query.isBlank() || topK <= 0) {
            return List.of();
        }

        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            int candidates = Math.max(topK, properties.getCandidatesPerBranch());

            List<ScoredChunk> lexicalHits = lexicalIndex.search(query, candidates, lang);
            List<ScoredChunk> semanticHits = semanticSearch(query, candidates, lang);

            List<KnowledgeChunk> fused = fuse(lexicalHits, semanticHits, topK);

            Counter.builder("rag_retrievals_total")
                    .tag("mode", semanticHits.isEmpty() ? "lexical_only" : "hybrid")
                    .tag("outcome", fused.isEmpty() ? "empty" : "hit")
                    // Tách theo ngôn ngữ yêu cầu để thấy được ngôn ngữ nào hay truy hồi hụt.
                    // Số nhãn bằng số ngôn ngữ giao diện hỗ trợ nên không có nguy cơ nổ nhãn.
                    .tag("lang", lang == null || lang.isBlank() ? "all" : lang)
                    .description("Số lượt truy hồi RAG")
                    .register(meterRegistry)
                    .increment();

            return fused;
        } finally {
            sample.stop(Timer.builder("rag_retrieval_seconds")
                    .description("Độ trễ truy hồi RAG")
                    .register(meterRegistry));
        }
    }

    private List<ScoredChunk> semanticSearch(String query, int candidates, String lang) {
        if (!embeddingClient.isAvailable() || vectorStore.size() == 0) {
            return List.of();
        }
        try {
            float[] queryVector = embeddingClient.embed(query);
            return vectorStore.search(queryVector, candidates, properties.getMinSimilarity(), lang);
        } catch (EmbeddingException e) {
            // Không để lỗi embedding làm hỏng cả lượt chat — lùi về BM25.
            log.warn("[RAG] Embedding truy vấn thất bại, chỉ dùng tìm kiếm từ khóa: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Vector trước, BM25 bù sau: lấy nguyên thứ tự nhánh Vector, rồi lấp chỗ còn trống bằng
     * chunk BM25 chưa có mặt. Nhánh Vector rỗng thì kết quả là BM25 thuần. Khớp
     * {@code fusion="vector_fill"} bên vi-rag-eval.
     */
    private List<KnowledgeChunk> fuse(List<ScoredChunk> lexicalHits, List<ScoredChunk> semanticHits, int topK) {
        Map<Long, KnowledgeChunk> byId = new LinkedHashMap<>();
        for (List<ScoredChunk> hits : List.of(semanticHits, lexicalHits)) {
            for (ScoredChunk hit : hits) {
                if (byId.size() >= topK) {
                    return new ArrayList<>(byId.values());
                }
                byId.putIfAbsent(hit.chunk().getId(), hit.chunk());
            }
        }
        return new ArrayList<>(byId.values());
    }

    /** Dùng cho bộ đo chất lượng truy hồi: chỉ nhánh từ khóa. */
    public List<KnowledgeChunk> retrieveLexicalOnly(String query, int topK) {
        return retrieveLexicalOnly(query, topK, null);
    }

    public List<KnowledgeChunk> retrieveLexicalOnly(String query, int topK, String lang) {
        return lexicalIndex.search(query, topK, lang).stream().map(ScoredChunk::chunk).toList();
    }

    /** Dùng cho bộ đo chất lượng truy hồi: chỉ nhánh ngữ nghĩa. */
    public List<KnowledgeChunk> retrieveSemanticOnly(String query, int topK) {
        return retrieveSemanticOnly(query, topK, null);
    }

    public List<KnowledgeChunk> retrieveSemanticOnly(String query, int topK, String lang) {
        return semanticSearch(query, topK, lang).stream()
                .sorted(Comparator.comparingDouble(ScoredChunk::score).reversed())
                .map(ScoredChunk::chunk)
                .toList();
    }
}
