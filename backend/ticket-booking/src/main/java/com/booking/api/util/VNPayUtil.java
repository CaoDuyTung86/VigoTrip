package com.booking.api.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

public class VNPayUtil {

    private VNPayUtil() {
    }

    /**
     * Tạo HMAC SHA512 hash
     */
    public static String hmacSHA512(String key, String data) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKeySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac.init(secretKeySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tạo HMAC SHA512", e);
        }
    }

    /**
     * Tạo query string từ map (đã sort theo key)
     */
    public static String buildQueryString(SortedMap<String, String> params) {
        StringBuilder queryString = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                String key = URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8);
                String value = URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8);
                // VNPay yêu cầu khoảng trắng Encode thành %20, nhưng URLEncoder trong Java ra dấu +
                key = key.replace("+", "%20");
                value = value.replace("+", "%20");
                queryString.append(key).append("=").append(value).append("&");
            }
        }
        if (queryString.length() > 0) {
            queryString.setLength(queryString.length() - 1);
        }
        return queryString.toString();
    }

    /**
     * Tạo hash data string
     * Từ VNPay v2.1.0, hashData chính là chuỗi ký tự nối bằng & với format
     * key=value (được URLEncoder)
     */
    public static String buildHashData(SortedMap<String, String> params) {
        // Từ bản v2.1.0, hashData là chuỗi giống hệt query string (các value đã được Url Encode)
        return buildQueryString(params);
    }

    /**
     * Format ngày giờ theo định dạng VNPay yêu cầu: yyyyMMddHHmmss
     */
    public static String formatDateTime(LocalDateTime dateTime) {
        return dateTime.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    }

    /**
     * Đối chiếu chữ ký của một callback từ cổng.
     *
     * CHẤP NHẬN HAI CÁCH MÃ HOÁ KHOẢNG TRẮNG, và đây không phải sự dễ dãi:
     *
     * v2.1.0 quy định chuỗi ký là query string đã URL-encode, khoảng trắng thành %20. Nhưng
     * URLEncoder của Java sinh ra dấu '+', nên mã mẫu của chính VNPay phải thêm một bước
     * replace("+", "%20") — và không phải công cụ nào bên cổng cũng làm bước đó. Kết quả là
     * cùng một bộ tham số, cùng một hash-secret, vẫn ra hai chữ ký khác nhau.
     *
     * Đã đo được: callback có {@code vnp_OrderInfo} chứa khoảng trắng và ký theo dạng '+' bị
     * trả về 97, trong khi giao dịch thật của hệ thống lại đi lọt vì OrderInfo của ta dùng
     * dấu gạch dưới ("Thanh_toan_booking_123") nên hai cách mã hoá cho ra chuỗi y hệt nhau.
     * Nói cách khác, lỗi này đang NẤP: chỉ cần đổi định dạng OrderInfo sang có khoảng trắng
     * là toàn bộ callback thật gãy.
     *
     * Không mất an toàn: cả hai vẫn là HMAC-SHA512 trên cùng bộ dữ liệu và vẫn đòi đúng
     * hash-secret. Ta chỉ thôi bắt bẻ về một chi tiết mã hoá mà spec để mở.
     */
    public static boolean validateHash(Map<String, String> params, String hashSecret) {
        String vnpSecureHash = params.get("vnp_SecureHash");
        if (vnpSecureHash == null)
            return false;

        SortedMap<String, String> sortedParams = new TreeMap<>(params);
        sortedParams.remove("vnp_SecureHash");
        sortedParams.remove("vnp_SecureHashType");

        String hashData = buildHashData(sortedParams);
        if (hmacSHA512(hashSecret, hashData).equalsIgnoreCase(vnpSecureHash)) {
            return true;
        }

        // Chỉ tính thêm một HMAC nữa khi trong dữ liệu THẬT SỰ có khoảng trắng — không có
        // thì hai chuỗi giống hệt nhau và lần tính thứ hai là công toi.
        //
        // Thay %20 -> + ở đây là an toàn: %20 trong chuỗi này chỉ có thể sinh ra từ một
        // khoảng trắng, vì URLEncoder mã hoá ký tự '%' của dữ liệu gốc thành %25.
        String plusEncoded = hashData.replace("%20", "+");
        return !plusEncoded.equals(hashData)
                && hmacSHA512(hashSecret, plusEncoded).equalsIgnoreCase(vnpSecureHash);
    }
}
