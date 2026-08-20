package com.booking.api.ai.embedding;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Client embedding qua endpoint /embeddings tương thích OpenAI (Gemini, và bất kỳ
 * nhà cung cấp nào nói cùng giao thức).
 *
 * Chạy trên máy chủ chứ không nhúng model vào tiến trình có chủ ý: Render free tier
 * giới hạn heap 256MB (-Xmx256m trong Dockerfile), không đủ chỗ cho một model
 * embedding cục bộ. Bản thân các vector thì nhỏ — vài trăm chunk chỉ hết vài MB.
 */
@Component
@Slf4j
public class OpenAiCompatibleEmbeddingClient implements EmbeddingClient {

    private final EmbeddingProperties properties;
    private final RestTemplate restTemplate;

    public OpenAiCompatibleEmbeddingClient(EmbeddingProperties properties, RestTemplate aiRestTemplate) {
        this.properties = properties;
        this.restTemplate = aiRestTemplate;
    }

    @Override
    public boolean isAvailable() {
        return properties.isConfigured();
    }

    @Override
    public int dimensions() {
        return properties.getDimensions();
    }

    @Override
    public String modelName() {
        return properties.getModel();
    }

    private String embeddingsUrl() {
        String base = properties.getBaseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/embeddings";
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<float[]> embedAll(List<String> texts) {
        if (!isAvailable()) {
            throw new EmbeddingException("Chưa cấu hình embedding (thiếu rag.embedding.api-key)");
        }
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }

        List<float[]> result = new ArrayList<>(texts.size());
        int batchSize = Math.max(1, properties.getBatchSize());

        for (int start = 0; start < texts.size(); start += batchSize) {
            List<String> batch = texts.subList(start, Math.min(texts.size(), start + batchSize));
            result.addAll(embedBatch(batch));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<float[]> embedBatch(List<String> batch) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", properties.getModel());
        body.put("input", batch);
        if (properties.getDimensions() > 0) {
            body.put("dimensions", properties.getDimensions());
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getApiKey());

        try {
            Map<String, Object> response = restTemplate.postForObject(
                    embeddingsUrl(), new HttpEntity<>(body, headers), Map.class);

            if (response == null || !response.containsKey("data")) {
                throw new EmbeddingException("Phản hồi embedding không có trường data");
            }
            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data.size() != batch.size()) {
                throw new EmbeddingException(
                        "Số vector trả về (" + data.size() + ") khác số văn bản gửi đi (" + batch.size() + ")");
            }

            List<float[]> vectors = new ArrayList<>(data.size());
            for (Map<String, Object> item : data) {
                List<Number> raw = (List<Number>) item.get("embedding");
                if (raw == null) {
                    throw new EmbeddingException("Một phần tử data thiếu trường embedding");
                }
                float[] vector = new float[raw.size()];
                for (int i = 0; i < raw.size(); i++) {
                    vector[i] = raw.get(i).floatValue();
                }
                vectors.add(vector);
            }
            return vectors;

        } catch (RestClientException e) {
            throw new EmbeddingException("Gọi API embedding thất bại: " + e.getMessage(), e);
        }
    }
}
