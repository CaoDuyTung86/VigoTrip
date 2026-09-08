import { describe, it, expect } from "vitest";
import { formatMoney, formatAmount } from "./money";

/**
 * Cùng một con số phải hiện giống nhau trên web và trong thư xác nhận. Bản đối chiếu phía
 * backend nằm ở MailLocalizationTest.formatsMoneyPerRecipientLocale và
 * EmailTemplateTest.moneyFollowsRecipientLanguage — sửa một bên thì sửa cả bên kia.
 */
describe("formatMoney", () => {
  it("tiếng Việt: nhóm bằng dấu chấm, ký hiệu đ", () => {
    expect(formatMoney(677450, "vi")).toBe("677.450 đ");
    expect(formatMoney(1500000, "vi")).toBe("1.500.000 đ");
  });

  it("tiếng Anh: nhóm bằng dấu phẩy, ký hiệu VND", () => {
    // "677.450 đ" trong bản English là con số đọc ra thành sáu trăm bảy mươi bảy đồng:
    // dấu chấm ở đúng vị trí mà người đọc tiếng Anh hiểu là dấu thập phân.
    expect(formatMoney(677450, "en")).toBe("677,450 VND");
  });

  it("ja/zh cũng nhóm bằng dấu phẩy", () => {
    expect(formatMoney(677450, "ja")).toBe("677,450 VND");
    expect(formatMoney(677450, "zh")).toBe("677,450 VND");
  });

  it("mã ngôn ngữ lạ hoặc thiếu đều quy về tiếng Việt", () => {
    expect(formatMoney(1000, "de")).toBe("1.000 đ");
    expect(formatMoney(1000)).toBe("1.000 đ");
    expect(formatMoney(1000, undefined)).toBe("1.000 đ");
  });

  it("giá trị rỗng hoặc hỏng hiện 0 chứ không hiện NaN", () => {
    expect(formatMoney(null, "vi")).toBe("0 đ");
    expect(formatMoney(undefined, "vi")).toBe("0 đ");
    expect(formatMoney("khong-phai-so", "vi")).toBe("0 đ");
  });

  it("nhận cả chuỗi số vì backend trả BigDecimal dạng chuỗi ở vài endpoint", () => {
    expect(formatMoney("250000", "vi")).toBe("250.000 đ");
  });

  it("formatAmount chỉ trả phần chữ số, không kèm ký hiệu tiền", () => {
    expect(formatAmount(250000, "vi")).toBe("250.000");
    expect(formatAmount(250000, "en")).toBe("250,000");
  });
});
