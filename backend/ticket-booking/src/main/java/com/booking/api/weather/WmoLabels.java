package com.booking.api.weather;

/**
 * Mã thời tiết WMO -&gt; một cụm chữ tiếng Việt.
 *
 * <p><b>Vì sao backend lại có bảng chữ, trong khi cả kiến trúc thời tiết cố tình chỉ trả mã.</b>
 * Giao diện nhận mã rồi tự tra bảng dịch của nó, và đó vẫn là đường đúng cho khối thời tiết trên
 * trang: mỗi ngôn ngữ có câu chữ riêng, không ai phải nhận "light rain shower" từ máy chủ. Nhưng
 * trợ lý AI thì khác hẳn — cái nó nhận không phải dữ liệu để vẽ ra màn hình mà là văn xuôi để
 * đọc, và con số 80 tự nó không nói với model rằng ngoài trời đang mưa rào.
 *
 * <p>Chữ ở đây là tiếng Việt, giống mọi kết quả công cụ khác của chatbot; phần dịch sang ngôn ngữ
 * của khách do model làm ở bước trả lời cuối, theo đúng luật ngôn ngữ trong system prompt.
 *
 * <p><b>Phải khớp với {@code my-react-app/src/utils/weather.js}.</b> Hai chỗ cùng nhóm mã theo
 * cùng một cách, nên sửa nhóm ở một bên mà quên bên kia thì khối trên trang ghi "mưa nhỏ" còn
 * trợ lý nói "mưa to" cho cùng một ngày. Nhóm ở đây chép từ bảng {@code WMO_GROUPS} bên đó.
 */
public final class WmoLabels {

    private WmoLabels() {
    }

    /**
     * Chữ mô tả cho một mã WMO.
     *
     * <p>Mã lạ trả về "không rõ" chứ không đoán sang nhóm gần nhất: model đọc "không rõ" thì bỏ
     * qua, còn đọc một nhóm đoán bừa thì nói với khách rằng trời quang trong khi nó là mưa đá.
     */
    public static String vi(int code) {
        return switch (code) {
            case 0 -> "trời quang";
            case 1 -> "ít mây";
            case 2 -> "có mây";
            case 3 -> "nhiều mây";
            case 45, 48 -> "sương mù";
            case 51, 53, 55, 56, 57 -> "mưa phùn";
            case 61 -> "mưa nhỏ";
            case 63 -> "mưa";
            case 65, 66, 67 -> "mưa to";
            case 71, 73, 75, 77, 85, 86 -> "mưa tuyết";
            case 80, 81 -> "mưa rào";
            case 82 -> "mưa rào rất to";
            case 95 -> "dông";
            case 96, 99 -> "dông kèm mưa đá";
            default -> "không rõ";
        };
    }
}
