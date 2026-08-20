package com.booking.api.dto;

import com.booking.api.entity.KnowledgeChunk;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Biểu diễn của một chunk tri thức cho API quản trị.
 *
 * Cố tình KHÔNG trả về trường embedding: nó là chuỗi Base64 vài nghìn ký tự, không có
 * ích gì cho người đọc mà lại làm phình response. Thay vào đó chỉ báo đã có vector hay
 * chưa qua cờ hasEmbedding.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeChunkDTO {

    private Long id;

    @NotBlank(message = "docId không được để trống")
    @Size(max = 100, message = "docId tối đa 100 ký tự")
    private String docId;

    @Size(max = 255, message = "Tiêu đề tối đa 255 ký tự")
    private String title;

    @NotBlank(message = "Nội dung không được để trống")
    @Size(max = 4000, message = "Nội dung tối đa 4000 ký tự")
    private String content;

    @Size(max = 50)
    private String category;

    @Size(max = 8)
    private String lang;

    private Boolean active;

    private Boolean hasEmbedding;
    private String embeddingModel;
    private Integer dimensions;
    private LocalDateTime updatedAt;

    public static KnowledgeChunkDTO from(KnowledgeChunk chunk) {
        return new KnowledgeChunkDTO(
                chunk.getId(),
                chunk.getDocId(),
                chunk.getTitle(),
                chunk.getContent(),
                chunk.getCategory(),
                chunk.getLang(),
                chunk.getActive(),
                chunk.getEmbeddingBase64() != null && !chunk.getEmbeddingBase64().isBlank(),
                chunk.getEmbeddingModel(),
                chunk.getDimensions(),
                chunk.getUpdatedAt());
    }

    public KnowledgeChunk toEntity() {
        return KnowledgeChunk.builder()
                .id(id)
                .docId(docId)
                .title(title)
                .content(content)
                .category(category)
                .lang(lang)
                .active(active)
                .build();
    }
}
