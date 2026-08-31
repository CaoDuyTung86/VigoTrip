package com.booking.api.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * validateHash là ranh giới tin cậy duy nhất của hai endpoint callback công khai: nới quá
 * thì ai cũng xác nhận được đơn, chặt quá thì callback thật của cổng bị từ chối và khách
 * mất tiền không có vé. Cả hai hướng sai đều phải bị khoá lại bằng test.
 */
class VNPayUtilTest {

    private static final String SECRET = "hash-secret-cua-merchant";

    /** Ghép chuỗi ký theo cách VNPayUtil làm, nhưng cho phép chọn cách mã hoá khoảng trắng. */
    private static String hashDataWith(Map<String, String> params, String spaceEncoding) {
        SortedMap<String, String> sorted = new TreeMap<>(params);
        String data = VNPayUtil.buildHashData(sorted);
        return "+".equals(spaceEncoding) ? data.replace("%20", "+") : data;
    }

    private static Map<String, String> callback(String orderInfo) {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Amount", "25000000");
        params.put("vnp_BankCode", "NCB");
        params.put("vnp_OrderInfo", orderInfo);
        params.put("vnp_PayDate", "20260831200000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TmnCode", "TMN12345");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_TxnRef", "abc123");
        return params;
    }

    /** Ký bộ tham số rồi gắn chữ ký vào chính nó, đúng như cổng gửi sang. */
    private static Map<String, String> signed(Map<String, String> params, String spaceEncoding) {
        Map<String, String> withHash = new HashMap<>(params);
        withHash.put("vnp_SecureHash", VNPayUtil.hmacSHA512(SECRET, hashDataWith(params, spaceEncoding)));
        return withHash;
    }

    @Test
    @DisplayName("Chữ ký ký theo %20 (đúng chuẩn v2.1.0) được chấp nhận")
    void acceptsPercent20Encoding() {
        assertThat(VNPayUtil.validateHash(signed(callback("Thanh toan don hang"), "%20"), SECRET)).isTrue();
    }

    @Test
    @DisplayName("Chữ ký ký theo '+' cũng được chấp nhận — cùng dữ liệu, cùng khoá")
    void acceptsPlusEncoding() {
        // URLEncoder của Java sinh '+' cho khoảng trắng; mã mẫu của VNPay phải thêm một bước
        // replace thủ công, và không phải công cụ nào bên cổng cũng làm. Trước khi nới, đúng
        // trường hợp này trả về 97 dù hash-secret hoàn toàn chính xác.
        assertThat(VNPayUtil.validateHash(signed(callback("Thanh toan don hang"), "+"), SECRET)).isTrue();
    }

    @Test
    @DisplayName("Không có khoảng trắng thì hai cách mã hoá là một, cả hai vẫn hợp lệ")
    void bothEncodingsIdenticalWithoutSpaces() {
        Map<String, String> params = callback("Thanh_toan_booking_123");
        assertThat(VNPayUtil.validateHash(signed(params, "%20"), SECRET)).isTrue();
        assertThat(VNPayUtil.validateHash(signed(params, "+"), SECRET)).isTrue();
    }

    @Test
    @DisplayName("Sai hash-secret vẫn bị từ chối ở CẢ HAI cách mã hoá")
    void rejectsWrongSecret() {
        assertThat(VNPayUtil.validateHash(signed(callback("Thanh toan don hang"), "%20"), "khoa-khac")).isFalse();
        assertThat(VNPayUtil.validateHash(signed(callback("Thanh toan don hang"), "+"), "khoa-khac")).isFalse();
    }

    @Test
    @DisplayName("Sửa một tham số sau khi ký thì chữ ký hỏng")
    void rejectsTamperedParams() {
        Map<String, String> tampered = signed(callback("Thanh toan don hang"), "%20");
        tampered.put("vnp_Amount", "100");

        assertThat(VNPayUtil.validateHash(tampered, SECRET))
                .as("nới cách mã hoá khoảng trắng không được nới luôn việc sửa dữ liệu")
                .isFalse();
    }

    @Test
    @DisplayName("Thiếu vnp_SecureHash thì từ chối, không văng lỗi")
    void rejectsMissingSignature() {
        assertThat(VNPayUtil.validateHash(callback("Thanh toan don hang"), SECRET)).isFalse();
    }

    @Test
    @DisplayName("vnp_SecureHashType không tham gia vào chuỗi ký")
    void ignoresSecureHashType() {
        Map<String, String> params = signed(callback("Thanh_toan_booking_123"), "%20");
        params.put("vnp_SecureHashType", "HMACSHA512");

        assertThat(VNPayUtil.validateHash(params, SECRET)).isTrue();
    }

    @Test
    @DisplayName("Khoảng trắng luôn được mã hoá thành %20, không phải '+'")
    void encodesSpaceAsPercent20() {
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_OrderInfo", "Thanh toan don hang");

        assertThat(VNPayUtil.buildQueryString(params)).isEqualTo("vnp_OrderInfo=Thanh%20toan%20don%20hang");
    }
}
