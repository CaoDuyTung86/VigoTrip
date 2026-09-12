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
 * Truy hồi lai: hợp nhất tìm kiếm ngữ nghĩa (vector) và tìm kiếm từ khóa (BM25)
 * bằng Reciprocal Rank Fusion.
 *
 * Chọn RRF thay vì cộng điểm có trọng số vì hai nhánh cho ra điểm trên hai thang hoàn
 * toàn khác nhau (cosine 0..1 so với BM25 không chặn trên). RRF chỉ dùng THỨ HẠNG nên
 * không cần chuẩn hóa cũng không cần tự tay chỉnh trọng số — thứ mà với corpus cỡ này
 * thì có chỉnh cũng chỉ là đoán mò.
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
     * Reciprocal Rank Fusion: mỗi chunk cộng 1/(k + hạng) từ mỗi nhánh có mặt nó.
     * Chunk xuất hiện ở CẢ hai nhánh được đẩy lên trên một cách tự nhiên, không cần
     * quy tắc riêng nào.
     */
    private List<KnowledgeChunk> fuse(List<ScoredChunk> lexicalHits, List<ScoredChunk> semanticHits, int topK) {
        Map<Long, Double> fusedScores = new LinkedHashMap<>();
        Map<Long, KnowledgeChunk> byId = new LinkedHashMap<>();
        int k = properties.getRrfK();

        accumulate(lexicalHits, fusedScores, byId, k);
        accumulate(semanticHits, fusedScores, byId, k);

        List<Map.Entry<Long, Double>> ranked = new ArrayList<>(fusedScores.entrySet());
        ranked.sort(Map.Entry.<Long, Double>comparingByValue().reversed());

        List<KnowledgeChunk> result = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : ranked) {
            if (result.size() >= topK) {
                break;
            }
            result.add(byId.get(entry.getKey()));
        }
        return result;
    }

    private void accumulate(List<ScoredChunk> hits, Map<Long, Double> fusedScores,
                            Map<Long, KnowledgeChunk> byId, int k) {
        for (int rank = 0; rank < hits.size(); rank++) {
            KnowledgeChunk chunk = hits.get(rank).chunk();
            Long id = chunk.getId();
            byId.putIfAbsent(id, chunk);
            fusedScores.merge(id, 1.0 / (k + rank + 1.0), Double::sum);
        }
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
