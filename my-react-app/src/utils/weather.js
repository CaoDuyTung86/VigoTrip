// @ts-check
/**
 * Dữ liệu và câu chữ cho khối dự báo thời tiết (components/WeatherPanel.jsx).
 *
 * Tách khỏi file component vì cùng lý do với announcements.js: quy tắc react-refresh chỉ cho
 * file component xuất ra component, và phần ánh xạ mã thời tiết ở đây kiểm thử được mà không
 * cần dựng cả React.
 */

import axios from "axios";

export const WEATHER_ENDPOINT = "/api/weather";

/**
 * Mã thời tiết WMO -> biểu tượng và khoá dịch.
 *
 * Backend cố tình trả MÃ chứ không trả chuỗi mô tả: Open-Meteo mô tả bằng tiếng Anh, đưa thẳng
 * xuống là bản tiếng Việt lại hiện "light rain shower". Ánh xạ ở đây thì mỗi ngôn ngữ tự có câu
 * chữ của mình.
 *
 * Vẫn khai đủ nhóm tuyết dù Việt Nam gần như không có: Sa Pa có mưa tuyết, và thiếu một nhóm thì
 * chỗ đó rơi vào nhánh không biết là gì rồi cả khối bị ẩn.
 */
const WMO_GROUPS = [
  { codes: [0], icon: "☀️", key: "wxClear" },
  { codes: [1], icon: "🌤️", key: "wxMainlyClear" },
  { codes: [2], icon: "⛅", key: "wxPartlyCloudy" },
  { codes: [3], icon: "☁️", key: "wxOvercast" },
  { codes: [45, 48], icon: "🌫️", key: "wxFog" },
  { codes: [51, 53, 55, 56, 57], icon: "🌦️", key: "wxDrizzle" },
  { codes: [61], icon: "🌧️", key: "wxRainLight" },
  { codes: [63], icon: "🌧️", key: "wxRain" },
  { codes: [65, 66, 67], icon: "🌧️", key: "wxRainHeavy" },
  { codes: [71, 73, 75, 77, 85, 86], icon: "🌨️", key: "wxSnow" },
  { codes: [80, 81], icon: "🌦️", key: "wxShowers" },
  { codes: [82], icon: "⛈️", key: "wxShowersHeavy" },
  { codes: [95], icon: "⛈️", key: "wxThunder" },
  { codes: [96, 99], icon: "⛈️", key: "wxThunderHail" },
];

/**
 * Ngày theo lịch của khách, dạng YYYY-MM-DD.
 *
 * Cắt thẳng từ chuỗi khi có thể thay vì đi qua Date: giờ khởi hành backend gửi xuống là giờ địa
 * phương không kèm múi giờ ("2026-09-14T08:00:00"), mà new Date() với chuỗi đó rồi lấy ngày theo
 * UTC sẽ lệch một ngày với khách ở múi giờ âm. Ngày sai thì dự báo trả về là của hôm khác.
 */
export function toIsoDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/**
 * Đọc dự báo cho một nơi vào một ngày.
 *
 * Trả null khi không có gì để hiện. Backend trả 204 cho cả ba trường hợp "ngoài tầm bảy ngày",
 * "mã điểm chưa có toạ độ" và "nguồn dữ liệu không trả lời" — phía này không cần phân biệt, vì
 * cách xử lý giống hệt nhau: ẩn khối đi.
 *
 * Hỏng thì im lặng chứ không ném. Khối thời tiết nằm cạnh nút thanh toán; đẩy một toast lỗi lên
 * đó chỉ làm khách tưởng đơn hàng của mình có vấn đề.
 */
export async function fetchForecast(place, date) {
  if (!place || !date) return null;
  try {
    const res = await axios.get(WEATHER_ENDPOINT, { params: { place, date }, timeout: 8000 });
    return res.status === 200 && res.data && typeof res.data === "object" ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * Biểu tượng và câu mô tả cho một mã WMO.
 *
 * Mã lạ trả về null để phía gọi ẩn cả khối: thà không hiện gì còn hơn hiện một ô trống cạnh hai
 * con số nhiệt độ mà không ai biết trời đang thế nào.
 */
export function describeWeather(code, t) {
  const group = WMO_GROUPS.find((g) => g.codes.includes(code));
  if (!group) return null;
  return { icon: group.icon, label: t?.[group.key] || "" };
}

/** Nhiệt độ hiển thị: làm tròn tới độ, vì phần lẻ của một dự báo không mang thêm thông tin gì. */
export function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°C` : "";
}
