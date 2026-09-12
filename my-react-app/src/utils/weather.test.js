import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { toIsoDate, describeWeather, formatTemperature, fetchForecast } from "./weather";

vi.mock("axios");

/**
 * Khối thời tiết nằm ngay cạnh nút thanh toán, nên hai thứ phải chắc: ngày gửi lên đúng ngày
 * khách nhìn thấy, và mọi đường hỏng đều dẫn về "ẩn khối đi" chứ không phải một thông báo lỗi
 * làm khách tưởng đơn hàng của mình có vấn đề.
 */
describe("toIsoDate", () => {
  it("cắt thẳng từ chuỗi giờ địa phương backend gửi xuống", () => {
    // Đi qua new Date() rồi lấy ngày theo UTC sẽ lệch một ngày với khách ở múi giờ âm, mà lệch
    // ngày thì dự báo trả về là của hôm khác.
    expect(toIsoDate("2026-09-14T08:00:00")).toBe("2026-09-14");
    expect(toIsoDate("2026-01-01T23:30:00")).toBe("2026-01-01");
  });

  it("chuỗi ngày trần giữ nguyên", () => {
    expect(toIsoDate("2026-09-14")).toBe("2026-09-14");
  });

  it("đối tượng Date lấy theo lịch địa phương", () => {
    expect(toIsoDate(new Date(2026, 8, 14, 8, 0))).toBe("2026-09-14");
  });

  it("giá trị rỗng hoặc hỏng thì trả chuỗi rỗng", () => {
    expect(toIsoDate(null)).toBe("");
    expect(toIsoDate("")).toBe("");
    expect(toIsoDate("không phải ngày")).toBe("");
  });
});

describe("describeWeather", () => {
  const t = { wxClear: "Trời quang", wxRainHeavy: "Mưa to", wxThunderHail: "Dông kèm mưa đá" };

  it("ánh xạ mã WMO sang biểu tượng và chữ của ngôn ngữ đang chọn", () => {
    expect(describeWeather(0, t)).toEqual({ icon: "☀️", label: "Trời quang" });
    expect(describeWeather(65, t).label).toBe("Mưa to");
    expect(describeWeather(99, t).label).toBe("Dông kèm mưa đá");
  });

  it("mã lạ thì trả null để phía gọi ẩn cả khối", () => {
    // Thà không hiện gì còn hơn hiện một ô trống cạnh hai con số nhiệt độ.
    expect(describeWeather(123, t)).toBeNull();
    expect(describeWeather(undefined, t)).toBeNull();
  });

  it("thiếu bản dịch thì vẫn có biểu tượng chứ không ra chữ undefined", () => {
    expect(describeWeather(0, {})).toEqual({ icon: "☀️", label: "" });
  });
});

describe("formatTemperature", () => {
  it("làm tròn tới độ", () => {
    expect(formatTemperature(25.1)).toBe("25°C");
    expect(formatTemperature(31.6)).toBe("32°C");
  });

  it("giá trị không phải số thì trả chuỗi rỗng", () => {
    expect(formatTemperature(null)).toBe("");
    expect(formatTemperature(Number.NaN)).toBe("");
  });
});

describe("fetchForecast", () => {
  beforeEach(() => {
    axios.get = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("trả về dự báo khi máy chủ có dữ liệu", async () => {
    axios.get.mockResolvedValue({ status: 200, data: { placeCode: "DAD", weatherCode: 80 } });

    await expect(fetchForecast("DAD", "2026-09-14"))
      .resolves.toEqual({ placeCode: "DAD", weatherCode: 80 });
  });

  it("204 nghĩa là không có gì để hiện", async () => {
    // Ngoài tầm bảy ngày, mã điểm chưa có toạ độ, hay nguồn dữ liệu im lặng — cả ba đều là 204,
    // và phía này không cần phân biệt vì cách xử lý giống hệt nhau.
    axios.get.mockResolvedValue({ status: 204, data: "" });

    await expect(fetchForecast("DAD", "2026-09-14")).resolves.toBeNull();
  });

  it("mạng hỏng thì trả null chứ không ném", async () => {
    axios.get.mockRejectedValue(new Error("Network Error"));

    await expect(fetchForecast("DAD", "2026-09-14")).resolves.toBeNull();
  });

  it("thiếu nơi đến hoặc ngày thì không gọi máy chủ", async () => {
    await expect(fetchForecast("", "2026-09-14")).resolves.toBeNull();
    await expect(fetchForecast("DAD", "")).resolves.toBeNull();

    expect(axios.get).not.toHaveBeenCalled();
  });
});
