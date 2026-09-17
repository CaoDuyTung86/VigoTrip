import { describe, it, expect } from "vitest";
import { placesFor, BUS_STATIONS, TRAIN_STATIONS, AIRPORTS } from "./placeCatalog";

const LANGS = ["vi", "en", "ja", "zh"];
const MODES = ["bus", "train", "air"];

describe("placesFor", () => {
  it("mỗi phương tiện trả về đúng 10 điểm ở cả bốn ngôn ngữ", () => {
    for (const mode of MODES) {
      for (const lang of LANGS) {
        expect(placesFor(mode, lang)).toHaveLength(10);
      }
    }
  });

  it("không điểm nào rơi về chính mã của nó — nghĩa là không thiếu bản dịch", () => {
    // `placesFor` cố ý hiện mã khi thiếu bản dịch, để giao diện không có ô trống.
    // Nhưng đó là lưới an toàn, không phải trạng thái chấp nhận được: nếu một mã lọt
    // ra tới đây thì bảng dịch đang thủng đúng một chỗ.
    for (const mode of MODES) {
      for (const lang of LANGS) {
        for (const place of placesFor(mode, lang)) {
          expect(place.name, `${mode}/${lang}/${place.code}: thiếu name`).not.toBe(place.code);
          expect(
            place.fullName,
            `${mode}/${lang}/${place.code}: thiếu fullName`
          ).not.toBe(place.code);
        }
      }
    }
  });

  it("ngôn ngữ lạ hoặc thiếu đều rơi về tiếng Việt", () => {
    expect(placesFor("bus", "de")).toEqual(placesFor("bus", "vi"));
    expect(placesFor("bus", undefined)).toEqual(placesFor("bus", "vi"));
  });

  it("phương tiện lạ trả mảng rỗng chứ không ném lỗi", () => {
    expect(placesFor("tau-vu-tru", "vi")).toEqual([]);
    expect(placesFor(undefined, "vi")).toEqual([]);
  });

  it("bốn bảng ngôn ngữ của mỗi phương tiện phủ đúng cùng một tập mã", () => {
    // Thiếu một mã ở riêng bản tiếng Nhật là lỗi chỉ lộ ra khi có người đổi ngôn ngữ.
    for (const dict of [BUS_STATIONS, TRAIN_STATIONS, AIRPORTS]) {
      const viCodes = Object.keys(dict.vi).sort();
      for (const lang of LANGS) {
        expect(Object.keys(dict[lang]).sort()).toEqual(viCodes);
      }
    }
  });

  /**
   * Chốt chặn cho đúng lỗi mà README ghi ở mục Map & Realtime Tracking: một thành phố
   * mang hai mã tuỳ phương tiện. Nếu có ai gộp ba bảng lại làm một cho gọn, test này đỏ.
   */
  it("sân bay dùng mã RIÊNG ở những nơi khác với tàu/xe", () => {
    const airCodes = placesFor("air", "vi").map((p) => p.code);
    const trainCodes = placesFor("train", "vi").map((p) => p.code);

    expect(airCodes).toContain("HUI");
    expect(trainCodes).toContain("HUE");
    expect(airCodes).not.toContain("HUE");

    expect(airCodes).toContain("CXR");
    expect(trainCodes).toContain("NTR");

    expect(airCodes).toContain("VII");
    expect(trainCodes).toContain("VIN");
  });

  it("cùng một mã ở hai phương tiện thì tên thành phố giống nhau, tên đầy đủ khác nhau", () => {
    // HAN là Hà Nội ở cả ba, nhưng bến xe, nhà ga và sân bay là ba địa điểm khác nhau.
    const bus = placesFor("bus", "vi").find((p) => p.code === "HAN");
    const train = placesFor("train", "vi").find((p) => p.code === "HAN");
    const air = placesFor("air", "vi").find((p) => p.code === "HAN");

    expect(bus.name).toBe(train.name);
    expect(train.name).toBe(air.name);

    expect(new Set([bus.fullName, train.fullName, air.fullName]).size).toBe(3);
  });

  it("giữ nguyên thứ tự khai báo của từng phương tiện", () => {
    // Thứ tự này là thứ tự hiện trong ô chọn điểm đi/đến, nên nó là thứ người dùng thấy.
    expect(placesFor("bus", "vi").map((p) => p.code).slice(0, 3)).toEqual(["HAN", "SGN", "DAD"]);
    expect(placesFor("air", "vi").map((p) => p.code).slice(0, 4)).toEqual([
      "HAN",
      "SGN",
      "DAD",
      "VCL",
    ]);
  });
});
