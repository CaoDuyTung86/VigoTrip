// ─── Tiện ích trộn màu ngày/đêm cho các cảnh canvas (seat maps) ──────────────
// Convention: t = 0 là ĐÊM (dark mode), t = 1 là NGÀY (light mode).
// Mỗi frame, component tự ease dần t về target (isDark ? 0 : 1) để chuyển
// cảnh sáng ↔ tối mượt mà thay vì đổi nhảy.

const rgbCache = {};

const hexToRgb = (hex) => {
  if (rgbCache[hex]) return rgbCache[hex];
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const rgb = [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  rgbCache[hex] = rgb;
  return rgb;
};

// Trộn 2 màu hex → chuỗi "rgb(r,g,b)" theo t (0 = nightHex, 1 = dayHex)
export const mixColor = (nightHex, dayHex, t) => {
  const a = hexToRgb(nightHex);
  const b = hexToRgb(dayHex);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
};

// Gắn alpha cho chuỗi rgb() → "rgba(r,g,b,a)"
export const withAlpha = (rgbStr, a) =>
  rgbStr.replace('rgb(', 'rgba(').replace(')', `, ${a.toFixed(3)})`);

// Hệ số ease mỗi frame để chuyển cảnh ~1.5–2 giây
export const THEME_EASE = 0.045;
