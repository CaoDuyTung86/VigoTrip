/**
 * Ngày giờ chuyến đi, viết theo quy ước của ngôn ngữ đang hiển thị.
 *
 * Hai lỗi cần chữa cùng lúc:
 *
 *  1. Màn hình "Bước 4: Kiểm tra & Thanh toán" in thẳng chuỗi ISO của backend — khách nhìn
 *     thấy "2026-09-17T09:00:00" ngay trên khối tóm tắt trước khi bấm trả tiền.
 *  2. Các chỗ còn lại có định dạng, nhưng khoá cứng "vi-VN" nên bản English hiện
 *     "17/09/2026". Người đọc tiếng Anh mặc định hiểu số đầu là THÁNG, nên "09/12/2026"
 *     bị đọc thành 12 tháng 9 — sai ba tháng, và sai một cách im lặng vì cả hai ngày đều
 *     có thật.
 *
 * Nên bản không phải tiếng Việt viết tháng bằng chữ: "17 Sep 2026" chỉ có một cách hiểu.
 *
 * Phải khớp từng ký tự với BookingConfirmationMail.DEPARTURE_FORMAT_* ở backend: cùng một
 * chuyến, khách đọc giờ khởi hành trên trang thanh toán rồi lại đọc trong thư xác nhận, hai
 * chỗ viết khác nhau là một lần phải dừng lại tự hỏi có nhầm chuyến không.
 */

const VI = "vi";

/**
 * Tháng viết bằng chữ lấy từ en-US chứ không phải en-GB, dù phần còn lại xếp theo kiểu Anh
 * (ngày trước tháng). Lý do rất hẹp: en-GB trả về "Sept" bốn chữ cái, còn thư xác nhận do
 * Java dựng thì ra "Sep" ba chữ cái. Lấy riêng phần tháng rồi tự ghép chuỗi là cách duy nhất
 * để hai bên ra đúng một dạng.
 */
const INTL_MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/** Bốn mã app hỗ trợ. Mã lạ quy về tiếng Việt, giống hệt utils/money.js và SupportedLocales.java. */
const SUPPORTED = ["vi", "en", "ja", "zh"];
const normalize = (code) => (SUPPORTED.includes(code) ? code : VI);

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * @param {string|null|undefined} isoString giờ khởi hành backend trả về
 * @param {string} langCode mã ngôn ngữ đang hiển thị (currentLanguage.code)
 * @returns {string} "09:00 - 17/09/2026" (vi) hoặc "09:00 - 17 Sep 2026" (mọi ngôn ngữ khác)
 */
export const formatTripDateTime = (isoString, langCode = VI) => {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    // Chuỗi backend gửi sai định dạng thì thà hiện gần đúng còn hơn hiện "Invalid Date":
    // bỏ chữ T đi là đọc tạm được, và lỗi vẫn nhìn thấy để còn đi sửa.
    if (Number.isNaN(d.getTime())) return String(isoString).replace("T", " ");

    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const day = pad2(d.getDate());
    const year = d.getFullYear();

    // Chỉ tiếng Việt dùng tháng bằng số. ja/zh chưa dịch nên đi cùng đường với tiếng Anh,
    // đúng như cách messages.properties làm bản dự phòng cho chúng ở phía mail.
    if (normalize(langCode) === VI) {
      return `${time} - ${day}/${pad2(d.getMonth() + 1)}/${year}`;
    }
    return `${time} - ${day} ${INTL_MONTH.format(d)} ${year}`;
  } catch {
    return String(isoString).replace("T", " ");
  }
};

/**
 * Chỉ phần ngày, không giờ — dùng cho những chỗ nói về hạn dùng chứ không nói về một mốc
 * khởi hành (hạn voucher trên dải tin chạy, chẳng hạn). Quy ước viết tháng giống hệt
 * {@link formatTripDateTime}: tiếng Việt dùng số, còn lại dùng chữ, để cùng một ngày không
 * hiện hai kiểu ở hai chỗ trên cùng một màn hình.
 *
 * @param {string|null|undefined} isoString ngày backend trả về
 * @param {string} langCode mã ngôn ngữ đang hiển thị
 * @returns {string} "17/09/2026" (vi) hoặc "17 Sep 2026" (mọi ngôn ngữ khác)
 */
export const formatDateShort = (isoString, langCode = VI) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString).slice(0, 10);

    const day = pad2(d.getDate());
    const year = d.getFullYear();
    if (normalize(langCode) === VI) {
      return `${day}/${pad2(d.getMonth() + 1)}/${year}`;
    }
    return `${day} ${INTL_MONTH.format(d)} ${year}`;
  } catch {
    return String(isoString).slice(0, 10);
  }
};

export default formatTripDateTime;
