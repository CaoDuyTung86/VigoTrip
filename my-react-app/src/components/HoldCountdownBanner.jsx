import React from "react";

const LIGHT = {
  urgent: { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" },
  normal: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
};

const DARK = {
  urgent: { background: "#3f1d1d", border: "1px solid #7f1d1d", color: "#fca5a5" },
  normal: { background: "#143823", border: "1px solid #15803d", color: "#86efac" },
};

/** Dưới ngưỡng này thì đổi sang màu cảnh báo. */
const URGENT_SECONDS = 120;

/**
 * Dải đếm ngược thời gian giữ chỗ. Không render gì khi không có đồng hồ nào chạy.
 *
 * @param {number|null} seconds số giây còn lại (null = ẩn)
 * @param {string} label nhãn mô tả đang giữ gì
 * @param {boolean} dark dùng bảng màu tối (trang vé máy bay)
 * @param {React.ReactNode} icon biểu tượng đứng trước nhãn
 */
export default function HoldCountdownBanner({ seconds, label, dark = false, icon = "⏱️" }) {
  if (seconds === null || seconds === undefined) return null;

  const palette = dark ? DARK : LIGHT;
  const tone = seconds < URGENT_SECONDS ? palette.urgent : palette.normal;
  const minutes = Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0");
  const rest = (Math.max(0, seconds) % 60).toString().padStart(2, "0");

  return (
    <div style={{
      marginBottom: 16,
      padding: "10px 16px",
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontWeight: 700,
      fontSize: 14,
      ...tone,
    }}>
      {icon}
      <span>{label}</span>
      <span style={{ fontSize: 16, fontFamily: "monospace" }}>{minutes}:{rest}</span>
    </div>
  );
}
