package com.booking.api.controller;

import com.booking.api.dto.AnnouncementDTO;
import com.booking.api.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Dải tin chạy trên Header. Công khai — khách vãng lai cũng thấy, và nội dung không phụ
 * thuộc người đăng nhập là ai.
 */
@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    /**
     * GET /api/announcements
     *
     * Cache-Control 60 giây là lớp chắn thứ hai sau cache phía máy chủ: client gọi lại mỗi
     * lần cửa sổ được focus, nên người chuyển tab qua lại liên tục sẽ tự nhận bản trong bộ
     * nhớ đệm của trình duyệt thay vì đi hết đường tới Render. Không dùng ETag vì thân
     * response nhỏ hơn cả phần header cần thêm để thương lượng.
     */
    @GetMapping
    public ResponseEntity<List<AnnouncementDTO>> list() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic())
                .body(announcementService.getActiveAnnouncements());
    }
}
