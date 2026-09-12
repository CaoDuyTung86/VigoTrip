package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Kho vector giữ trong bộ nhớ, quét cosine tuần tự.
 *
 * Chi phí bộ nhớ: (số chunk) × (số chiều) × 4 byte. Với 500 chunk × 768 chiều là
 * khoảng 1,5 MB — không đáng kể so với heap 256MB trên Render.
 *
 * An toàn luồng: danh sách được thay nguyên khối bằng một danh sách bất biến mới khi
 * nạp lại, nên độc giả đang chạy không bao giờ thấy trạng thái nửa vời.
 */
@Component
@Slf4j
public class InMemoryVectorStore implements VectorStore {

    /** Chunk kèm vector đã giải mã sẵn — tránh decode Base64 ở mỗi truy vấn. */
    private record Entry(KnowledgeChunk chunk, float[] vector) {

        /**
         * Record mặc định so sánh mảng theo tham chiếu; ở đây so theo nội dung để hai Entry
         * cùng dữ liệu được coi là bằng nhau.
         */
        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            return o instanceof Entry other
                    && Objects.equals(chunk, other.chunk)
                    && Arrays.equals(vector, other.vector);
        }

        @Override
        public int hashCode() {
            return 31 * Objects.hashCode(chunk) + Arrays.hashCode(vector);
        }

        /** Chỉ in số chiều thay vì toàn bộ vector — một vector có tới hàng trăm phần tử. */
        @Override
        public String toString() {
            return "Entry[chunk=" + chunk + ", vector=" + (vector == null ? "null" : vector.length + " chiều") + "]";
        }
    }

    private volatile List<Entry> entries = List.of();
    private volatile Set<String> languages = Set.of();

    @Override
    public void load(List<KnowledgeChunk> chunks) {
        List<Entry> loaded = new ArrayList<>();
        Set<String> langs = new HashSet<>();
        int skipped = 0;

        for (KnowledgeChunk chunk : chunks) {
            float[] vector = VectorCodec.decode(chunk.getEmbeddingBase64());
            if (vector == null || vector.length == 0) {
                skipped++;
                continue;
            }
            loaded.add(new Entry(chunk, vector));

            String lang = LangFilter.normalize(chunk.getLang());
            if (lang != null) {
                langs.add(lang);
            }
        }

        this.entries = List.copyOf(loaded);
        this.languages = Set.copyOf(langs);

        if (skipped > 0) {
            log.info("[VectorStore] Nạp {} vector, bỏ qua {} chunk chưa có embedding.", loaded.size(), skipped);
        } else {
            log.info("[VectorStore] Nạp {} vector.", loaded.size());
        }
    }

    @Override
    public List<ScoredChunk> search(float[] queryVector, int topK, double minSimilarity) {
        return search(queryVector, topK, minSimilarity, null);
    }

    @Override
    public List<ScoredChunk> search(float[] queryVector, int topK, double minSimilarity, String lang) {
        List<Entry> snapshot = this.entries;
        if (queryVector == null || snapshot.isEmpty() || topK <= 0) {
            return List.of();
        }

        String filter = LangFilter.normalize(lang);
        if (filter != null && !languages.contains(filter)) {
            filter = null;
        }

        List<ScoredChunk> scored = new ArrayList<>();
        for (Entry entry : snapshot) {
            if (!LangFilter.accepts(filter, entry.chunk())) {
                continue;
            }
            double similarity = VectorCodec.cosineSimilarity(queryVector, entry.vector());
            if (similarity >= minSimilarity) {
                scored.add(new ScoredChunk(entry.chunk(), similarity));
            }
        }

        scored.sort(Comparator.comparingDouble(ScoredChunk::score).reversed());
        return scored.size() > topK ? new ArrayList<>(scored.subList(0, topK)) : scored;
    }

    @Override
    public int size() {
        return entries.size();
    }

    @Override
    public Set<String> languages() {
        return languages;
    }
}
