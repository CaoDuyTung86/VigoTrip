// @ts-check
/**
 * Định dạng mã QR của một đơn vé — nơi duy nhất định nghĩa nó ở phía web.
 *
 * Trước đây mỗi nơi tự nghĩ ra một dạng: MyBookings.jsx nhúng cả khối JSON
 * ({bookingId, type, user, code}), còn mail xác nhận nhúng số bookingId trần. Cùng một
 * vé mà khách thấy hai ảnh QR khác hẳn nhau, và không ai phát hiện ra vì máy soát vé
 * chấp nhận cả hai. Gom về một chỗ để lần sau đổi định dạng thì chỉ có một chỗ để đổi
 * (và một chỗ để nhớ sửa kèm QrCodeService.bookingPayload() bên backend).
 */

/** Tiền tố payload. Phải khớp TICKET_PREFIX trong QrCodeService.java. */
const TICKET_PREFIX = "TICKET-";

/**
 * Nội dung nhúng vào mã QR của một đơn.
 *
 * Dạng "TICKET-<id>" chứ không phải số trần: app camera mặc định của điện thoại
 * (iOS Camera, Google Lens, Zalo) coi một chuỗi toàn số là nội dung không mở được nên
 * thường không hiện gì cả — khách quét thử mã trong mail sẽ tưởng mã hỏng.
 */
export const ticketQrPayload = (bookingId) => `${TICKET_PREFIX}${bookingId}`;

/**
 * Rút bookingId ra từ nội dung máy soát vé đọc được.
 *
 * Cố tình rộng hơn ticketQrPayload(): vé đã phát hành trước đây vẫn đang nằm trong hòm
 * thư và ảnh chụp màn hình của khách, ở cả ba dạng cũ (JSON, số trần, TICKET-<id>-<ngày>).
 * Thu hẹp hàm này lại đồng nghĩa với việc vô hiệu hoá những vé đó.
 *
 * Trả về chuỗi id, hoặc null nếu không nhận ra.
 */
export const parseBookingId = (raw) => {
  if (raw === null || raw === undefined) return null;

  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    } else {
      value = trimmed;
    }
  }

  if (Array.isArray(value)) value = value[0];
  if (value && typeof value === "object") {
    value = value.bookingId ?? value.id ?? value.code ?? "";
  }

  const text = String(value ?? "").replace(/[#\s]/g, "");
  if (!text) return null;
  if (/^\d+$/.test(text)) return text;

  const ticketForm = text.match(/^TICKET-(\d+)(?:-.*)?$/i);
  if (ticketForm) return ticketForm[1];

  return null;
};
