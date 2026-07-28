package com.booking.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class ChatRequest {
    private String message;
    private String sessionId;
    private List<MessageDto> history;
}
