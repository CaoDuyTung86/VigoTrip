// @ts-check
import React from "react";
import { useTheme } from "../context/ThemeContext";

const LIGHT = {
  urgent: { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" },
  normal: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
};

const DARK = {
  urgent: { background: "rgba(127, 29, 29, 0.35)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5" },
  normal: { background: "rgba(20, 83, 45, 0.35)", border: "1px solid rgba(34, 197, 94, 0.4)", color: "#86efac" },
};

/** Dưới ngưỡng này thì đổi sang màu cảnh báo. */
const URGENT_SECONDS = 120;

/**
 * Dải đếm ngược thời gian giữ chỗ. Không render gì khi không có đồng hồ nào chạy.
 *
 * @param {object} props
 * @param {number|null} props.seconds số giây còn lại (null = ẩn)
 * @param {string} props.label nhãn mô tả đang giữ gì
 * @param {boolean} [props.dark] tùy chọn ghi đè theme tối
 * @param {React.ReactNode} [props.icon] biểu tượng đứng trước nhãn, mặc định "⏱️"
 */
export default function HoldCountdownBanner({ seconds, label, dark, icon = "⏱️" }) {
  const { isDark } = useTheme() || {};
  if (seconds === null || seconds === undefined) return null;

  const effectiveDark = dark !== undefined ? dark : Boolean(isDark);
  const palette = effectiveDark ? DARK : LIGHT;
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
