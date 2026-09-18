// @ts-check
/**
 * Màu và biểu tượng nhận diện của từng luồng đặt vé.
 *
 * Ba trang `BusTickets`, `TrainTickets`, `AirlineTickets` vốn là ba bản chép của cùng một
 * giao diện, và chỗ chúng khác nhau thật gần như chỉ có bấy nhiêu: một màu nhấn, một biểu
 * tượng, một mã nhà cung cấp mặc định. Khi giao diện còn nằm rải trong ba file, "bấy nhiêu"
 * ấy lẫn vào hơn ba nghìn dòng JSX giống hệt nhau, nên không ai nhìn ra nó nhỏ đến thế.
 *
 * Gom lại đây để phần JSX còn lại nhận màu qua tham số thay vì chép thêm một bản nữa.
 * Xem `components/TripResultsList.jsx` và các bước đặt vé dùng chung.
 */

/** @typedef {{accent: string, accentStrong: string, emoji: string, fallbackCode: string}} BookingTheme */

/** @type {Record<string, BookingTheme>} */
export const BOOKING_THEMES = {
  bus: { accent: "#ef4444", accentStrong: "#dc2626", emoji: "🚌", fallbackCode: "FUTA" },
  train: { accent: "#1d4ed8", accentStrong: "#2563eb", emoji: "🚆", fallbackCode: "VNR" },
  air: { accent: "#4f7cff", accentStrong: "#6a3de8", emoji: "✈", fallbackCode: "VN" },
};

/**
 * Bộ màu của một luồng. Mode lạ thì trả về bộ của xe khách thay vì `undefined`, để một
 * chuỗi mode gõ sai chỉ làm sai màu chứ không ném lỗi giữa lúc dựng giao diện.
 *
 * @param {string} mode "bus" | "train" | "air"
 * @returns {BookingTheme}
 */
export const themeFor = (mode) => BOOKING_THEMES[mode] || BOOKING_THEMES.bus;

/**
 * Pha loãng màu nhấn thành nền.
 *
 * Bản cũ ghi thẳng nền sáng (`#fef2f2`, `#dbeafe`) nên ở chế độ tối vẫn là một mảng sáng
 * chói trên nền đen. Màu nhấn có độ trong suốt thì chồng lên nền nào cũng ra sắc của nền
 * đó, nên dùng được cho cả hai chế độ.
 *
 * @param {string} hex màu nhấn dạng "#rrggbb"
 * @param {number} percent độ đục, 0–100
 * @returns {string} màu dạng "#rrggbbaa"
 */
export const softenAccent = (hex, percent = 12) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const alpha = Math.round((clamped / 100) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
};

export default themeFor;
