package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    private volatile List<Document> documents = List.of();
    private volatile Map<String, Integer> documentFrequencies = Map.of();
    private volatile double averageLength = 0.0;

    public void load(List<KnowledgeChunk> chunks) {
        List<Document> docs = new ArrayList<>();
        Map<String, Integer> df = new HashMap<>();
        long totalLength = 0;

        for (KnowledgeChunk chunk : chunks) {
            // Gộp cả tiêu đề và nội dung: tiêu đề thường chứa đúng từ người dùng hỏi.
            List<String> tokens = TextNormalizer.tokenize(
                    (chunk.getTitle() == null ? "" : chunk.getTitle()) + " " + chunk.getContent());

            Map<String, Integer> tf = new HashMap<>();
            for (String token : tokens) {
                tf.merge(token, 1, Integer::sum);
            }
            for (String term : tf.keySet()) {
                df.merge(term, 1, Integer::sum);
            }

            docs.add(new Document(chunk, tf, tokens.size()));
            totalLength += tokens.size();
        }

        this.documents = List.copyOf(docs);
        this.documentFrequencies = Map.copyOf(df);
        this.averageLength = docs.isEmpty() ? 0.0 : (double) totalLength / docs.size();

        log.info("[LexicalIndex] Đánh chỉ mục {} chunk, {} token phân biệt.", docs.size(), df.size());
    }

    /** topK chunk có điểm BM25 dương, sắp xếp giảm dần. */
    public List<ScoredChunk> search(String query, int topK) {
        List<Document> snapshot = this.documents;
        if (snapshot.isEmpty() || topK <= 0) {
            return List.of();
        }

        List<String> queryTokens = SynonymExpander.expand(query);
        if (queryTokens.isEmpty()) {
            return List.of();
        }

        List<ScoredChunk> scored = new ArrayList<>();
        for (Document doc : snapshot) {
            double score = score(doc, queryTokens, snapshot.size());
            if (score > 0) {
                scored.add(new ScoredChunk(doc.chunk(), score));
            }
        }

        scored.sort(Comparator.comparingDouble(ScoredChunk::score).reversed());
        return scored.size() > topK ? new ArrayList<>(scored.subList(0, topK)) : scored;
    }

    private double score(Document doc, List<String> queryTokens, int totalDocs) {
        double score = 0.0;
        for (String term : queryTokens) {
            Integer termFreq = doc.termFrequencies().get(term);
            if (termFreq == null) {
                continue;
            }
            int docFreq = documentFrequencies.getOrDefault(term, 0);
            // IDF của Robertson, cộng 1 để không bao giờ âm với term xuất hiện ở mọi tài liệu.
            double idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));

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
