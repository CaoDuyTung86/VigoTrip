// @ts-check
/**
 * Địa chỉ liên hệ hiển thị ở footer và hai trang pháp lý.
 *
 * VÌ SAO LÀ BIẾN MÔI TRƯỜNG chứ không phải chuỗi cứng:
 *
 * Mail HỆ THỐNG gửi đi (mã xác thực, mã đặt lại mật khẩu) xuất phát từ
 * BREVO_SENDER_EMAIL — một địa chỉ đã verify trong Brevo, xem application.yml. Nhưng giao
 * diện lại bảo người dùng viết THƯ VỀ support@vigotrip.vn, một hộp thư không ai nhận:
 * dự án không sở hữu tên miền vigotrip.vn. Người dùng gặp sự cố sẽ gửi thư vào hư không.
 *
 * Đặt ở đây để đổi một chỗ là đổi hết, và để giá trị thật khai báo được ở Environment
 * Variables của Vercel — KHÔNG commit địa chỉ cá nhân vào repo công khai, nó sẽ bị quét.
 *
 * Giá trị mặc định giữ nguyên tên miền thương hiệu cho ảnh chụp màn hình và bản demo;
 * khi nào có hộp thư thật thì set VITE_SUPPORT_EMAIL.
 */
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || "support@vigotrip.vn";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
