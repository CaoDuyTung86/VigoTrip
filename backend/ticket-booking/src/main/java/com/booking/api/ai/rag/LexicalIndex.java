package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Nhánh tìm kiếm từ khóa, chấm điểm BM25 trên token đã bỏ dấu.
 *
 * Đây KHÔNG phải phần thừa để hệ thống được gọi là "hybrid". Nó gánh hai việc thật:
 *
 * 1. Là đường lui khi không có embedding. Nếu GEMINI_API_KEY trống (dev local, CI —
 *    application-test.yml dùng key giả) hoặc API embedding hỏng, kho vector rỗng và
 *    chatbot vẫn truy hồi được tri thức thay vì câm.
 * 2. Bắt được thứ embedding hay trượt: mã voucher, số hiệu, tiếng lóng, và người Việt
 *    gõ không dấu.
 */
@Component
@Slf4j
public class LexicalIndex {

    // Tham số BM25 tiêu chuẩn — không tinh chỉnh gì thêm, không có tập dữ liệu đủ lớn
    // để việc tinh chỉnh có ý nghĩa thống kê.
    private static final double K1 = 1.2;
    private static final double B = 0.75;

    private record Document(KnowledgeChunk chunk, Map<String, Integer> termFrequencies, int length) {
    }

    /**
     * Thống kê BM25 của MỘT tập tài liệu: số tài liệu, độ dài trung bình, và số tài liệu
     * chứa mỗi term.
     *
     * Có một bộ cho toàn corpus và một bộ cho mỗi ngôn ngữ. Ban đầu chỉ có bộ chung, với
     * lập luận rằng IDF áp đều cho mọi tài liệu đang so nên đổi mẫu số không đổi thứ hạng.
     * Lập luận đó đúng với IDF nhưng SAI với chuẩn hóa độ dài: hệ số B = 0.75 chấm điểm
     * tài liệu theo độ dài của nó SO VỚI trung bình, mà trung bình đó lại phụ thuộc vào
     * việc trong corpus có gì. Thêm chunk tiếng Nhật và tiếng Trung — vốn dài hơn hẳn vì
     * bigram sinh nhiều token — kéo trung bình chung lên, và thứ hạng giữa các chunk tiếng
     * Việt đổi theo dù chẳng có chunk tiếng Việt nào thay đổi. Bộ đo bắt được đúng lỗi này:
     * R@3 của tiếng Việt tụt từ 93.0% xuống 91.2% chỉ vì corpus có thêm hai ngôn ngữ.
     */
    private record Stats(int documentCount, double averageLength, Map<String, Integer> documentFrequencies) {

        static final Stats EMPTY = new Stats(0, 0.0, Map.of());
    }

    private volatile List<Document> documents = List.of();
    private volatile Stats corpusStats = Stats.EMPTY;
    private volatile Map<String, Stats> statsByLang = Map.of();
    private volatile Set<String> languages = Set.of();

    public void load(List<KnowledgeChunk> chunks) {
        List<Document> docs = new ArrayList<>();
        Map<String, List<Document>> byLang = new HashMap<>();

        for (KnowledgeChunk chunk : chunks) {
            // Gộp cả tiêu đề và nội dung: tiêu đề thường chứa đúng từ người dùng hỏi.
            List<String> tokens = TextNormalizer.tokenize(
                    (chunk.getTitle() == null ? "" : chunk.getTitle()) + " " + chunk.getContent());

            Map<String, Integer> tf = new HashMap<>();
            for (String token : tokens) {
                tf.merge(token, 1, Integer::sum);
            }

            Document document = new Document(chunk, tf, tokens.size());
            docs.add(document);

            String lang = LangFilter.normalize(chunk.getLang());
            if (lang != null) {
                byLang.computeIfAbsent(lang, k -> new ArrayList<>()).add(document);
            }
        }

        Map<String, Stats> perLang = new HashMap<>();
        byLang.forEach((lang, langDocs) -> perLang.put(lang, computeStats(langDocs)));

        this.documents = List.copyOf(docs);
        this.corpusStats = computeStats(docs);
        this.statsByLang = Map.copyOf(perLang);
        this.languages = Set.copyOf(byLang.keySet());

        log.info("[LexicalIndex] Đánh chỉ mục {} chunk, {} token phân biệt, ngôn ngữ {}.",
                docs.size(), corpusStats.documentFrequencies().size(), languages);
    }

