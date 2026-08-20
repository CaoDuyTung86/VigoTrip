package com.booking.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Một mẩu tri thức của chatbot kèm vector embedding.
 *
 * Thay cho FAQ_DB hardcode trong ChatService: tri thức giờ nằm trong DB, sửa được
 * lúc chạy thay vì phải sửa code rồi deploy lại.
 *
 * VÌ SAO EMBEDDING LƯU DẠNG BASE64 CHỨ KHÔNG PHẢI byte[]:
 * dự án chạy trên cả SQL Server (local/docker) lẫn PostgreSQL (Neon) với
 * ddl-auto=update và không có Flyway. Trên PostgreSQL, Hibernate ánh xạ
 * `@Lob byte[]` thành kiểu `oid` (large object) — phải quản lý vòng đời riêng và
 * hành vi khác hẳn `bytea`. Một cột chuỗi thường thì ba dialect đều xử lý như nhau,
 * đổi lại chỉ tốn thêm 33% dung lượng cho vài trăm dòng. Đây là đánh đổi đáng.
 */
@Entity
@Table(name = "tri_thuc", indexes = {
        @Index(name = "idx_tri_thuc_doc_id", columnList = "doc_id"),
        @Index(name = "idx_tri_thuc_active", columnList = "active")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "chunk_id")
    private Long id;

    /** Định danh ổn định từ file YAML nguồn, dùng để đối chiếu khi seed lại. */
    @Column(name = "doc_id", nullable = false, length = 100)
    private String docId;

    @Column(length = 255)
    private String title;

    @Column(length = 4000, nullable = false)
    private String content;

    /** Nhóm chủ đề: BAGGAGE, CANCEL, PETS, PAYMENT, CHECKIN, ... */
    @Column(length = 50)
    private String category;

    /** Mã ngôn ngữ của nội dung: vi | en | ja | zh */
    @Column(length = 8)
    private String lang;

    /**
     * Vector embedding, float[] đã serialize rồi mã hóa Base64.
     * length > 4000 để Hibernate chọn nvarchar(max) trên SQL Server.
     */
    @Column(name = "embedding_base64", length = 65535)
    private String embeddingBase64;

    /** Model đã sinh ra embedding này — đổi model thì phải embed lại. */
    @Column(name = "embedding_model", length = 100)
    private String embeddingModel;

    @Column(name = "dimensions")
    private Integer dimensions;

    /** Hash của nội dung; đổi nội dung thì phải embed lại. */
    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
