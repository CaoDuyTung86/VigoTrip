package com.booking.api.ai.rag;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;

/**
 * Chuyển đổi float[] &lt;-&gt; chuỗi Base64 để lưu vào cột chuỗi thường.
 *
 * Cố định little-endian để dữ liệu đã lưu đọc lại được trên mọi kiến trúc CPU.
 */
public final class VectorCodec {

    private VectorCodec() {
    }

    public static String encode(float[] vector) {
        if (vector == null) {
            return null;
        }
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * Float.BYTES).order(ByteOrder.LITTLE_ENDIAN);
        for (float value : vector) {
            buffer.putFloat(value);
        }
        return Base64.getEncoder().encodeToString(buffer.array());
    }

    public static float[] decode(String base64) {
        if (base64 == null || base64.isBlank()) {
            return null;
        }
        byte[] bytes = Base64.getDecoder().decode(base64);
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        float[] vector = new float[bytes.length / Float.BYTES];
        for (int i = 0; i < vector.length; i++) {
            vector[i] = buffer.getFloat();
        }
        return vector;
    }

    /**
     * Cosine similarity. Trả về 0 khi một trong hai vector có độ dài 0 hoặc lệch số chiều
     * (lệch chiều nghĩa là dữ liệu cũ sinh bởi model khác — coi như không khớp thay vì
     * ném lỗi làm hỏng cả lượt truy hồi).
     */
    public static double cosineSimilarity(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length || a.length == 0) {
            return 0.0;
        }
        double dot = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dot += (double) a[i] * b[i];
            normA += (double) a[i] * a[i];
            normB += (double) b[i] * b[i];
        }
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
