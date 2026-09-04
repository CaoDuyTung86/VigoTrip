package com.booking.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class ChatRequest {
    private String message;
    private String sessionId;
    private List<MessageDto> history;
    private String language;
    private String captchaToken;
    /**
     * Định danh mà client đặt trước cho câu trả lời sắp nhận, để sau này bấm 👍/👎 thì
     * chấm đúng vào lượt đó. Xem ChatMessage#messageRef.
     */
    private String messageRef;
}
