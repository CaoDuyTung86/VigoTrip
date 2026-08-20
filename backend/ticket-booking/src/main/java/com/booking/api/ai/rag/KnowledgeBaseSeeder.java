package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.ai.embedding.EmbeddingException;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Nạp knowledge base từ resources/knowledge/*.yml vào DB, sinh embedding cho những
 * chunk mới hoặc đã đổi nội dung.
 *
 * Điểm quan trọng nhất ở đây là TÍNH BỀN: embedding được lưu xuống DB, và ở lần khởi
 * động sau chỉ những chunk có content_hash khác mới bị embed lại. Render free tier ngủ
 * và khởi động lại rất thường xuyên — embed lại toàn bộ corpus mỗi lần boot sẽ đốt sạch
 * quota API mà chẳng thu được gì.
 *
 * Chạy sau VoucherUsageConstraintInitializer (@Order(1)) theo đúng mẫu seeder sẵn có.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class KnowledgeBaseSeeder implements CommandLineRunner {

    private static final String KNOWLEDGE_PATTERN = "classpath*:knowledge/*.yml";

    private final KnowledgeChunkRepository repository;
    private final EmbeddingClient embeddingClient;
    private final HybridRetriever hybridRetriever;
    private final RagProperties ragProperties;

    @Override
    public void run(String... args) {
        if (!ragProperties.isEnabled()) {
            log.info("[KnowledgeSeeder] RAG đang tắt (rag.enabled=false), bỏ qua.");
            return;
        }
        if (!ragProperties.isSeedOnStartup()) {
            log.info("[KnowledgeSeeder] Bỏ qua seed theo cấu hình, chỉ nạp lại chỉ mục.");
            hybridRetriever.reload();
            return;
        }

        try {
            List<ParsedChunk> parsed = loadFromResources();
            if (parsed.isEmpty()) {
                log.warn("[KnowledgeSeeder] Không tìm thấy file tri thức nào khớp {}", KNOWLEDGE_PATTERN);
            } else {
                syncToDatabase(parsed);
            }
        } catch (Exception e) {
            // Knowledge base hỏng không được phép làm sập ứng dụng — chatbot sẽ chạy với
            // phần tri thức đang có trong DB (hoặc không có gì).
            log.error("[KnowledgeSeeder] Seed knowledge base thất bại, bỏ qua và tiếp tục khởi động.", e);
        }

        hybridRetriever.reload();
    }

    // ------------------------------------------------------------------ parsing

    private record ParsedChunk(String docId, String title, String content, String category, String lang) {
    }

    @SuppressWarnings("unchecked")
    private List<ParsedChunk> loadFromResources() throws java.io.IOException {
        List<ParsedChunk> chunks = new ArrayList<>();
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources(KNOWLEDGE_PATTERN);

        for (Resource resource : resources) {
            try (InputStream in = resource.getInputStream()) {
                Object loaded = new Yaml().load(in);
                if (!(loaded instanceof List<?> entries)) {
                    log.warn("[KnowledgeSeeder] {} không phải danh sách YAML, bỏ qua.", resource.getFilename());
                    continue;
                }
                for (Object entry : entries) {
                    if (entry instanceof Map<?, ?> map) {
                        ParsedChunk chunk = toChunk((Map<String, Object>) map, resource.getFilename());
                        if (chunk != null) {
                            chunks.add(chunk);
                        }
                    }
                }
            }
        }
        log.info("[KnowledgeSeeder] Đọc được {} chunk từ {} file.", chunks.size(), resources.length);
        return chunks;
    }

    private ParsedChunk toChunk(Map<String, Object> map, String fileName) {
        String docId = str(map.get("docId"));
        String content = str(map.get("content"));
        if (docId.isBlank() || content.isBlank()) {
            log.warn("[KnowledgeSeeder] Bỏ qua một mục thiếu docId hoặc content trong {}", fileName);
            return null;
        }
        String lang = str(map.get("lang"));
        return new ParsedChunk(
                docId,
                str(map.get("title")),
                content.trim(),
                str(map.get("category")),
                lang.isBlank() ? "vi" : lang);
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    // ------------------------------------------------------------------ syncing

    private void syncToDatabase(List<ParsedChunk> parsed) {
        Map<String, KnowledgeChunk> existing = new HashMap<>();
        for (KnowledgeChunk chunk : repository.findAll()) {
            existing.put(chunk.getDocId(), chunk);
        }

        List<KnowledgeChunk> toSave = new ArrayList<>();
        List<KnowledgeChunk> needEmbedding = new ArrayList<>();
        String currentModel = embeddingClient.isAvailable() ? embeddingClient.modelName() : null;

        for (ParsedChunk source : parsed) {
            String hash = sha256(source.content());
            KnowledgeChunk chunk = existing.get(source.docId());

            boolean isNew = chunk == null;
            if (isNew) {
                chunk = KnowledgeChunk.builder().docId(source.docId()).build();
            }

            boolean contentChanged = !hash.equals(chunk.getContentHash());
            boolean modelChanged = currentModel != null && !currentModel.equals(chunk.getEmbeddingModel());
            boolean missingEmbedding = chunk.getEmbeddingBase64() == null || chunk.getEmbeddingBase64().isBlank();

            chunk.setTitle(source.title());
            chunk.setContent(source.content());
            chunk.setCategory(source.category());
            chunk.setLang(source.lang());
            chunk.setContentHash(hash);
            chunk.setActive(Boolean.TRUE);
            chunk.setUpdatedAt(LocalDateTime.now());

            if (contentChanged || modelChanged || missingEmbedding) {
                needEmbedding.add(chunk);
            }
            toSave.add(chunk);
        }

        // Vô hiệu hóa chunk đã bị xóa khỏi file YAML, giữ lại dòng để không mất lịch sử.
        List<KnowledgeChunk> toDeactivate = new ArrayList<>();
        for (KnowledgeChunk chunk : existing.values()) {
            boolean stillPresent = parsed.stream().anyMatch(p -> p.docId().equals(chunk.getDocId()));
            if (!stillPresent && Boolean.TRUE.equals(chunk.getActive())) {
                chunk.setActive(Boolean.FALSE);
                chunk.setUpdatedAt(LocalDateTime.now());
                toDeactivate.add(chunk);
            }
        }

        embedIfPossible(needEmbedding);

        repository.saveAll(toSave);
        if (!toDeactivate.isEmpty()) {
            repository.saveAll(toDeactivate);
            log.info("[KnowledgeSeeder] Vô hiệu hóa {} chunk đã bị gỡ khỏi file nguồn.", toDeactivate.size());
        }

        log.info("[KnowledgeSeeder] Đồng bộ {} chunk ({} cần embed lại).", toSave.size(), needEmbedding.size());
    }

    private void embedIfPossible(List<KnowledgeChunk> chunks) {
        if (chunks.isEmpty()) {
            return;
        }
        if (!embeddingClient.isAvailable()) {
            log.warn("[KnowledgeSeeder] Chưa cấu hình embedding — lưu {} chunk KHÔNG kèm vector. "
                    + "Chatbot sẽ chạy bằng tìm kiếm từ khóa cho tới khi cấu hình xong.", chunks.size());
            return;
        }

        try {
            // Embed cả tiêu đề lẫn nội dung: tiêu đề mang tín hiệu chủ đề rất cô đọng.
            List<String> texts = chunks.stream()
                    .map(c -> (c.getTitle() == null || c.getTitle().isBlank() ? "" : c.getTitle() + ". ")
                            + c.getContent())
                    .toList();

            List<float[]> vectors = embeddingClient.embedAll(texts);

            for (int i = 0; i < chunks.size(); i++) {
                KnowledgeChunk chunk = chunks.get(i);
                float[] vector = vectors.get(i);
                chunk.setEmbeddingBase64(VectorCodec.encode(vector));
                chunk.setEmbeddingModel(embeddingClient.modelName());
                chunk.setDimensions(vector.length);
            }
            log.info("[KnowledgeSeeder] Sinh {} vector bằng model {}.", vectors.size(), embeddingClient.modelName());

        } catch (EmbeddingException e) {
            log.error("[KnowledgeSeeder] Sinh embedding thất bại — lưu chunk không kèm vector, "
                    + "hệ thống lùi về tìm kiếm từ khóa. Lỗi: {}", e.getMessage());
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Không tính được SHA-256", e);
        }
    }
}
