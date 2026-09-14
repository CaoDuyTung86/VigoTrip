package com.booking.api.i18n;

import java.util.List;
import java.util.Locale;

/**
 * Danh sách ngôn ngữ hệ thống hỗ trợ, và cách quy một chuỗi bất kỳ về một trong số đó.
 *
 * <p>Vì sao phải có danh sách trắng thay vì {@code Locale.forLanguageTag(x)}: giá trị này
 * đi vào từ request của người dùng rồi được lưu xuống cột {@code nguoi_dung.ngon_ngu}.
 * Nhận bừa thì cột đó sẽ dần chứa "en-US", "EN", "vi-VN", rác, hoặc chuỗi dài tuỳ ý —
 * và mỗi giá trị lạ là một lần {@code MessageSource} rơi về bản mặc định mà không ai biết
 * vì sao. Chặn ngay tại biên thì trong DB chỉ có đúng bốn giá trị, và chỗ nào cũng đọc
 * được cùng một tập.
 *
 * <p>Danh sách này phải khớp với {@code LANGUAGES} trong
 * {@code my-react-app/src/context/LanguageContext.jsx}.
 */
public final class SupportedLocales {

    /** Ngôn ngữ mặc định khi người dùng chưa từng chọn. Khách của VigoTrip chủ yếu đọc tiếng Việt. */
    public static final Locale DEFAULT = Locale.forLanguageTag("vi");

    private static final List<String> CODES = List.of("vi", "en", "ja", "zh");

    private SupportedLocales() {
    }

    /** Mã ngôn ngữ này có được hỗ trợ không. Dùng để từ chối request trước khi ghi vào DB. */
    public static boolean isSupported(String code) {
        return code != null && CODES.contains(code.trim().toLowerCase(Locale.ROOT));
    }

    /** Chuẩn hoá về đúng một trong bốn mã, hoặc null nếu không nhận ra. */
    public static String normalize(String code) {
        if (code == null) {
            return null;
        }
        String cleaned = code.trim().toLowerCase(Locale.ROOT);
        // Chấp nhận cả dạng "en-US" / "vi_VN" người dùng hoặc trình duyệt hay gửi kèm.
        int cut = cleaned.indexOf('-');
        if (cut < 0) {
            cut = cleaned.indexOf('_');
        }
        if (cut > 0) {
            cleaned = cleaned.substring(0, cut);
        }
        return CODES.contains(cleaned) ? cleaned : null;
    }

    /**
     * Thư gửi bằng ngôn ngữ này có bản dịch thật không, hay đang rơi về bản mặc định tiếng Anh.
     *
     * <p>Hỏi thẳng classpath thay vì giữ một danh sách tay: thêm messages_ja.properties là tự đúng,
     * còn danh sách tay thì sẽ có ngày báo "chưa dịch" về một thứ đã dịch, hoặc ngược lại.
     */
    public static boolean hasMailTranslation(String code) {
        String normalized = normalize(code);
        if (normalized == null) {
            return false;
        }
        // messages.properties CHÍNH LÀ bản tiếng Anh (xem chú thích đầu file đó).
        return "en".equals(normalized)
                || SupportedLocales.class.getResource("/messages_" + normalized + ".properties") != null;
    }

    /** Quy về Locale dùng được ngay; giá trị lạ hoặc null đều thành {@link #DEFAULT}. */
    public static Locale parse(String code) {
        String normalized = normalize(code);
        return normalized == null ? DEFAULT : Locale.forLanguageTag(normalized);
    }
}