    private Stats computeStats(List<Document> docs) {
        Map<String, Integer> df = new HashMap<>();
        long totalLength = 0;
        for (Document doc : docs) {
            for (String term : doc.termFrequencies().keySet()) {
                df.merge(term, 1, Integer::sum);
            }
            totalLength += doc.length();
        }
        double averageLength = docs.isEmpty() ? 0.0 : (double) totalLength / docs.size();
        return new Stats(docs.size(), averageLength, Map.copyOf(df));
    }

    /** Ngôn ngữ thực sự có mặt trong chỉ mục. Dùng để biết lọc theo một mã có ra gì không. */
    public Set<String> languages() {
        return languages;
    }

    /** topK chunk có điểm BM25 dương, sắp xếp giảm dần. */
    public List<ScoredChunk> search(String query, int topK) {
        return search(query, topK, null);
    }

    /**
     * Như trên nhưng chỉ chấm những chunk thuộc ngôn ngữ {@code lang}.
     *
     * Mã ngôn ngữ mà chỉ mục KHÔNG có chunk nào thì bị bỏ qua và tìm trên toàn corpus.
     * Với `ja`/`zh` chưa có nội dung dịch, trả về rỗng sẽ tệ hơn hẳn so với trả về chunk
     * tiếng Việt: người hỏi vẫn nhận được câu trả lời đúng, chỉ là LLM phải dịch lại.
     *
     * Thống kê BM25 (số tài liệu, độ dài trung bình, document frequency) vẫn tính trên
     * TOÀN corpus chứ không tính lại theo từng ngôn ngữ. IDF là hệ số theo term, áp
     * chung cho mọi tài liệu đang so, nên đổi mẫu số chỉ dịch chuyển điểm gần như đều
     * nhau và thứ hạng trong cùng một ngôn ngữ hầu như không đổi — không đáng để phải
     * dựng và bảo trì một bộ thống kê riêng cho mỗi ngôn ngữ.
     */
    public List<ScoredChunk> search(String query, int topK, String lang) {
        List<Document> snapshot = this.documents;
        if (snapshot.isEmpty() || topK <= 0) {
            return List.of();
        }

        String filter = LangFilter.normalize(lang);
        if (filter != null && !languages.contains(filter)) {
            filter = null;
        }

        // Mở rộng bằng bảng từ đồng nghĩa của ĐÚNG ngôn ngữ sắp lọc, không phải ngôn ngữ
        // người gọi yêu cầu. Hai thứ này lệch nhau khi lọc bị bỏ: lúc đó truy vấn được
        // chấm trên toàn corpus nên cũng phải được với sang mọi bảng từ.
        List<String> queryTokens = SynonymExpander.expand(query, filter);
        if (queryTokens.isEmpty()) {
            return List.of();
        }

        // Lọc ngôn ngữ nào thì chấm bằng thống kê của ngôn ngữ đó.
        Stats stats = filter == null ? corpusStats : statsByLang.getOrDefault(filter, corpusStats);

        List<ScoredChunk> scored = new ArrayList<>();
        for (Document doc : snapshot) {
            if (!LangFilter.accepts(filter, doc.chunk())) {
                continue;
            }
            double score = score(doc, queryTokens, stats);
            if (score > 0) {
                scored.add(new ScoredChunk(doc.chunk(), score));
            }
        }

        scored.sort(Comparator.comparingDouble(ScoredChunk::score).reversed());
        return scored.size() > topK ? new ArrayList<>(scored.subList(0, topK)) : scored;
    }

    private double score(Document doc, List<String> queryTokens, Stats stats) {
        double score = 0.0;
        for (String term : queryTokens) {
            Integer termFreq = doc.termFrequencies().get(term);
            if (termFreq == null) {
                continue;
            }
            int docFreq = stats.documentFrequencies().getOrDefault(term, 0);
            // IDF của Robertson, cộng 1 để không bao giờ âm với term xuất hiện ở mọi tài liệu.
            double idf = Math.log(1 + (stats.documentCount() - docFreq + 0.5) / (docFreq + 0.5));

            double averageLength = stats.averageLength();
            double normalizedLength = averageLength > 0 ? doc.length() / averageLength : 1.0;
            double denominator = termFreq + K1 * (1 - B + B * normalizedLength);
            score += idf * (termFreq * (K1 + 1)) / denominator;
        }
        return score;
    }

    public int size() {
        return documents.size();
    }
}
