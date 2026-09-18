// @ts-check
/**
 * Dữ liệu và câu chữ cho dải tin chạy trên Header (components/AnnouncementTicker.jsx).
 *
 * Tách khỏi file component vì hai lý do: quy tắc react-refresh chỉ cho file component xuất
 * ra component, và phần ghép câu ở đây kiểm thử được mà không cần dựng cả React.
 */

import axios from "axios";
import { formatMoney } from "./money";
import { formatDateShort } from "./datetime";

export const ANNOUNCEMENTS_ENDPOINT = "/api/announcements";

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template ?? "");

/**
 * Đọc danh sách tin đang hiệu lực.
 *
 * Hỏng thì trả mảng rỗng chứ không ném: dải tin là thứ trang trí, backend ngủ (Render gói
 * free) hay mạng chập chờn không phải là việc đáng đẩy một toast lỗi lên màn hình.
 */
export async function fetchAnnouncements() {
  try {
    const res = await axios.get(ANNOUNCEMENTS_ENDPOINT, { timeout: 15000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

/**
 * Câu chữ cho một mẩu tin.
 *
 * Backend gửi kind + params chứ không gửi câu dựng sẵn, nên chỗ ghép câu là đây — nhờ vậy
 * dải tin đổi theo ngôn ngữ đang chọn mà không phải gọi lại API. Các mảnh nối bằng " · "
 * thay vì lồng vào một câu dài: mỗi mảnh là một khoá dịch độc lập, dịch giả không phải giữ
 * đúng trật tự từ của tiếng Việt để câu còn chạy được.
 */
export function buildAnnouncementText(item, t, langCode) {
  if (item?.kind === "VOUCHER") {
    const p = item.params || {};
    const parts = [fill(t.annVoucher, { code: p.code ?? "", percent: p.percent ?? "" })];
    if (p.maxDiscount) parts.push(fill(t.vchMaxDiscount, { amount: formatMoney(p.maxDiscount, langCode) }));
    if (p.minOrder) parts.push(fill(t.annVoucherMinOrder, { amount: formatMoney(p.minOrder, langCode) }));
    if (p.provider) parts.push(fill(t.annVoucherProvider, { provider: p.provider }));
    if (item.endsAt) parts.push(fill(t.annVoucherUntil, { date: formatDateShort(item.endsAt, langCode) }));
    return parts.filter(Boolean).join(" · ");
  }

  // Tin nhập tay (nhịp hai). Thiếu bản tiếng Anh thì hiện tiếng Việt chứ KHÔNG ẩn tin —
  // người đọc tiếng Anh thà đọc một câu tiếng Việt còn hơn không biết là có thông báo.
  if (langCode === "vi") return item?.textVi || item?.textEn || "";
  return item?.textEn || item?.textVi || "";
}
