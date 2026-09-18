// @ts-check
import { describe, it, expect } from "vitest";
import { groupServices, translateServiceName, categoryOf, SERVICE_CATEGORY } from "./serviceCatalog";

/**
 * Ba lỗi mà bộ test này khoá lại, cả ba đều từng có mặt trên bản deploy và đều bắt nguồn
 * từ việc lấy CHỮ TIẾNG VIỆT trong serviceName làm khoá logic.
 */
describe("serviceCatalog", () => {
  const svc = (serviceCode, category, serviceName) => ({ id: 1, serviceCode, category, serviceName });

  describe("groupServices", () => {
    it("xếp nhóm theo category backend trả về, không theo tên", () => {
      const groups = groupServices([
        svc("BAGGAGE_20KG", "BAGGAGE", "Hành lý ký gửi 20kg"),
        svc("MEAL_MY_Y", "MEAL", "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều"),
        svc("INSURANCE_BASIC", "INSURANCE", "Bảo hiểm du lịch cơ bản"),
        svc("TRANSFER_TAXI", "TRANSFER", "Xe đưa đón tận nơi (Xanh SM)"),
      ]);

      expect(groups.baggage).toHaveLength(1);
      expect(groups.meal).toHaveLength(1);
      expect(groups.insurance).toHaveLength(1);
      expect(groups.transfer).toHaveLength(1);
    });

    it("xe đưa đón vẫn vào nhóm TRANSFER dù tên không còn chữ Taxi", () => {
      // Bản cũ lọc bằng serviceName.includes("Taxi"). Đổi tên dịch vụ cho hợp với trang tàu
      // là dòng đó biến mất khỏi màn hình chọn dịch vụ mà không ai biết.
      const groups = groupServices([svc("TRANSFER_TAXI", "TRANSFER", "Xe đưa đón tận nơi (Xanh SM)")]);

      expect(groups.transfer).toHaveLength(1);
    });

    it("dòng cũ chưa kịp gắn mã vẫn được đoán nhóm theo tên", () => {
      // Đường lui cho lần deploy đầu, khi seeder chưa chạy xong backfill. Không có nhánh này
      // thì màn hình chọn dịch vụ trống trơn và khách không mua thêm được gì.
      const groups = groupServices([
        svc(null, null, "Hành lý ký gửi 15kg"),
        svc(null, null, "Suất ăn - Combo Xôi mặn, hạt điều & nước suối"),
        svc(null, null, "Bảo hiểm du lịch cao cấp"),
        svc(null, null, "Taxi đưa đón sân bay (Xanh SM)"),
      ]);

      expect(groups.baggage).toHaveLength(1);
      expect(groups.meal).toHaveLength(1);
      expect(groups.insurance).toHaveLength(1);
      expect(groups.transfer).toHaveLength(1);
    });

    it("dòng không thuộc nhóm nào thì không chào bán, và không làm hỏng các nhóm khác", () => {
      const groups = groupServices([
        svc("BAGGAGE_20KG", "BAGGAGE", "Hành lý ký gửi 20kg"),
        svc("SOMETHING_ELSE", null, "Dòng lạ do quản trị viên thêm"),
      ]);

      expect(groups.baggage).toHaveLength(1);
      expect(groups.meal).toHaveLength(0);
      expect(categoryOf(svc("SOMETHING_ELSE", null, "Dòng lạ do quản trị viên thêm"))).toBeNull();
    });

    it("category tường minh thắng phần đoán theo tên", () => {
      const insuranceNamedLikeMeal = svc("INSURANCE_BASIC", SERVICE_CATEGORY.INSURANCE, "Suất ăn - tên đặt nhầm");

      expect(categoryOf(insuranceNamedLikeMeal)).toBe(SERVICE_CATEGORY.INSURANCE);
    });

    it("danh sách rỗng hoặc thiếu vẫn trả về đủ bốn nhóm", () => {
      expect(groupServices()).toEqual({ baggage: [], meal: [], insurance: [], transfer: [] });
      expect(groupServices([])).toEqual({ baggage: [], meal: [], insurance: [], transfer: [] });
    });
  });

  describe("translateServiceName", () => {
    const t = {
      svc_BAGGAGE_20KG: "Checked baggage 20kg",
      svc_INSURANCE_BASIC: "Basic travel insurance",
    };

    it("tra bảng dịch bằng mã", () => {
      expect(translateServiceName(svc("BAGGAGE_20KG", "BAGGAGE", "Hành lý ký gửi 20kg"), t))
        .toBe("Checked baggage 20kg");
    });

    it("thiếu bản dịch thì rơi về tên trong cơ sở dữ liệu, không rơi về chuỗi rỗng", () => {
      // Một dòng dịch vụ không có nhãn là một dòng khách không biết mình đang mua gì.
      expect(translateServiceName(svc("MEAL_MY_Y", "MEAL", "Suất ăn - Combo Mỳ Ý"), t))
        .toBe("Suất ăn - Combo Mỳ Ý");
    });

    it("dòng chưa có mã thì dùng thẳng tên", () => {
      expect(translateServiceName(svc(null, null, "Hành lý ký gửi 15kg"), t)).toBe("Hành lý ký gửi 15kg");
    });

    it("không nổ khi thiếu dịch vụ hoặc thiếu bảng dịch", () => {
      expect(translateServiceName(null, t)).toBe("");
      expect(translateServiceName(svc("BAGGAGE_20KG", "BAGGAGE", "Hành lý ký gửi 20kg"), undefined))
        .toBe("Hành lý ký gửi 20kg");
    });
  });
});
