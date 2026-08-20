package com.booking.api.controller;

import com.booking.api.ai.rag.KnowledgeService;
import com.booking.api.dto.KnowledgeChunkDTO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Quản trị knowledge base của chatbot.
 *
 * Chỉ ADMIN. Đường dẫn nằm dưới /api/admin/** nên đã được SecurityConfig chặn sẵn theo
 * vai trò; annotation @PreAuthorize ở đây là lớp phòng thủ thứ hai, phòng khi ai đó sửa
 * cấu hình đường dẫn về sau.
 */
@RestController
@RequestMapping("/api/admin/knowledge")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ADMIN')")
public class KnowledgeController {

    private final KnowledgeService knowledgeService;

    @GetMapping
    public ResponseEntity<List<KnowledgeChunkDTO>> list() {
        return ResponseEntity.ok(knowledgeService.findAll().stream()
                .map(KnowledgeChunkDTO::from)
                .toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<KnowledgeChunkDTO> get(@PathVariable Long id) {
        return knowledgeService.findById(id)
                .map(KnowledgeChunkDTO::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Xem trước chatbot sẽ truy hồi những gì cho một câu hỏi.
     * Rất hữu ích khi soạn tri thức: thấy ngay câu hỏi có chạm đúng chunk hay không
     * mà không phải mở chatbot lên chat thử.
     */
    @GetMapping("/preview")
    public ResponseEntity<List<KnowledgeChunkDTO>> preview(@RequestParam String query,
                                                           @RequestParam(defaultValue = "5") int topK) {
        return ResponseEntity.ok(knowledgeService.preview(query, topK).stream()
                .map(KnowledgeChunkDTO::from)
                .toList());
    }

    @PostMapping
    public ResponseEntity<Object> create(@Valid @RequestBody KnowledgeChunkDTO dto) {
        try {
            return ResponseEntity.ok(KnowledgeChunkDTO.from(
                    knowledgeService.create(dto.toEntity())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<KnowledgeChunkDTO> update(@PathVariable Long id,
                                                    @Valid @RequestBody KnowledgeChunkDTO dto) {
        return knowledgeService.update(id, dto.toEntity())
                .map(KnowledgeChunkDTO::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Xóa mềm: chunk bị ẩn khỏi truy hồi nhưng vector đã sinh vẫn được giữ lại. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        return knowledgeService.deactivate(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PostMapping("/reload")
    public ResponseEntity<Map<String, String>> reload() {
        knowledgeService.reloadIndexes();
        return ResponseEntity.ok(Map.of("message", "Đã nạp lại chỉ mục tri thức."));
    }
}
