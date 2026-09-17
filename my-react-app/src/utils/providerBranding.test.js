import { describe, it, expect } from "vitest";
import { providersFor } from "./providerBranding";

const MODES = ["bus", "train", "air"];

describe("providersFor", () => {
  it("mỗi luồng có bảng nhãn hiệu riêng, không rỗng", () => {
    for (const mode of MODES) {
      expect(Object.keys(providersFor(mode)).length).toBeGreaterThan(0);
    }
  });

  it("luồng lạ trả bảng rỗng chứ không ném lỗi", () => {
    // JSX tra bảng này bằng `PROVIDER_LOGOS[trip.providerName]` rồi mới dùng, nên trả
    // một đối tượng rỗng là đủ an toàn; trả undefined mới là thứ làm vỡ trang.
    expect(providersFor("tau-vu-tru")).toEqual({});
    expect(providersFor(undefined)).toEqual({});
  });

  it("mọi nhãn hiệu đều khai đủ mã, màu chữ và màu nền", () => {
    // Thiếu một trường thì ô logo rơi về kiểu mặc định trong im lặng — không lỗi,
    // không cảnh báo, chỉ là một thẻ chuyến trông nhạt hơn những thẻ khác.
    for (const mode of MODES) {
      for (const [name, brand] of Object.entries(providersFor(mode))) {
        expect(brand.code, `${mode}/${name}: thiếu code`).toBeTruthy();
        expect(brand.color, `${mode}/${name}: thiếu color`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(brand.bg, `${mode}/${name}: thiếu bg`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("chỉ hãng bay mới có ảnh logo, và ảnh phải là PNG", () => {
    // Ô logo rộng 52px và nền của ô là màu `bg`, nên ảnh bắt buộc có kênh trong suốt.
    // Một file .jpg lọt vào đây sẽ vẽ nền trắng đè lên ô bo tròn — xem ghi chú đầy đủ
    // ở chỗ khai AIR_PROVIDERS.
    for (const brand of Object.values(providersFor("air"))) {
      expect(brand.logo).toMatch(/^\/logos\/.+\.png$/);
    }
    for (const mode of ["bus", "train"]) {
      for (const brand of Object.values(providersFor(mode))) {
        expect(brand.logo).toBeUndefined();
      }
    }
  });

  it("mã viết tắt không trùng nhau trong cùng một luồng", () => {
    for (const mode of MODES) {
      const codes = Object.values(providersFor(mode)).map((b) => b.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});
