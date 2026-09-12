package com.booking.api.ai.rag;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mở rộng truy vấn bằng từ đồng nghĩa, mỗi ngôn ngữ một bảng.
 *
 * Giữ lại từ SYNONYM_MAP của ChatService cũ vì nó xử lý được thứ mà embedding hay
 * trượt: tiếng lóng ("bùng vé"), cách nói đời thường ("mấy cân"), và biến thể không
 * dấu. Khác biệt so với trước: bảng này không còn quyết định TRẢ VỀ nội dung gì
 * (trước đây khớp từ khóa là đưa thẳng một trong 6 mục FAQ hardcode) — giờ nó chỉ
 * thêm từ vào truy vấn, còn chấm điểm là việc của BM25 trên toàn corpus.
 *
 * VÌ SAO TÁCH BẢNG THEO NGÔN NGỮ: từ khi HybridRetriever lọc theo `lang`, chỉ mục mà
 * một câu hỏi tiếng Anh được chấm trên đó CHỈ còn chunk tiếng Anh. Ném thêm từ khóa
 * tiếng Việt vào truy vấn đó không khớp được gì — nó chỉ làm truy vấn dài ra. Chiều
 * ngược lại cũng vậy.
 *
 * BẢNG TIẾNG ANH CÒN GÁNH VIỆC CỦA BỘ TÁCH TỪ GỐC (stemmer): BM25 ở đây so khớp mặt
 * chữ, nên "cancel" không khớp "cancellation", "pay" không khớp "paid". Cắm một
 * stemmer tiếng Anh thật vào sẽ kéo theo thư viện mới và đụng luôn cả token tiếng
 * Việt — với corpus cỡ này, liệt tay vài biến thể hay gặp rẻ hơn và kiểm soát được.
 */
public final class SynonymExpander {

