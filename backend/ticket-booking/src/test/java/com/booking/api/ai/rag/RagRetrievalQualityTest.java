package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.ai.embedding.EmbeddingProperties;
import com.booking.api.ai.embedding.OpenAiCompatibleEmbeddingClient;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Đo chất lượng truy hồi trên bộ câu hỏi vàng (rag-eval.yml).
 *
 * HAI CHẾ ĐỘ CHẠY:
 *
 * 1. Mặc định (offline, luôn chạy trong CI): chỉ đo nhánh từ khóa BM25. Không gọi mạng,
 *    không cần API key. Đây là chốt chặn chống thoái lui — sửa knowledge base hay đụng
 *    vào BM25 mà làm tụt chất lượng thì build đỏ.
 *
 * 2. Chế độ live (thủ công): đặt biến môi trường RAG_EVAL_LIVE=1 và GEMINI_API_KEY để
 *    đo thêm nhánh ngữ nghĩa và nhánh lai. Có gọi API embedding thật nên KHÔNG chạy
 *    trong CI. Dùng khi cần số liệu so sánh ba kiến trúc cho báo cáo:
 *
 *      RAG_EVAL_LIVE=1 GEMINI_API_KEY=... ./mvnw test -Dtest=RagRetrievalQualityTest
 */
class RagRetrievalQualityTest {

    /** Ngưỡng tối thiểu cho nhánh từ khóa, đặt dưới mức đo được để bắt thoái lui thật. */
    private static final double MIN_RECALL_AT_3 = 0.85;
    private static final double MIN_MRR = 0.70;

    private record EvalCase(String query, Set<String> expected) {
    }

    /**
     * Tập chỉ số của một cấu hình truy hồi.
     *
     * @param precisionAt1 tỉ lệ câu hỏi mà kết quả ĐẦU TIÊN đã đúng. Đây là chỉ số gần
     *                     nhất với khái niệm "accuracy" quen thuộc trong bài toán phân loại.
     * @param precisionAt3 |đúng ∩ top3| / 3. Lưu ý: phần lớn câu hỏi chỉ có 1 chunk đúng,
     *                     nên trần lý thuyết của chỉ số này chỉ là 0.333 — thấp KHÔNG có
     *                     nghĩa là hệ thống tệ. Xem giải thích trong tài liệu.
     * @param f1At3        trung bình điều hòa của precisionAt3 và recallAt3. Đưa vào cho đủ
     *                     bộ, nhưng nó thừa hưởng đúng cái trần nói trên.
     * @param mrr          Mean Reciprocal Rank: trung bình của 1/(thứ hạng kết quả đúng đầu tiên).
     */
    private record Metrics(String name, int queries,
                           double precisionAt1, double recallAt1,
                           double recallAt3, double recallAt5,
                           double precisionAt3, double f1At3, double mrr,
                           List<String> misses) {
    }

    // ------------------------------------------------------------------ nạp dữ liệu

