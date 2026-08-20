package com.booking.api.ai.rag;

import com.booking.api.ai.embedding.EmbeddingClient;
import com.booking.api.entity.KnowledgeChunk;
import com.booking.api.repository.KnowledgeChunkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Seeder chạy ở MỖI lần khởi động, và Render free tier khởi động lại rất thường xuyên.
 * Nếu mỗi lần boot đều embed lại toàn bộ corpus thì quota API sẽ bốc hơi mà chẳng đổi
 * lại được gì — nên tính idempotent ở đây là yêu cầu về chi phí, không phải chuyện
 * "code cho đẹp".
 */
class KnowledgeBaseSeederTest {

    /** Embedding client giả, đếm số văn bản đã embed. */
    private static class CountingEmbeddingClient implements EmbeddingClient {
        final AtomicInteger embeddedTexts = new AtomicInteger();
        boolean available = true;
        String model = "stub-embedding-v1";

        @Override
        public boolean isAvailable() {
            return available;
        }

        @Override
        public int dimensions() {
            return 4;
        }

        @Override
        public String modelName() {
            return model;
        }

        @Override
        public List<float[]> embedAll(List<String> texts) {
            embeddedTexts.addAndGet(texts.size());
            return texts.stream().map(t -> new float[]{1, 0, 0, 0}).toList();
        }
    }

    private KnowledgeChunkRepository repository;
    private CountingEmbeddingClient embeddingClient;
    private HybridRetriever retriever;
    private RagProperties properties;
    private KnowledgeBaseSeeder seeder;

    /** Lưu trữ giả lập DB giữa các lần chạy seeder. */
    private List<KnowledgeChunk> stored = new ArrayList<>();

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeChunkRepository.class);
        embeddingClient = new CountingEmbeddingClient();
        retriever = mock(HybridRetriever.class);
        properties = new RagProperties();

        when(repository.findAll()).thenAnswer(inv -> new ArrayList<>(stored));

        seeder = new KnowledgeBaseSeeder(repository, embeddingClient, retriever, properties);
    }

    /** Chạy seeder và ghi lại những gì nó lưu, mô phỏng DB bền giữa các lần boot. */
    @SuppressWarnings("unchecked")
    private void runSeeder() {
        seeder.run();
        ArgumentCaptor<List<KnowledgeChunk>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository, atLeastOnce()).saveAll(captor.capture());
        stored = new ArrayList<>(captor.getAllValues().get(0));
    }

    @Test
    @DisplayName("Lần chạy đầu đọc file YAML và embed toàn bộ chunk")
    void firstRunEmbedsEverything() {
        runSeeder();

        assertThat(stored).as("phải đọc được knowledge base thật trong resources").isNotEmpty();
        assertThat(embeddingClient.embeddedTexts.get()).isEqualTo(stored.size());
        assertThat(stored).allSatisfy(chunk -> {
            assertThat(chunk.getEmbeddingBase64()).isNotBlank();
            assertThat(chunk.getContentHash()).isNotBlank();
            assertThat(chunk.getActive()).isTrue();
        });
    }

    @Test
    @DisplayName("Lần chạy thứ hai KHÔNG embed lại gì khi nội dung không đổi")
    void secondRunEmbedsNothing() {
        runSeeder();
        int afterFirstRun = embeddingClient.embeddedTexts.get();
        assertThat(afterFirstRun).isPositive();

        embeddingClient.embeddedTexts.set(0);
        runSeeder();

        assertThat(embeddingClient.embeddedTexts.get())
                .as("khởi động lại không được đốt lại quota embedding")
                .isZero();
    }

    @Test
    @DisplayName("Đổi nội dung một chunk chỉ embed lại đúng chunk đó")
    void changedContentReEmbedsOnlyThatChunk() {
        runSeeder();
        embeddingClient.embeddedTexts.set(0);

        // Mô phỏng nội dung file nguồn đã đổi: hash lưu trong DB không còn khớp.
        stored.get(0).setContentHash("hash-cu-khong-con-dung");
        runSeeder();

        assertThat(embeddingClient.embeddedTexts.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("Đổi model embedding buộc embed lại toàn bộ")
    void changingEmbeddingModelReEmbedsEverything() {
        runSeeder();
        int total = stored.size();
        embeddingClient.embeddedTexts.set(0);

        // Vector sinh bởi model khác không so sánh được với nhau.
        embeddingClient.model = "stub-embedding-v2";
        runSeeder();

        assertThat(embeddingClient.embeddedTexts.get()).isEqualTo(total);
    }

    @Test
    @DisplayName("Không có embedding client vẫn seed được, chỉ là không kèm vector")
    void seedsWithoutEmbeddingWhenUnavailable() {
        embeddingClient.available = false;

        runSeeder();

        assertThat(stored).isNotEmpty();
        assertThat(embeddingClient.embeddedTexts.get()).isZero();
        assertThat(stored).allSatisfy(chunk -> {
            assertThat(chunk.getContent()).isNotBlank();
            assertThat(chunk.getEmbeddingBase64()).isNull();
        });
    }

    @Test
    @DisplayName("rag.enabled=false thì bỏ qua hoàn toàn, không đụng DB")
    void skipsEntirelyWhenDisabled() {
        properties.setEnabled(false);

        seeder.run();

        verify(repository, org.mockito.Mockito.never()).saveAll(anyList());
    }

    @Test
    @DisplayName("Luôn nạp lại chỉ mục sau khi seed")
    void reloadsIndexAfterSeeding() {
        runSeeder();

        verify(retriever).reload();
    }
}
