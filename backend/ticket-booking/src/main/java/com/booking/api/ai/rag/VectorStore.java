package com.booking.api.ai.rag;

import com.booking.api.entity.KnowledgeChunk;

import java.util.List;
import java.util.Set;

/**
 * Kho vector cho tìm kiếm ngữ nghĩa.
 *
 * Có interface ở đây không phải để trừu tượng hóa cho vui: nó ghi lại một quyết định
 * kiến trúc CÓ THỂ ĐẢO NGƯỢC. Bản cài đặt mặc định giữ toàn bộ vector trong RAM và
 * quét cosine tuần tự, vì corpus chỉ khoảng trăm chunk — với cỡ đó, quét thẳng nhanh
 * hơn ANN và không phải bảo trì index nào. Nếu corpus lớn lên hàng chục nghìn, viết
 * thêm QdrantVectorStore và cắm vào, không phải sửa chỗ nào khác.
 */
public interface VectorStore {

    /** Nạp lại toàn bộ kho từ các chunk đã có embedding. */
    void load(List<KnowledgeChunk> chunks);

    /**
     * Trả về topK chunk giống nhất, đã lọc bỏ những chunk dưới ngưỡng minSimilarity,
     * sắp xếp giảm dần theo điểm.
     */
    List<ScoredChunk> search(float[] queryVector, int topK, double minSimilarity);

    /**
     * Như trên nhưng chỉ xét chunk thuộc ngôn ngữ {@code lang}.
     *
     * {@code null} nghĩa là không lọc. Mã ngôn ngữ mà kho KHÔNG có vector nào cũng được
     * hiểu là không lọc: embedding là model đa ngôn ngữ, câu hỏi tiếng Nhật vẫn khớp được
     * chunk tiếng Việt, nên lọc cho bằng được rồi trả rỗng là tự bắn vào chân.
     */
    List<ScoredChunk> search(float[] queryVector, int topK, double minSimilarity, String lang);

    /** Số vector đang nạp. 0 nghĩa là tìm kiếm ngữ nghĩa đang không hoạt động. */
    int size();

    /** Ngôn ngữ thực sự có vector trong kho. */
    Set<String> languages();
}
