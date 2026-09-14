/**
 * Thẻ điều khiển trong câu trả lời của trợ lý: [BTN: ...], [LINK: nhãn | /đường-dẫn],
 * [VOUCHER: MÃ] và [ACTION: mã-đề-xuất].
 *
 * Tách khỏi Chatbot.jsx để kiểm thử được mà không phải dựng cả widget chat. Mọi thứ trong đây
 * đều coi chữ của model là dữ liệu không đáng tin: đường dẫn chỉ được trỏ vào trong site, và
 * [ACTION] chỉ mang một mã — nội dung của nút xác nhận do ChatActionCard hỏi lại server.
 */

const BUTTON_RE = /\[BTN:\s*(.+?)\]/g;
const LINK_RE = /\[LINK:\s*([^|\]]+)\|\s*([^\]]+)\]/g;
const VOUCHER_RE = /\[VOUCHER:\s*(.+?)\]/g;
// Mã đề xuất do server sinh là 22 ký tự base64url; khoảng rộng hơn một chút để đổi độ dài sau
// này không làm vỡ nút, nhưng đủ hẹp để một chuỗi rác không thành lời gọi API.
const ACTION_RE = /\[ACTION:\s*([A-Za-z0-9_-]{16,64})\]/g;

/**
 * Chỗ trống tạm đánh dấu nơi một thẻ vừa bị rút ra, để còn dọn dấu câu treo quanh nó. Ký tự vùng
 * dùng riêng của Unicode: không bao giờ có trong câu trả lời thật, và không phải ký tự điều khiển.
 */
const HOLE = '';

/** Chỉ đường dẫn nội bộ. `//evil.com` cũng bắt đầu bằng "/" nhưng là địa chỉ ngoài site. */
const safeInternalUrl = (rawUrl) => {
  const url = rawUrl.trim();
  if (!url.startsWith('/') || url.startsWith('//') || url.toLowerCase().includes('javascript:')) {
    console.warn('Blocked unsafe URL from AI:', rawUrl);
    return '/';
  }
  return url;
};

/**
 * Model hay đặt thẻ giữa câu: "xem ưu đãi mới tại đây: [LINK: ...]." Rút thẻ ra thành nút thì
 * trong chữ còn trơ lại "tại đây: ." — nên dấu hai chấm và khoảng trắng đứng ngay trước chỗ
 * trống cũng đi theo thẻ.
 */
const closeHoles = (text) =>
  text
    .replace(/[ \t]*[:：][ \t]*(?=[ \t]*(?:[.。!！?？]|$))/gm, HOLE)
    .replace(/[ \t]+(?=[.。!！?？,，])/g, HOLE)
    // Thẻ đứng đầu dòng thì khoảng trắng ngay sau nó cũng là thừa.
    .replace(/^(?:[ \t]*)+[ \t]*/gm, '')
    .replaceAll(HOLE, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function parseChatMarkup(text) {
  const buttons = [];
  const links = [];
  const vouchers = [];
  const actions = [];

  const body = String(text ?? '')
    .replace(BUTTON_RE, (_, label) => {
      buttons.push(label.trim());
      return HOLE;
    })
    .replace(LINK_RE, (_, label, url) => {
      links.push({ text: label.trim(), url: safeInternalUrl(url) });
      return HOLE;
    })
    .replace(VOUCHER_RE, (_, code) => {
      vouchers.push(code.trim());
      return HOLE;
    })
    .replace(ACTION_RE, (_, token) => {
      if (!actions.includes(token)) actions.push(token);
      return HOLE;
    });

  return { body: closeHoles(body), buttons, links, vouchers, actions };
}

/**
 * Nhãn nút liên kết theo ngôn ngữ đang chọn.
 *
 * Model chép nguyên văn nhãn tiếng Việt từ system prompt ("Xem ưu đãi") vào câu trả lời tiếng
 * Anh. Với những trang đã biết thì nhãn lấy từ bảng dịch; tiếng Việt giữ nhãn của model vì nó
 * thường cụ thể hơn ("Xem chuyến bay HAN - DAD ngày 16/08").
 */
export function localizeLinkLabel(link, t, langCode) {
  if (langCode === 'vi') return link.text;
  const labels = {
    '/uu-dai': t.cbLinkOffers,
    '/ve-may-bay': t.cbLinkFlights,
    '/ve-tau-hoa': t.cbLinkTrains,
    '/xe-khach': t.cbLinkBuses,
    '/my-bookings': t.cbLinkMyBookings,
  };
  return labels[link.url.split(/[?#]/)[0]] || link.text;
}

/** Ba nút chọn phương tiện mà system prompt dạy model viết bằng tiếng Việt. */
export function localizeButtonLabel(label, t, langCode) {
  if (langCode === 'vi') return label;
  const labels = {
    'vé máy bay': t.cbBtnFlight,
    'vé tàu hỏa': t.cbBtnTrain,
    'vé tàu hoả': t.cbBtnTrain,
    'vé xe khách': t.cbBtnBus,
  };
  return labels[label.trim().toLowerCase()] || label;
}
