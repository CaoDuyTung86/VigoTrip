// @ts-check
import { describe, it, expect } from "vitest";
import { BOOKING_THEMES, themeFor, softenAccent } from "./bookingTheme";

/**
 * Bộ màu này thay cho hàng trăm mã màu ghi thẳng trong ba trang đặt vé. Thứ đáng đo ở đây
 * không phải "màu có đẹp không" mà là hai điều khiến giao diện vỡ nếu sai: mỗi luồng phải
 * nhận đúng bộ của nó (nhầm bộ thì trang tàu hiện màu xe khách), và `softenAccent` phải
 * sinh ra mã màu hợp lệ — mã sai thì trình duyệt lặng lẽ bỏ qua, nền biến mất mà không
 * có lỗi nào.
 */
describe("themeFor", () => {
  it("mỗi luồng nhận đúng bộ màu của nó", () => {
    expect(themeFor("bus")).toBe(BOOKING_THEMES.bus);
    expect(themeFor("train")).toBe(BOOKING_THEMES.train);
    expect(themeFor("air")).toBe(BOOKING_THEMES.air);
  });

  it("ba bộ màu khác nhau, để ba trang không trông giống hệt nhau", () => {
    const accents = Object.values(BOOKING_THEMES).map(x => x.accent);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("mode lạ trả về bộ mặc định chứ không undefined", () => {
    // Nếu trả về undefined thì `theme.accent` ném TypeError ngay giữa lúc dựng
    // giao diện và cả trang trắng — sai màu thì chỉ xấu.
    expect(themeFor("hovercraft")).toBe(BOOKING_THEMES.bus);
    expect(themeFor(undefined)).toBe(BOOKING_THEMES.bus);
  });

  it("bộ nào cũng đủ bốn trường mà giao diện đọc tới", () => {
    for (const theme of Object.values(BOOKING_THEMES)) {
      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accentStrong).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.emoji).toBeTruthy();
      expect(theme.fallbackCode).toBeTruthy();
    }
  });
});

describe("softenAccent", () => {
  it("ghép thêm đúng hai ký tự độ đục vào màu gốc", () => {
    expect(softenAccent("#ef4444", 100)).toBe("#ef4444ff");
    expect(softenAccent("#ef4444", 0)).toBe("#ef444400");
  });

  it("độ đục nào cũng ra mã 8 ký tự hợp lệ", () => {
    // Thiếu số 0 đứng trước (ví dụ "#ef4444f" thay vì "#ef44440f") là mã sai:
    // trình duyệt bỏ qua cả khai báo, nền mất hẳn mà không báo gì.
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(softenAccent("#ef4444", percent)).toMatch(/^#[0-9a-f]{8}$/);
    }
  });

  it("độ đục ngoài khoảng 0–100 bị kẹp lại thay vì sinh mã rác", () => {
    expect(softenAccent("#ef4444", 250)).toBe("#ef4444ff");
    expect(softenAccent("#ef4444", -40)).toBe("#ef444400");
  });

  it("mặc định là một lớp nhạt, không phải màu đặc", () => {
    const soft = softenAccent("#ef4444");
    expect(soft).not.toBe("#ef4444ff");
    expect(soft.startsWith("#ef4444")).toBe(true);
  });
});