    /** Cụm từ trong câu hỏi -> các từ khóa bổ sung ném vào truy vấn. */
    private static final Map<String, List<String>> VI_SYNONYMS = Map.ofEntries(
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

            Map.entry("tre em", List.of("tre em", "em be", "tuoi")),
            Map.entry("em be", List.of("tre em", "em be")),
            Map.entry("tre nho", List.of("tre em")),

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

    /**
     * Bảng tiếng Anh. Phần lớn là biến thể hình thái mà BM25 không tự nối được
     * (cancel/cancellation, pay/paid, kid/children), phần còn lại là từ khách nói khác
     * hẳn từ trong tài liệu (coupon/discount, barcode/qr, hotline/customer care).
     */
    private static final Map<String, List<String>> EN_SYNONYMS = Map.ofEntries(
            Map.entry("bag", List.of("baggage", "luggage")),
            Map.entry("bags", List.of("baggage", "luggage")),
            Map.entry("luggage", List.of("baggage", "luggage")),
            Map.entry("baggage", List.of("baggage", "luggage")),
            Map.entry("suitcase", List.of("baggage", "luggage")),
            Map.entry("carry on", List.of("carry", "cabin", "baggage")),
            Map.entry("overweight", List.of("excess", "allowance", "fee")),
            Map.entry("kilo", List.of("kg", "allowance")),
            Map.entry("kilos", List.of("kg", "allowance")),

            Map.entry("cancel", List.of("cancel", "cancelled", "cancellation", "refund")),
            Map.entry("refund", List.of("refund", "refunded", "cancellation")),
            Map.entry("money back", List.of("refund", "cancellation")),
            Map.entry("no show", List.of("miss", "refund", "departure")),
            Map.entry("miss", List.of("miss", "no-show", "departure")),
            Map.entry("change my ticket", List.of("swapping", "cancel", "trip")),

            Map.entry("pet", List.of("pet", "pets", "animal", "carrier")),
            Map.entry("dog", List.of("dog", "pet", "pets", "carrier")),
            Map.entry("cat", List.of("cat", "pet", "pets", "carrier")),
            Map.entry("puppy", List.of("dog", "pet", "pets")),

            Map.entry("kid", List.of("child", "children", "fare")),
            Map.entry("kids", List.of("child", "children", "fare")),
            Map.entry("child", List.of("child", "children", "infant")),
            Map.entry("baby", List.of("infant", "children")),
            Map.entry("toddler", List.of("infant", "children")),

            Map.entry("pay", List.of("payment", "pay", "vnpay")),
            Map.entry("paid", List.of("payment", "paid", "vnpay")),
            Map.entry("card", List.of("payment", "visa", "mastercard", "atm")),
            Map.entry("charged", List.of("charged", "payment", "transaction")),
            Map.entry("invoice", List.of("invoice", "vat", "provider")),
            Map.entry("receipt", List.of("invoice", "receipts", "transaction")),

            Map.entry("promo code", List.of("discount", "voucher", "promo")),
            Map.entry("coupon", List.of("discount", "voucher", "promo")),
            Map.entry("discount", List.of("discount", "voucher", "promo")),
            Map.entry("voucher", List.of("discount", "voucher", "promo")),

            Map.entry("qr", List.of("qr", "scan", "code")),
            Map.entry("barcode", List.of("qr", "scan", "code")),
            Map.entry("boarding", List.of("board", "scan", "staff")),
            Map.entry("check in", List.of("checked", "scan", "qr")),

            Map.entry("hotline", List.of("hotline", "support", "customer care")),
            Map.entry("phone", List.of("hotline", "phone", "support")),
            Map.entry("complain", List.of("complaint", "complaints", "operator")),
            Map.entry("rude", List.of("rude", "complaint", "poor")),

            Map.entry("eticket", List.of("ticket", "email", "confirmation")),
            Map.entry("e ticket", List.of("ticket", "email", "confirmation")),
            Map.entry("mail", List.of("email", "confirmation")),
            Map.entry("otp", List.of("verification", "code")),
            Map.entry("sign up", List.of("register", "account")),
            Map.entry("log in", List.of("login", "account")),
            Map.entry("round trip", List.of("round", "outbound", "return")),
            Map.entry("return ticket", List.of("round", "outbound", "return")),
            Map.entry("delayed", List.of("delayed", "rescheduled", "status")),
            Map.entry("late", List.of("delayed", "departure")),
            Map.entry("cheapest", List.of("cheapest", "price", "filters")));

    /**
     * Bảng tiếng Nhật. Nhỏ hơn hẳn hai bảng trên vì bigram đã tự gánh phần lớn việc:
     * "手荷物" và "荷物" chung nhau bigram 荷物 nên khớp được mà không cần khai báo gì.
     * Chỉ còn lại những cặp KHÁC MẶT CHỮ mà người hỏi hay dùng lẫn: từ ngoại lai viết
     * katakana so với từ thuần Nhật, và cách nói đời thường so với từ trong tài liệu.
     */
    private static final Map<String, List<String>> JA_SYNONYMS = Map.ofEntries(
            Map.entry("ペット", List.of("ペット", "動物", "犬", "猫")),
            Map.entry("犬", List.of("ペット", "犬", "動物")),
            Map.entry("猫", List.of("ペット", "猫", "動物")),
            Map.entry("スーツケース", List.of("手荷物", "荷物")),
            Map.entry("バッグ", List.of("手荷物", "荷物")),
            Map.entry("キャンセル", List.of("キャンセル", "取り消し", "払い戻し")),
            // KHÔNG nối 返金 sang キャンセル: bộ đo cho thấy câu hỏi "返金はいつ口座に入る"
            // (bao giờ tiền về) bị đẩy xuống hạng 5 vì mấy chunk về hủy vé được cộng điểm oan.
            // Hỏi về tiền về tài khoản không phải là hỏi cách hủy.
            Map.entry("返金", List.of("払い戻し", "返金", "口座")),
            Map.entry("払い戻し", List.of("払い戻し", "返金")),
            Map.entry("電車", List.of("列車", "鉄道")),
            Map.entry("キロ", List.of("kg", "手荷物", "重量")),
            Map.entry("カード", List.of("カード", "支払い", "決済")),
            Map.entry("子供", List.of("子供", "小児", "幼児")),
            Map.entry("赤ちゃん", List.of("幼児", "子供")),
            Map.entry("支払い", List.of("支払い", "決済", "カード")),
            Map.entry("クーポン", List.of("割引", "クーポン", "コード")),
            Map.entry("メール", List.of("メール", "確認", "チケット")),
            Map.entry("電話", List.of("電話", "問い合わせ", "サポート")),
            Map.entry("遅れ", List.of("遅延", "変更", "出発")));

    /** Bảng tiếng Trung, cùng nguyên tắc với bảng tiếng Nhật. */
    private static final Map<String, List<String>> ZH_SYNONYMS = Map.ofEntries(
            Map.entry("宠物", List.of("宠物", "动物", "狗", "猫")),
            Map.entry("狗", List.of("宠物", "狗", "动物")),
            Map.entry("猫", List.of("宠物", "猫", "动物")),
            Map.entry("箱子", List.of("行李", "托运")),
            Map.entry("背包", List.of("行李", "随身")),
            Map.entry("退票", List.of("退票", "取消", "退款")),
            Map.entry("退钱", List.of("退款", "退票")),
            Map.entry("退款", List.of("退款", "退票", "取消")),
            Map.entry("小孩", List.of("儿童", "小孩", "婴儿")),
            Map.entry("宝宝", List.of("婴儿", "儿童")),
            Map.entry("付款", List.of("付款", "支付", "银行卡")),
            Map.entry("付钱", List.of("付款", "支付", "银行卡")),
            Map.entry("刷卡", List.of("银行卡", "支付", "付款")),
            Map.entry("优惠码", List.of("优惠", "折扣", "代码")),
            Map.entry("邮件", List.of("邮件", "确认", "车票")),
            Map.entry("电话", List.of("电话", "联系", "客服")),
            Map.entry("晚点", List.of("延误", "改点", "出发")));

    private static final Map<String, Map<String, List<String>>> BY_LANG = Map.of(
            "vi", VI_SYNONYMS,
            "en", EN_SYNONYMS,
            "ja", JA_SYNONYMS,
            "zh", ZH_SYNONYMS);

    private SynonymExpander() {
    }

    /** Mở rộng không ràng buộc ngôn ngữ: áp mọi bảng. */
    public static List<String> expand(String query) {
        return expand(query, null);
    }

    /**
     * Trả về token của truy vấn kèm token đồng nghĩa của đúng ngôn ngữ đang tra.
     *
     * Ngôn ngữ null, rỗng, hoặc chưa có bảng riêng ({@code ja}, {@code zh}) thì áp mọi
     * bảng. Đây là hành vi ăn khớp với truy hồi: những ngôn ngữ đó cũng không bị lọc
     * chỉ mục, nên truy vấn được phép với sang cả hai kho từ.
     *
     * Dùng LinkedHashSet để token gốc đứng trước và không bị lặp (lặp sẽ làm BM25 chấm
     * điểm lệch).
     */
    public static List<String> expand(String query, String lang) {
        List<String> queryTokens = TextNormalizer.tokenize(query);
        Set<String> tokens = new LinkedHashSet<>(queryTokens);

        // So khớp theo RANH GIỚI TỪ chứ không phải chuỗi con. Trước đây khớp chuỗi con
        // nên câu hỏi tiếng Anh "how do i choose a seat" dính khóa "cho" và bị nhét thêm
        // đống từ về thú cưng. Ghép lại từ chính token của truy vấn, nên vế trái và vế
        // phải của phép so khớp đi qua đúng một bộ chuẩn hóa.
        String haystack = " " + String.join(" ", queryTokens) + " ";

        // Khóa CJK thì ngược lại, PHẢI khớp chuỗi con: tiếng Nhật và tiếng Trung viết
        // liền không dấu cách nên không có ranh giới từ để mà dựa vào, và token của
        // chúng là bigram chứ không phải nguyên từ.
        String cjkHaystack = Normalizer.normalize(query == null ? "" : query, Normalizer.Form.NFKC);

        for (Map<String, List<String>> table : tablesFor(lang)) {
            for (Map.Entry<String, List<String>> entry : table.entrySet()) {
                String key = entry.getKey();
                boolean matched = TextNormalizer.containsCjk(key)
                        ? cjkHaystack.contains(key)
                        : haystack.contains(" " + key + " ");
                if (matched) {
                    for (String synonym : entry.getValue()) {
                        tokens.addAll(TextNormalizer.tokenize(synonym));
                    }
                }
            }
        }
        return new ArrayList<>(tokens);
    }

    private static List<Map<String, List<String>>> tablesFor(String lang) {
        String normalized = LangFilter.normalize(lang);
        // Map.of() ném NullPointerException khi tra khóa null, nên phải chặn trước.
        Map<String, List<String>> table = normalized == null ? null : BY_LANG.get(normalized);
        return table != null ? List.of(table) : List.copyOf(BY_LANG.values());
    }
}