    @SuppressWarnings("unchecked")
    private List<KnowledgeChunk> loadKnowledgeBase() throws IOException {
        List<KnowledgeChunk> chunks = new ArrayList<>();
        Resource[] resources = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:knowledge/*.yml");

        long id = 1;
        for (Resource resource : resources) {
            try (InputStream in = resource.getInputStream()) {
                for (Object entry : (List<Object>) new Yaml().load(in)) {
                    Map<String, Object> map = (Map<String, Object>) entry;
                    chunks.add(KnowledgeChunk.builder()
                            .id(id++)
                            .docId(String.valueOf(map.get("docId")))
                            .title(map.get("title") == null ? "" : String.valueOf(map.get("title")))
                            .content(String.valueOf(map.get("content")).trim())
                            .category(map.get("category") == null ? "" : String.valueOf(map.get("category")))
                            .lang("vi")
                            .active(true)
                            .build());
                }
            }
        }
        return chunks;
    }

    @SuppressWarnings("unchecked")
    private List<EvalCase> loadEvalCases() throws IOException {
        List<EvalCase> cases = new ArrayList<>();
        try (InputStream in = new ClassPathResource("rag-eval.yml").getInputStream()) {
            for (Object entry : (List<Object>) new Yaml().load(in)) {
                Map<String, Object> map = (Map<String, Object>) entry;
                cases.add(new EvalCase(
                        String.valueOf(map.get("query")),
                        Set.copyOf((List<String>) map.get("expected"))));
            }
        }
        return cases;
    }

    // ------------------------------------------------------------------ tính chỉ số

    /**
     * @param retrieve nhận (câu hỏi, k) và trả về danh sách docId đã xếp hạng
     */
    private Metrics evaluate(String name, List<EvalCase> cases,
                             BiFunction<String, Integer, List<String>> retrieve) {
        int hitsAt1 = 0;
        int hitsAt3 = 0;
        int hitsAt5 = 0;
        double reciprocalRankSum = 0.0;
        double precisionAt3Sum = 0.0;
        List<String> misses = new ArrayList<>();

        for (EvalCase evalCase : cases) {
            List<String> top5 = retrieve.apply(evalCase.query(), 5);
            List<String> top3 = top5.size() > 3 ? top5.subList(0, 3) : top5;

            boolean hitAt1 = !top5.isEmpty() && evalCase.expected().contains(top5.get(0));
            boolean hitAt3 = top3.stream().anyMatch(evalCase.expected()::contains);
            boolean hitAt5 = top5.stream().anyMatch(evalCase.expected()::contains);

            if (hitAt1) hitsAt1++;
            if (hitAt3) hitsAt3++;
            if (hitAt5) hitsAt5++;

            long relevantInTop3 = top3.stream().filter(evalCase.expected()::contains).count();
            precisionAt3Sum += relevantInTop3 / 3.0;

            int rank = -1;
            for (int i = 0; i < top5.size(); i++) {
                if (evalCase.expected().contains(top5.get(i))) {
                    rank = i + 1;
                    break;
                }
            }
            if (rank > 0) {
                reciprocalRankSum += 1.0 / rank;
            } else {
                misses.add(String.format("  \"%s\" -> mong đợi %s, nhận được %s",
                        evalCase.query(), evalCase.expected(), top5));
            }
        }

        int n = cases.size();
        double recallAt3 = (double) hitsAt3 / n;
        double precisionAt3 = precisionAt3Sum / n;
        double f1At3 = (precisionAt3 + recallAt3) == 0
                ? 0.0
                : 2 * precisionAt3 * recallAt3 / (precisionAt3 + recallAt3);

        return new Metrics(name, n,
                (double) hitsAt1 / n, (double) hitsAt1 / n,
                recallAt3, (double) hitsAt5 / n,
                precisionAt3, f1At3, reciprocalRankSum / n,
                misses);
    }

    private void printTable(List<Metrics> results) {
        System.out.println();
        System.out.println("================ CHẤT LƯỢNG TRUY HỒI RAG ================");
        System.out.printf("%-16s %8s %8s %8s %8s %8s %8s%n",
                "Cấu hình", "P@1", "R@3", "R@5", "P@3", "F1@3", "MRR");
        System.out.println("---------------------------------------------------------");
        for (Metrics m : results) {
            System.out.printf("%-16s %7.1f%% %7.1f%% %7.1f%% %7.3f %7.3f %7.3f%n",
                    m.name(), m.precisionAt1() * 100, m.recallAt3() * 100, m.recallAt5() * 100,
                    m.precisionAt3(), m.f1At3(), m.mrr());
        }
        System.out.println("---------------------------------------------------------");
        System.out.println("P@1 = tỉ lệ kết quả đầu tiên đã đúng (gần nhất với 'accuracy')");
        System.out.println("R@k = tỉ lệ câu hỏi tìm được chunk đúng trong top-k");
        System.out.println("P@3 bị chặn trên ở 0.333 vì hầu hết câu hỏi chỉ có 1 chunk đúng");
        System.out.println("=========================================================");

        for (Metrics m : results) {
            if (!m.misses().isEmpty()) {
                System.out.printf("%n[%s] %d câu trượt hoàn toàn (không có trong top-5):%n",
                        m.name(), m.misses().size());
                m.misses().forEach(System.out::println);
            }
        }
        System.out.println();
    }

    // ------------------------------------------------------------------ chế độ live

    private boolean liveModeEnabled() {
        String flag = System.getenv("RAG_EVAL_LIVE");
        String key = System.getenv("GEMINI_API_KEY");
        return "1".equals(flag) && key != null && !key.isBlank();
    }

    /**
     * Bọc thêm cache quanh embedding client cho chế độ live.
     *
     * Bộ đo chạy cùng một câu hỏi qua hai cấu hình (Vector và Hybrid). Không cache thì
     * mỗi câu hỏi bị embed hai lần, và với 57 câu là 114 request — vượt hạn mức free
     * tier của Gemini (100 request embedding mỗi phút), khiến kết quả đo sai lệch vì
     * hệ thống rơi về BM25 giữa chừng. Cache đưa về đúng 57 request.
     */
    private static class CachingEmbeddingClient implements EmbeddingClient {

        /**
         * Giãn cách tối thiểu giữa hai lời gọi API. Free tier Gemini cho 100 request
         * embedding mỗi phút; 800ms giữ nhịp ở khoảng 75/phút, đủ biên an toàn.
         *
         * Có throttle là BẮT BUỘC chứ không phải cho lịch sự: khi bị 429, HybridRetriever
         * lặng lẽ lùi về BM25, nên nhánh Vector bị chấm điểm bằng kết quả BM25 và số đo
         * ra sai — lần chạy đầu tiên đã dính đúng lỗi này.
         */
        private static final long MIN_INTERVAL_MS = 800;
        private static final long RETRY_AFTER_429_MS = 30_000;

        private final EmbeddingClient delegate;
        private final Map<String, float[]> cache = new java.util.concurrent.ConcurrentHashMap<>();
        private int apiCalls = 0;
        private int rateLimitRetries = 0;
        private long lastCallAt = 0;

        CachingEmbeddingClient(EmbeddingClient delegate) {
            this.delegate = delegate;
        }

        private void throttle() {
            long waitMs = MIN_INTERVAL_MS - (System.currentTimeMillis() - lastCallAt);
            if (waitMs > 0) {
                sleep(waitMs);
            }
            lastCallAt = System.currentTimeMillis();
        }

        private static void sleep(long ms) {
            try {
                Thread.sleep(ms);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Bị ngắt khi đang chờ throttle", e);
            }
        }

        /** Gọi API có throttle, và thử lại đúng một lần nếu dính 429. */
        private List<float[]> callWithRetry(List<String> texts) {
            throttle();
            try {
                return delegate.embedAll(texts);
            } catch (RuntimeException e) {
                if (e.getMessage() == null || !e.getMessage().contains("429")) {
                    throw e;
                }
                rateLimitRetries++;
                System.out.printf("[Live] Dính 429, chờ %ds rồi thử lại...%n", RETRY_AFTER_429_MS / 1000);
                sleep(RETRY_AFTER_429_MS);
                lastCallAt = System.currentTimeMillis();
                return delegate.embedAll(texts);
            }
        }

        @Override
        public boolean isAvailable() {
            return delegate.isAvailable();
        }

        @Override
        public int dimensions() {
            return delegate.dimensions();
        }

        @Override
        public String modelName() {
            return delegate.modelName();
        }

        @Override
        public List<float[]> embedAll(List<String> texts) {
            List<String> missing = texts.stream().filter(t -> !cache.containsKey(t)).distinct().toList();
            if (!missing.isEmpty()) {
                apiCalls++;
                List<float[]> fresh = callWithRetry(missing);
                for (int i = 0; i < missing.size(); i++) {
                    cache.put(missing.get(i), fresh.get(i));
                }
            }
            return texts.stream().map(cache::get).toList();
        }
    }

    private EmbeddingClient buildLiveEmbeddingClient() {
        EmbeddingProperties props = new EmbeddingProperties();
        props.setApiKey(System.getenv("GEMINI_API_KEY"));
        String model = System.getenv("RAG_EMBEDDING_MODEL");
        if (model != null && !model.isBlank()) {
            props.setModel(model);
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(60));
        return new OpenAiCompatibleEmbeddingClient(props, new RestTemplate(factory));
    }

    // ------------------------------------------------------------------ test

    @Test
    @DisplayName("Chất lượng truy hồi đạt ngưỡng, và in bảng chỉ số đầy đủ")
    void measureRetrievalQuality() throws IOException {
        List<KnowledgeChunk> knowledgeBase = loadKnowledgeBase();
        List<EvalCase> cases = loadEvalCases();

        assertThat(knowledgeBase).as("knowledge base không được rỗng").isNotEmpty();
        assertThat(cases).as("bộ câu hỏi vàng không được rỗng").isNotEmpty();

        // Mọi docId kỳ vọng phải thực sự tồn tại — nếu không, bộ đo đang tự lừa mình.
        Set<String> knownDocIds = knowledgeBase.stream()
                .map(KnowledgeChunk::getDocId).collect(Collectors.toSet());
        for (EvalCase evalCase : cases) {
            assertThat(knownDocIds)
                    .as("câu hỏi \"%s\" trỏ tới docId không tồn tại", evalCase.query())
                    .containsAll(evalCase.expected());
        }

        List<Metrics> results = new ArrayList<>();

        // --- Luôn chạy: nhánh từ khóa BM25 (offline) ---
        LexicalIndex lexicalIndex = new LexicalIndex();
        lexicalIndex.load(knowledgeBase);
        Metrics lexical = evaluate("BM25 (từ khóa)", cases,
                (query, k) -> lexicalIndex.search(query, k).stream()
                        .map(s -> s.chunk().getDocId()).toList());
        results.add(lexical);

        // --- Chỉ chạy khi bật chế độ live: nhánh ngữ nghĩa và nhánh lai ---
        if (liveModeEnabled()) {
            CachingEmbeddingClient embeddingClient = new CachingEmbeddingClient(buildLiveEmbeddingClient());
            System.out.printf("%n[Live] Đang sinh embedding cho %d chunk bằng model %s...%n",
                    knowledgeBase.size(), embeddingClient.modelName());

            List<String> texts = knowledgeBase.stream()
                    .map(c -> (c.getTitle().isBlank() ? "" : c.getTitle() + ". ") + c.getContent())
                    .toList();
            List<float[]> vectors = embeddingClient.embedAll(texts);
            for (int i = 0; i < knowledgeBase.size(); i++) {
                KnowledgeChunk chunk = knowledgeBase.get(i);
                chunk.setEmbeddingBase64(VectorCodec.encode(vectors.get(i)));
                chunk.setEmbeddingModel(embeddingClient.modelName());
                chunk.setDimensions(vectors.get(i).length);
            }

            KnowledgeChunkRepository repository = mock(KnowledgeChunkRepository.class);
            when(repository.findByActiveTrue()).thenReturn(knowledgeBase);

            RagProperties props = new RagProperties();
            props.setCandidatesPerBranch(10);

            HybridRetriever retriever = new HybridRetriever(repository, new InMemoryVectorStore(),
                    new LexicalIndex(), embeddingClient, props, new SimpleMeterRegistry());
            retriever.reload();

            results.add(evaluate("Vector (ngữ nghĩa)", cases,
                    (query, k) -> retriever.retrieveSemanticOnly(query, k).stream()
                            .map(KnowledgeChunk::getDocId).toList()));

            results.add(evaluate("Hybrid (RRF)", cases,
                    (query, k) -> retriever.retrieve(query, k).stream()
                            .map(KnowledgeChunk::getDocId).toList()));

            System.out.printf("[Live] Lời gọi API embedding: %d (không cache sẽ là %d), "
                    + "số lần phải thử lại vì 429: %d%n",
                    embeddingClient.apiCalls, 1 + cases.size() * 2,
                    embeddingClient.rateLimitRetries);
        } else {
            System.out.println();
            System.out.println("[Bỏ qua nhánh ngữ nghĩa] Đặt RAG_EVAL_LIVE=1 và GEMINI_API_KEY "
                    + "để đo thêm cấu hình Vector và Hybrid.");
        }

        printTable(results);

        assertThat(lexical.recallAt3())
                .as("recall@3 của nhánh từ khóa tụt dưới ngưỡng — kiểm tra thay đổi ở "
                        + "knowledge base hoặc LexicalIndex/SynonymExpander")
                .isGreaterThanOrEqualTo(MIN_RECALL_AT_3);
        assertThat(lexical.mrr())
                .as("MRR của nhánh từ khóa tụt dưới ngưỡng — chunk đúng đang bị xếp hạng thấp đi")
                .isGreaterThanOrEqualTo(MIN_MRR);
    }
}
