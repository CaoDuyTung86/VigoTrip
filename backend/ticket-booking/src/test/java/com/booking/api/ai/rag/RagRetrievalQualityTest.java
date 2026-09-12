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
import java.util.LinkedHashMap;
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

    /**
     * Ngưỡng tối thiểu cho nhánh từ khóa, đặt dưới mức đo được để bắt thoái lui thật.
     *
     * Tách theo NGÔN NGỮ CỦA CÂU HỎI chứ không gộp một ngưỡng chung: hai ngôn ngữ đang
     * dùng chung một chỉ mục nhưng chất lượng không như nhau, gộp lại thì ngôn ngữ nhiều
     * câu hỏi hơn sẽ che cho ngôn ngữ kia tụt mà bảng vẫn xanh.
     *
     * Thêm ngôn ngữ mới vào rag-eval.yml thì phải thêm ngưỡng ở đây, nếu không test fail
     * ngay — cố ý làm vậy để không ai lỡ thêm câu hỏi mà quên chốt chặn.
     */
    private static final Map<String, Double> MIN_RECALL_AT_3 = Map.of(
            "vi", 0.85, "en", 0.85, "ja", 0.85, "zh", 0.85);
    private static final Map<String, Double> MIN_MRR = Map.of(
            "vi", 0.70, "en", 0.70, "ja", 0.70, "zh", 0.70);

    /** Khóa của dòng chấm gộp mọi ngôn ngữ trong bảng kết quả. */
    private static final String ALL_LANGS = "gộp";

    private record EvalCase(String query, Set<String> expected, String lang) {
    }

    /** Mã ngôn ngữ đã chuẩn hóa; bỏ trống trong YAML thì hiểu là tiếng Việt. */
    private static String lang(Object raw) {
        String value = raw == null ? "" : String.valueOf(raw).trim().toLowerCase();
        return value.isBlank() ? "vi" : value;
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
                            .lang(lang(map.get("lang")))
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
                        Set.copyOf((List<String>) map.get("expected")),
                        lang(map.get("lang"))));
            }
        }
        return cases;
    }

    // ------------------------------------------------------------------ tính chỉ số

    /**
     * @param retrieve nhận (câu hỏi vàng, k) và trả về danh sách docId đã xếp hạng.
     *                 Nhận cả EvalCase chứ không chỉ chuỗi câu hỏi, vì cấu hình có lọc
     *                 ngôn ngữ cần biết câu hỏi này thuộc ngôn ngữ nào.
     */
    private Metrics evaluate(String name, List<EvalCase> cases,
                             BiFunction<EvalCase, Integer, List<String>> retrieve) {
        int hitsAt1 = 0;
        int hitsAt3 = 0;
        int hitsAt5 = 0;
        double reciprocalRankSum = 0.0;
        double precisionAt3Sum = 0.0;
        List<String> misses = new ArrayList<>();

        for (EvalCase evalCase : cases) {
            List<String> top5 = retrieve.apply(evalCase, 5);
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

    /**
     * Chấm một cấu hình truy hồi riêng cho từng ngôn ngữ câu hỏi, rồi chấm thêm một dòng gộp.
     *
     * Corpus KHÔNG bị tách theo ngôn ngữ: mọi câu hỏi đều chạy trên đúng chỉ mục hỗn hợp mà
     * production đang dùng. Đây là số nền để so sánh khi HybridRetriever có bộ lọc theo lang.
     *
     * @return bảng theo thứ tự mã ngôn ngữ, dòng gộp nằm cuối khi có từ hai ngôn ngữ trở lên
     */
    private Map<String, Metrics> evaluateByLang(String baseName, List<EvalCase> cases,
                                                BiFunction<EvalCase, Integer, List<String>> retrieve) {
        Map<String, Metrics> byLang = new LinkedHashMap<>();
        List<String> langs = cases.stream().map(EvalCase::lang).distinct().sorted().toList();

        for (String lang : langs) {
            List<EvalCase> subset = cases.stream().filter(c -> c.lang().equals(lang)).toList();
            byLang.put(lang, evaluate(baseName + " · " + lang, subset, retrieve));
        }
        if (langs.size() > 1) {
            byLang.put(ALL_LANGS, evaluate(baseName + " · " + ALL_LANGS, cases, retrieve));
        }
        return byLang;
    }

    private void printTable(List<Metrics> results) {
        System.out.println();
        System.out.println("==================== CHẤT LƯỢNG TRUY HỒI RAG ====================");
        System.out.printf("%-22s %5s %8s %8s %8s %8s %8s %8s%n",
                "Cấu hình", "Câu", "P@1", "R@3", "R@5", "P@3", "F1@3", "MRR");
        System.out.println("-----------------------------------------------------------------");
        for (Metrics m : results) {
            System.out.printf("%-22s %5d %7.1f%% %7.1f%% %7.1f%% %7.3f %7.3f %7.3f%n",
                    m.name(), m.queries(),
                    m.precisionAt1() * 100, m.recallAt3() * 100, m.recallAt5() * 100,
                    m.precisionAt3(), m.f1At3(), m.mrr());
        }
        System.out.println("-----------------------------------------------------------------");
        System.out.println("P@1 = tỉ lệ kết quả đầu tiên đã đúng (gần nhất với 'accuracy')");
        System.out.println("R@k = tỉ lệ câu hỏi tìm được chunk đúng trong top-k");
        System.out.println("P@3 bị chặn trên ở 0.333 vì hầu hết câu hỏi chỉ có 1 chunk đúng");
        System.out.println("Dòng '· vi' và '· en' chấm theo ngôn ngữ CÂU HỎI; corpus luôn là corpus hỗn hợp");
        System.out.println("'+ lọc lang' = chỉ chấm chunk cùng ngôn ngữ với câu hỏi (đường production đi)");
        System.out.println("=================================================================");

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
     * tier của Gemini, khiến kết quả đo sai lệch vì
     * hệ thống rơi về BM25 giữa chừng. Cache đưa về đúng 57 request.
     */
    private static class CachingEmbeddingClient implements EmbeddingClient {

        /**
         * Giãn cách tối thiểu giữa hai lời gọi API. Ban đầu đặt 800ms theo hạn mức
         * "100 request/phút" của free tier Gemini. Lần đo ngày 01/09/2026 vẫn dính 429
         * ở cả hai lần chạy: Google đã đổi sang hạn mức DÙNG CHUNG theo base model
         * (`global_embed_content_requests_per_minute_per_base_model`), tức là nhịp gọi
         * an toàn không còn do một mình ta quyết định. Nâng lên 1500ms và thêm vòng
         * thử lại có chờ tăng dần.
         *
         * Có throttle là BẮT BUỘC chứ không phải cho lịch sự: khi bị 429, HybridRetriever
         * lặng lẽ lùi về BM25, nên nhánh Vector bị chấm điểm bằng kết quả BM25 và số đo
         * ra sai — lần chạy đầu tiên đã dính đúng lỗi này.
         */
        private static final long MIN_INTERVAL_MS = 1_500;
        private static final long RETRY_AFTER_429_MS = 30_000;

        /** Số lần thử lại tối đa cho một lời gọi dính 429, với thời gian chờ tăng dần. */
        private static final int MAX_RETRIES = 3;

        private final EmbeddingClient delegate;
        private final Map<String, float[]> cache = new java.util.concurrent.ConcurrentHashMap<>();
        private int apiCalls = 0;
        private int rateLimitRetries = 0;

        /**
         * Số lời gọi embedding hỏng hẳn sau khi đã thử lại hết lượt.
         *
         * Đây là chỉ số quan trọng nhất của cả bộ đo live. Khi một lời gọi hỏng,
         * HybridRetriever bắt EmbeddingException rồi trả về danh sách rỗng — đúng
         * thiết kế cho production, nhưng nó khiến nhánh "Vector" bị chấm điểm bằng
         * kết quả của BM25. Nếu biến này khác 0 thì mọi con số của nhánh Vector và
         * Hybrid trong lần chạy đó đều KHÔNG dùng được, và test sẽ fail.
         */
        private int hardFailures = 0;
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

        /**
         * Gọi API có throttle, thử lại tối đa {@link #MAX_RETRIES} lần khi dính 429,
         * thời gian chờ tăng dần 30s / 60s / 90s.
         *
         * Hết lượt thử mà vẫn hỏng thì ghi nhận vào {@link #hardFailures} rồi ném tiếp —
         * ghi nhận TRƯỚC khi ném là bắt buộc, vì HybridRetriever sẽ nuốt ngoại lệ này
         * và lần chạy sẽ trông như bình thường nếu ta không tự đếm.
         */
        private List<float[]> callWithRetry(List<String> texts) {
            RuntimeException last = null;
            for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                throttle();
                try {
                    return delegate.embedAll(texts);
                } catch (RuntimeException e) {
                    if (e.getMessage() == null || !e.getMessage().contains("429")) {
                        throw e;
                    }
                    last = e;
                    if (attempt == MAX_RETRIES) {
                        break;
                    }
                    rateLimitRetries++;
                    long waitMs = RETRY_AFTER_429_MS * (attempt + 1L);
                    System.out.printf("[Live] Dính 429 (lần %d/%d), chờ %ds rồi thử lại...%n",
                            attempt + 1, MAX_RETRIES, waitMs / 1000);
                    sleep(waitMs);
                    lastCallAt = System.currentTimeMillis();
                }
            }
            hardFailures++;
            System.out.printf("[Live] ✗ Lời gọi embedding hỏng hẳn sau %d lần thử — "
                    + "số đo của nhánh Vector/Hybrid lần này KHÔNG dùng được.%n", MAX_RETRIES + 1);
            throw last;
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

    /**
     * Chốt chặn cho một cấu hình: từng ngôn ngữ phải tự đạt ngưỡng của nó.
     *
     * Dòng gộp bị bỏ qua có chủ ý. Nó chỉ để đọc — một ngôn ngữ tụt vẫn có thể được ngôn
     * ngữ kia kéo cho qua ngưỡng, đúng thứ mà việc tách ngưỡng sinh ra để chống.
     */
    private void assertMeetsThresholds(Map<String, Metrics> byLang) {
        for (Map.Entry<String, Metrics> entry : byLang.entrySet()) {
            String lang = entry.getKey();
            if (ALL_LANGS.equals(lang)) {
                continue;
            }
            Metrics metrics = entry.getValue();

            assertThat(MIN_RECALL_AT_3)
                    .as("rag-eval.yml có câu hỏi tiếng \"%s\" nhưng chưa khai ngưỡng cho "
                            + "ngôn ngữ này trong MIN_RECALL_AT_3/MIN_MRR", lang)
                    .containsKey(lang);

            assertThat(metrics.recallAt3())
                    .as("recall@3 của cấu hình \"%s\" tụt dưới ngưỡng — kiểm tra thay đổi ở "
                            + "knowledge base, LexicalIndex/SynonymExpander hoặc bộ lọc ngôn ngữ",
                            metrics.name())
                    .isGreaterThanOrEqualTo(MIN_RECALL_AT_3.get(lang));
            assertThat(metrics.mrr())
                    .as("MRR của cấu hình \"%s\" tụt dưới ngưỡng — chunk đúng đang bị xếp hạng "
                            + "thấp đi", metrics.name())
                    .isGreaterThanOrEqualTo(MIN_MRR.get(lang));
        }
    }

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
        Map<String, Metrics> lexical = evaluateByLang("BM25", cases,
                (evalCase, k) -> lexicalIndex.search(evalCase.query(), k).stream()
                        .map(s -> s.chunk().getDocId()).toList());
        results.addAll(lexical.values());

        // --- Cùng chỉ mục đó nhưng lọc theo ngôn ngữ câu hỏi: đây là đường mà lượt chat
        // thật đi qua từ khi ChatService gọi retrieveForLanguage().
        Map<String, Metrics> lexicalFiltered = evaluateByLang("BM25 + lọc lang", cases,
                (evalCase, k) -> lexicalIndex.search(evalCase.query(), k, evalCase.lang()).stream()
                        .map(s -> s.chunk().getDocId()).toList());
        results.addAll(lexicalFiltered.values());

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

            results.addAll(evaluateByLang("Vector", cases,
                    (evalCase, k) -> retriever.retrieveSemanticOnly(evalCase.query(), k).stream()
                            .map(KnowledgeChunk::getDocId).toList()).values());

            results.addAll(evaluateByLang("Vector + lọc lang", cases,
                    (evalCase, k) -> retriever.retrieveSemanticOnly(evalCase.query(), k, evalCase.lang())
                            .stream().map(KnowledgeChunk::getDocId).toList()).values());

            results.addAll(evaluateByLang("Hybrid (RRF)", cases,
                    (evalCase, k) -> retriever.retrieve(evalCase.query(), k).stream()
                            .map(KnowledgeChunk::getDocId).toList()).values());

            results.addAll(evaluateByLang("Hybrid + lọc lang", cases,
                    (evalCase, k) -> retriever.retrieve(evalCase.query(), k, evalCase.lang()).stream()
                            .map(KnowledgeChunk::getDocId).toList()).values());

            System.out.printf("[Live] Lời gọi API embedding: %d (không cache sẽ là %d), "
                    + "số lần phải thử lại vì 429: %d, số lời gọi hỏng hẳn: %d%n",
                    embeddingClient.apiCalls, 1 + cases.size() * 4,
                    embeddingClient.rateLimitRetries, embeddingClient.hardFailures);

            // Chốt chặn quan trọng nhất của chế độ live. Suy giảm êm về BM25 là hành vi
            // ĐÚNG khi chạy thật, nhưng khi đang ĐO thì nó biến nhánh Vector thành nhánh
            // BM25 trá hình mà không có dấu hiệu nào trên bảng kết quả. Thà fail còn hơn
            // in ra một con số không biết là của cái gì.
            assertThat(embeddingClient.hardFailures)
                    .as("có %d lời gọi embedding hỏng hẳn vì rate limit — nhánh Vector đã "
                            + "âm thầm rơi về BM25 nên số đo KHÔNG dùng được. Chờ vài phút "
                            + "rồi chạy lại, hoặc tăng MIN_INTERVAL_MS.",
                            embeddingClient.hardFailures)
                    .isZero();
        } else {
            System.out.println();
            System.out.println("[Bỏ qua nhánh ngữ nghĩa] Đặt RAG_EVAL_LIVE=1 và GEMINI_API_KEY "
                    + "để đo thêm cấu hình Vector và Hybrid.");
        }

        printTable(results);

        assertMeetsThresholds(lexical);
        assertMeetsThresholds(lexicalFiltered);
    }
}
