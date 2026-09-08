import { describe, it, expect } from "vitest";
import { formatTripDateTime } from "./datetime";

describe("formatTripDateTime", () => {
  const departure = "2026-09-17T09:00:00";

  it("không bao giờ để lọt chuỗi ISO thô ra màn hình", () => {
    // Bước 4 "Kiểm tra & Thanh toán" từng in thẳng "2026-09-17T09:00:00" ngay trên khối
    // tóm tắt, đúng chỗ khách đọc lần cuối trước khi bấm trả tiền.
    expect(formatTripDateTime(departure, "vi")).not.toContain("T");
    expect(formatTripDateTime(departure, "en")).not.toContain("T09");
  });

  it("tiếng Việt: ngày/tháng/năm bằng số", () => {
    expect(formatTripDateTime(departure, "vi")).toBe("09:00 - 17/09/2026");
  });

  it("tiếng Anh: tháng viết bằng chữ để không đọc nhầm ngày với tháng", () => {
    // "17/09/2026" với người đọc tiếng Anh là mơ hồ, và "09/12/2026" thì mơ hồ một cách
    // nguy hiểm — cả 9 tháng 12 lẫn 12 tháng 9 đều là ngày có thật.
    expect(formatTripDateTime(departure, "en")).toBe("09:00 - 17 Sep 2026");
    expect(formatTripDateTime("2026-12-09T09:00:00", "en")).toBe("09:00 - 09 Dec 2026");
  });

  it("giữ giờ 24h ở mọi ngôn ngữ, khớp với giờ in trên vé", () => {
    expect(formatTripDateTime("2026-09-17T19:00:00", "en")).toContain("19:00");
    expect(formatTripDateTime("2026-09-17T19:00:00", "vi")).toContain("19:00");
  });

  it("thiếu giờ khởi hành thì hiện chỗ trống, không hiện Invalid Date", () => {
    expect(formatTripDateTime(null, "vi")).toBe("--:--");
    expect(formatTripDateTime("", "en")).toBe("--:--");
  });

  it("chuỗi hỏng thì hiện gần đúng để lỗi vẫn nhìn thấy được", () => {
    expect(formatTripDateTime("khong-phai-ngay", "vi")).toBe("khong-phai-ngay");
  });

  it("mã ngôn ngữ lạ quy về tiếng Việt", () => {
    expect(formatTripDateTime(departure, "de")).toBe("09:00 - 17/09/2026");
  });
});
