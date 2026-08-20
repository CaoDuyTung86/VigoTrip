package com.booking.api.ai.rag;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mở rộng truy vấn bằng từ đồng nghĩa tiếng Việt.
 *
 * Giữ lại từ SYNONYM_MAP của ChatService cũ vì nó xử lý được thứ mà embedding hay
 * trượt: tiếng lóng ("bùng vé"), cách nói đời thường ("mấy cân"), và biến thể không
 * dấu. Khác biệt so với trước: bảng này không còn quyết định TRẢ VỀ nội dung gì
 * (trước đây khớp từ khóa là đưa thẳng một trong 6 mục FAQ hardcode) — giờ nó chỉ
 * thêm từ vào truy vấn, còn chấm điểm là việc của BM25 trên toàn corpus.
 */
public final class SynonymExpander {

    /** Cụm từ trong câu hỏi -> các từ khóa bổ sung ném vào truy vấn. */
    private static final Map<String, List<String>> SYNONYMS = Map.ofEntries(
            Map.entry("thu cung", List.of("thu cung", "cho", "meo", "pet", "dong vat", "long")),
            Map.entry("cho", List.of("thu cung", "cho")),
            Map.entry("meo", List.of("thu cung", "meo")),
            Map.entry("cun", List.of("thu cung", "cho")),
            Map.entry("poodle", List.of("thu cung", "cho")),
            Map.entry("pet", List.of("thu cung")),

            Map.entry("huy ve", List.of("huy ve", "hoan tien", "hoan ve")),
            Map.entry("tra ve", List.of("huy ve", "hoan tien")),
            Map.entry("bung ve", List.of("huy ve", "hoan tien")),
            Map.entry("doi ve", List.of("doi ve", "huy ve")),
            Map.entry("hoan tien", List.of("hoan tien", "huy ve")),
            Map.entry("lay lai tien", List.of("hoan tien", "huy ve")),
            Map.entry("lo chuyen", List.of("huy ve", "hoan tien", "tre gio")),

            Map.entry("hanh ly", List.of("hanh ly", "vali", "ky gui", "xach tay", "kg")),
            Map.entry("vali", List.of("hanh ly", "vali")),
            Map.entry("xach tay", List.of("hanh ly", "xach tay")),
            Map.entry("ky gui", List.of("hanh ly", "ky gui")),
            Map.entry("may kg", List.of("hanh ly", "kg")),
            Map.entry("may can", List.of("hanh ly", "kg")),
            Map.entry("luggage", List.of("hanh ly")),
            Map.entry("baggage", List.of("hanh ly")),

            Map.entry("tre em", List.of("tre em", "em be", "tuoi")),
            Map.entry("em be", List.of("tre em", "em be")),
            Map.entry("tre nho", List.of("tre em")),
            Map.entry("baby", List.of("tre em", "em be")),

            Map.entry("thanh toan", List.of("thanh toan", "vnpay", "the", "vi dien tu")),
            Map.entry("chuyen khoan", List.of("thanh toan", "vnpay")),
            Map.entry("vnpay", List.of("thanh toan", "vnpay")),
            Map.entry("tra tien", List.of("thanh toan")),

            Map.entry("khuyen mai", List.of("khuyen mai", "voucher", "giam gia", "uu dai")),
            Map.entry("giam gia", List.of("khuyen mai", "voucher", "giam gia")),
            Map.entry("voucher", List.of("khuyen mai", "voucher")),
            Map.entry("uu dai", List.of("khuyen mai", "voucher")),
            Map.entry("re hon", List.of("khuyen mai", "giam gia")),

            Map.entry("check in", List.of("check in", "qr", "soat ve", "len xe")),
            Map.entry("qr", List.of("check in", "qr", "soat ve")),
            Map.entry("ma vach", List.of("check in", "qr", "soat ve")),
            Map.entry("soat ve", List.of("check in", "qr")),

            // Các khoảng trống từ vựng do bộ đo rag-eval.yml phát hiện: từ khách dùng
            // thật khác hẳn từ trong tài liệu.
            Map.entry("tong dai", List.of("ho tro", "lien he", "cham soc khach hang")),
            Map.entry("mail", List.of("email")),
            Map.entry("bat lua", List.of("chay no", "cam", "vu khi")),
            Map.entry("ca nha", List.of("nhieu", "hanh khach", "so luong")),
            Map.entry("di va ve", List.of("khu hoi")),
            Map.entry("ca hai chieu", List.of("khu hoi")),
            Map.entry("laptop", List.of("de vo", "thiet bi dien tu", "gia tri")),
            Map.entry("may anh", List.of("de vo", "thiet bi dien tu", "gia tri")),
            Map.entry("re nhat", List.of("gia", "loc", "tim chuyen")),
            Map.entry("lan dau", List.of("cac buoc", "dat ve")));

    private SynonymExpander() {
    }

    /**
     * Trả về token của truy vấn kèm token đồng nghĩa. Dùng LinkedHashSet để token gốc
     * đứng trước và không bị lặp (lặp sẽ làm BM25 chấm điểm lệch).
     */
    public static List<String> expand(String query) {
        Set<String> tokens = new LinkedHashSet<>(TextNormalizer.tokenize(query));
        String normalized = TextNormalizer.normalize(query);

        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            if (normalized.contains(entry.getKey())) {
                for (String synonym : entry.getValue()) {
                    tokens.addAll(TextNormalizer.tokenize(synonym));
                }
            }
        }
        return new ArrayList<>(tokens);
    }
}
