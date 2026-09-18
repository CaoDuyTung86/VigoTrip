// @ts-check
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  shiftAnchor,
  startOfPeriod,
  isAtEarliestPeriod,
  isAtLatestPeriod,
} from "./reportPeriod";

afterEach(() => {
  vi.useRealTimers();
});

/** Ghim đồng hồ để "kỳ hiện tại" không đổi nghĩa theo ngày chạy test. */
const atDate = (iso) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T09:00:00`));
};

describe("shiftAnchor", () => {
  it("lùi tháng từ ngày cuối tháng không nhảy cóc sang tháng khác", () => {
    // 31/03 lùi một tháng: đặt ngày về 1 trước, nếu không JS tràn thành 03/03.
    expect(shiftAnchor("2026-03-31", "MONTH", -1)).toBe("2026-02-01");
  });

  it("lùi qua mốc giao năm", () => {
    expect(shiftAnchor("2026-01-01", "MONTH", -1)).toBe("2025-12-01");
  });

  it("kỳ Quý dịch 3 tháng, kỳ Năm dịch 12 tháng", () => {
    expect(shiftAnchor("2026-08-01", "QUARTER", -1)).toBe("2026-05-01");
    expect(shiftAnchor("2026-08-01", "YEAR", -1)).toBe("2025-08-01");
  });
});

describe("startOfPeriod", () => {
  it("gom mọi tháng trong cùng một quý về đúng một mốc", () => {
    const q3 = ["2026-07-06", "2026-08-01", "2026-09-30"];
    expect(q3.map((d) => startOfPeriod(d, "QUARTER"))).toEqual([
      "2026-07-01", "2026-07-01", "2026-07-01",
    ]);
  });

  it("kỳ Năm gom về 1/1, kỳ Tháng gom về ngày 1", () => {
    expect(startOfPeriod("2026-08-28", "YEAR")).toBe("2026-01-01");
    expect(startOfPeriod("2026-08-28", "MONTH")).toBe("2026-08-01");
  });
});

describe("isAtEarliestPeriod — chặn dưới của nút lùi", () => {
  it("chưa chạm đáy thì còn lùi được", () => {
    expect(isAtEarliestPeriod("2026-08-01", "MONTH", "2026-07-06")).toBe(false);
  });

  it("đứng đúng kỳ chứa giao dịch xa nhất là hết đường lùi", () => {
    expect(isAtEarliestPeriod("2026-07-01", "MONTH", "2026-07-06")).toBe(true);
  });

  it("đã trôi xuống dưới đáy vẫn tính là chạm đáy", () => {
    expect(isAtEarliestPeriod("2026-03-01", "MONTH", "2026-07-06")).toBe(true);
  });

  it("mốc neo giữa quý vẫn nhận ra mình đang ở chính quý chứa đáy", () => {
    // 01/08 và 06/07 cùng thuộc Q3 — so sánh chuỗi thô sẽ kết luận sai là còn lùi được.
    expect(isAtEarliestPeriod("2026-08-01", "QUARTER", "2026-07-06")).toBe(true);
  });

  it("chưa có giao dịch nào thì không khoá nút lùi", () => {
    expect(isAtEarliestPeriod("2026-08-01", "MONTH", null)).toBe(false);
    expect(isAtEarliestPeriod("2026-08-01", "MONTH", undefined)).toBe(false);
  });
});

describe("isAtLatestPeriod — chặn trên của nút tiến", () => {
  it("kỳ hiện tại là hết đường tiến", () => {
    atDate("2026-08-28");
    expect(isAtLatestPeriod("2026-08-01", "MONTH")).toBe(true);
  });

  it("kỳ quá khứ thì còn tiến được", () => {
    atDate("2026-08-28");
    expect(isAtLatestPeriod("2026-07-01", "MONTH")).toBe(false);
  });

  it("mốc neo đầu quý vẫn tính là đang ở quý hiện tại", () => {
    // Sau khi đồng bộ theo backend, mốc neo bị kéo về 01/07 trong khi hôm nay là tháng 8.
    // So sánh thô sẽ mở nút tiến ra và cho đi thẳng sang Q4 chưa xảy ra.
    atDate("2026-08-28");
    expect(isAtLatestPeriod("2026-07-01", "QUARTER")).toBe(true);
  });
});
