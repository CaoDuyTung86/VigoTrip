package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;

/** Một chunk kèm điểm số do một nhánh truy hồi chấm. */
public record ScoredChunk(KnowledgeChunk chunk, double score) {
}
