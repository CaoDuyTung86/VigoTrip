package com.booking.api.ai.rag;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class VectorCodecTest {

    @Test
    @DisplayName("Mã hóa rồi giải mã trả lại đúng vector ban đầu")
    void encodeDecodeRoundTrip() {
        float[] original = {0.1f, -0.5f, 0.0f, 123.456f, -0.000123f};

        float[] restored = VectorCodec.decode(VectorCodec.encode(original));

        assertThat(restored).containsExactly(original);
    }

    @Test
    @DisplayName("Giữ nguyên số chiều cho vector cỡ thật")
    void preservesDimensionality() {
        float[] original = new float[768];
        for (int i = 0; i < original.length; i++) {
            original[i] = (float) Math.sin(i);
        }

        float[] restored = VectorCodec.decode(VectorCodec.encode(original));

        assertThat(restored).hasSize(768);
        assertThat(restored[500]).isEqualTo(original[500]);
    }

    @Test
    @DisplayName("Giá trị null được xử lý an toàn ở cả hai chiều")
    void handlesNulls() {
        assertThat(VectorCodec.encode(null)).isNull();
        assertThat(VectorCodec.decode(null)).isNull();
        assertThat(VectorCodec.decode("")).isNull();
    }

    @Test
    @DisplayName("Cosine của hai vector giống hệt nhau bằng 1")
    void cosineOfIdenticalVectorsIsOne() {
        float[] vector = {1.0f, 2.0f, 3.0f};

        assertThat(VectorCodec.cosineSimilarity(vector, vector)).isCloseTo(1.0, within(1e-9));
    }

    @Test
    @DisplayName("Cosine của hai vector trực giao bằng 0")
    void cosineOfOrthogonalVectorsIsZero() {
        assertThat(VectorCodec.cosineSimilarity(new float[]{1, 0}, new float[]{0, 1}))
                .isCloseTo(0.0, within(1e-9));
    }

    @Test
    @DisplayName("Cosine không phụ thuộc độ dài vector, chỉ phụ thuộc hướng")
    void cosineIgnoresMagnitude() {
        assertThat(VectorCodec.cosineSimilarity(new float[]{1, 1}, new float[]{100, 100}))
                .isCloseTo(1.0, within(1e-9));
    }

    @Test
    @DisplayName("Lệch số chiều trả về 0 thay vì ném lỗi")
    void mismatchedDimensionsReturnZeroInsteadOfThrowing() {
        // Xảy ra khi trong DB còn embedding cũ sinh bởi model khác số chiều.
        // Một lượt truy hồi không được sập chỉ vì gặp dòng dữ liệu cũ.
        assertThat(VectorCodec.cosineSimilarity(new float[]{1, 2, 3}, new float[]{1, 2}))
                .isEqualTo(0.0);
        assertThat(VectorCodec.cosineSimilarity(null, new float[]{1})).isEqualTo(0.0);
    }

    @Test
    @DisplayName("Vector toàn số 0 trả về 0, không chia cho 0")
    void zeroVectorDoesNotDivideByZero() {
        assertThat(VectorCodec.cosineSimilarity(new float[]{0, 0}, new float[]{1, 1}))
                .isEqualTo(0.0);
    }
}
