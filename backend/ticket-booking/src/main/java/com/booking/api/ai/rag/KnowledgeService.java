package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.ai.embedding.EmbeddingException;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * Nghiệp vụ quản trị knowledge base.
 *
 * Đây là thứ biến việc sửa tri thức chatbot từ "sửa code, build lại, deploy lại"
 * thành một thao tác lúc chạy. Mọi thay đổi nội dung đều kéo theo embed lại và nạp
 * lại chỉ mục ngay, nên câu trả lời của chatbot đổi tức thì.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeService {

    private final KnowledgeChunkRepository repository;
    private final EmbeddingClient embeddingClient;
    private final HybridRetriever hybridRetriever;

    @Transactional(readOnly = true)
    public List<KnowledgeChunk> findAll() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<KnowledgeChunk> findById(Long id) {
        return repository.findById(id);
    }

    /** Xem trước đúng những gì chatbot sẽ truy hồi cho một câu hỏi. */
    @Transactional(readOnly = true)
    public List<KnowledgeChunk> preview(String query, int topK) {
        return hybridRetriever.retrieve(query, topK);
    }

    @Transactional
    public KnowledgeChunk create(KnowledgeChunk input) {
        if (repository.findByDocId(input.getDocId()).isPresent()) {
            throw new IllegalArgumentException("docId đã tồn tại: " + input.getDocId());
        }
        KnowledgeChunk chunk = KnowledgeChunk.builder()
                .docId(input.getDocId())
                .title(input.getTitle())
                .content(input.getContent())
                .category(input.getCategory())
                .lang(input.getLang() == null || input.getLang().isBlank() ? "vi" : input.getLang())
                .active(input.getActive() == null || input.getActive())
                .build();

        applyContentAndEmbed(chunk, input.getContent());
        KnowledgeChunk saved = repository.save(chunk);
        hybridRetriever.reload();
        return saved;
    }

    @Transactional
    public Optional<KnowledgeChunk> update(Long id, KnowledgeChunk input) {
        return repository.findById(id).map(chunk -> {
            chunk.setTitle(input.getTitle());
            chunk.setCategory(input.getCategory());
            if (input.getLang() != null && !input.getLang().isBlank()) {
                chunk.setLang(input.getLang());
            }
            if (input.getActive() != null) {
                chunk.setActive(input.getActive());
            }
            applyContentAndEmbed(chunk, input.getContent());

            KnowledgeChunk saved = repository.save(chunk);
            hybridRetriever.reload();
            return saved;
        });
    }

    /**
     * Xóa mềm. Giữ lại dòng dữ liệu thay vì xóa hẳn để không mất vector đã sinh —
     * bật lại về sau sẽ không tốn thêm lần gọi API embedding nào.
     */
    @Transactional
    public boolean deactivate(Long id) {
        return repository.findById(id).map(chunk -> {
            chunk.setActive(Boolean.FALSE);
            chunk.setUpdatedAt(LocalDateTime.now());
            repository.save(chunk);
            hybridRetriever.reload();
            return true;
        }).orElse(false);
    }

    public void reloadIndexes() {
        hybridRetriever.reload();
    }

    /**
     * Đặt nội dung mới và chỉ embed lại khi nội dung thực sự đổi.
     * Embed thất bại không được làm hỏng thao tác lưu: chunk vẫn được lưu và vẫn tra
     * được qua nhánh từ khóa.
     */
    private void applyContentAndEmbed(KnowledgeChunk chunk, String newContent) {
        String content = newContent == null ? "" : newContent.trim();
        String hash = sha256(content);

        boolean contentChanged = !hash.equals(chunk.getContentHash());
        chunk.setContent(content);
        chunk.setContentHash(hash);
        chunk.setUpdatedAt(LocalDateTime.now());

        if (!contentChanged && chunk.getEmbeddingBase64() != null) {
            return;
        }
        if (!embeddingClient.isAvailable()) {
            log.warn("[KnowledgeService] Chưa cấu hình embedding — lưu chunk {} không kèm vector.",
                    chunk.getDocId());
            return;
        }

        try {
            String text = (chunk.getTitle() == null || chunk.getTitle().isBlank() ? "" : chunk.getTitle() + ". ")
                    + content;
            float[] vector = embeddingClient.embed(text);
            chunk.setEmbeddingBase64(VectorCodec.encode(vector));
            chunk.setEmbeddingModel(embeddingClient.modelName());
            chunk.setDimensions(vector.length);
        } catch (EmbeddingException e) {
            log.error("[KnowledgeService] Sinh embedding cho chunk {} thất bại: {}",
                    chunk.getDocId(), e.getMessage());
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
