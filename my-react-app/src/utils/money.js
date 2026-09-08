/**
 * Viết số tiền theo quy ước của ngôn ngữ đang hiển thị.
 *
 * Trước đây mỗi chỗ tự viết `Number(x).toLocaleString("vi-VN") + " đ"`, tức là khoá cứng
 * cách viết tiếng Việt vào 85 chỗ trên toàn bộ giao diện. Khách xem bản English vẫn đọc
 * "677.450 đ" — dấu chấm ở vị trí mà người đọc tiếng Anh hiểu là dấu thập phân, nên con số
 * trông như sáu trăm bảy mươi bảy đồng.
 *
 * Ký hiệu tiền giữ nguyên VND ở mọi ngôn ngữ vì hệ thống chỉ thu bằng VND — đổi ký hiệu mà
 * không đổi tỉ giá là nói dối khách về số tiền họ sắp trả. Cái đổi theo ngôn ngữ chỉ là
 * cách viết: "1.500.000 đ" so với "1,500,000 VND".
 *
 * Phải khớp với mail.currency trong backend/.../messages*.properties, để cùng một đơn hàng
 * hiện cùng một con số trên web và trong thư xác nhận.
 */

const LOCALE_BY_LANG = {
  vi: "vi-VN",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-TW",
};

/** Chữ "đồng" đặt sau con số. Tiếng Việt dùng "đ" quen thuộc, còn lại dùng mã ISO. */
const SUFFIX_BY_LANG = {
  vi: "đ",
  en: "VND",
  ja: "VND",
  zh: "VND",
};

/**
 * Quy mã lạ về tiếng Việt, MỘT lần cho cả hai bảng.
 *
 * Tra riêng từng bảng rồi mỗi bảng tự rơi về mặc định của nó là cách sinh ra "1.000 VND":
 * dấu phân nhóm lấy theo tiếng Việt còn ký hiệu tiền lấy theo nhánh mặc định — một cách viết
 * không thuộc về ngôn ngữ nào.
 */
const SUPPORTED = ["vi", "en", "ja", "zh"];
const normalize = (code) => (SUPPORTED.includes(code) ? code : "vi");

/**
 * @param {number|string|null|undefined} amount số tiền, đơn vị đồng
 * @param {string} langCode mã ngôn ngữ đang hiển thị (currentLanguage.code)
 * @returns {string} ví dụ "1.500.000 đ" (vi) hoặc "1,500,000 VND" (en/ja/zh)
 */
export const formatMoney = (amount, langCode = "vi") => {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  const lang = normalize(langCode);
  return `${safe.toLocaleString(LOCALE_BY_LANG[lang])} ${SUFFIX_BY_LANG[lang]}`;
};

/** Chỉ phần chữ số, cho những chỗ tự đặt ký hiệu tiền (ví dụ dấu trừ của khoản giảm giá). */
export const formatAmount = (amount, langCode = "vi") => {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(LOCALE_BY_LANG[normalize(langCode)]);
};

export default formatMoney;
