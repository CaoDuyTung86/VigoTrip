// @ts-check
import { describe, it, expect } from "vitest";
import { seatPrice, seatsSubtotal, groupSeatsByClass } from "./seatPricing";

/**
 * Đây là quy tắc về TIỀN, nên bản đối chiếu nằm ở backend chứ không ở đâu khác:
 * `BookingService.createBooking` (backend/ticket-booking/.../service/BookingService.java),
 * khối rẽ nhánh theo `trip.getVehicle().getVehicleType()`. Sửa một bên thì sửa cả bên kia,
 * và lệch ở đây KHÔNG ném lỗi — giao diện chỉ lặng lẽ hứa một con số khác số sẽ thu.
 *
 * Bộ test này tồn tại vì quy tắc ấy từng nằm rải ở ba trang đặt vé dưới ba hình dạng
 * khác nhau, không chỗ nào được đo.
 */
describe("seatPrice", () => {
  const BASE = 500000;

  describe("xe khách và tàu — phụ thu là phép CỘNG", () => {
    it("ghế thường giữ nguyên giá gốc", () => {
      expect(seatPrice("BUS", BASE, "ECONOMY")).toBe(500000);
      expect(seatPrice("TRAIN", BASE, "ECONOMY")).toBe(500000);
    });

    it("VIP nhân đôi", () => {
      expect(seatPrice("BUS", BASE, "VIP")).toBe(1000000);
    });

    it("BUSINESS cộng 100.000", () => {
      expect(seatPrice("BUS", BASE, "BUSINESS")).toBe(600000);
    });

    it("SLEEPER cộng 50.000", () => {
      expect(seatPrice("TRAIN", BASE, "SLEEPER")).toBe(550000);
    });

    it("hạng lạ rơi về giá gốc thay vì NaN", () => {
      expect(seatPrice("BUS", BASE, "KHONG_CO_HANG_NAY")).toBe(500000);
      expect(seatPrice("BUS", BASE, undefined)).toBe(500000);
    });
  });

  describe("máy bay — chỉ một mức, và là phép NHÂN", () => {
    it("BUSINESS nhân 2.5, KHÔNG phải cộng 100.000", () => {
      // Nếu nhánh máy bay dùng nhầm bảng của xe/tàu thì con số này ra 600.000.
      expect(seatPrice("PLANE", BASE, "BUSINESS")).toBe(1250000);
    });

    it("ghế phổ thông giữ nguyên giá gốc", () => {
      expect(seatPrice("PLANE", BASE, "ECONOMY")).toBe(500000);
    });

    it("VIP và SLEEPER KHÔNG được phụ thu trên máy bay", () => {
      // Backend không có nhánh nào cho hai hạng này khi là chuyến bay, nên web
      // cũng không được tự cộng thêm.
      expect(seatPrice("PLANE", BASE, "VIP")).toBe(500000);
      expect(seatPrice("PLANE", BASE, "SLEEPER")).toBe(500000);
    });

    it("nhận cả ba cách viết loại phương tiện mà backend chấp nhận", () => {
      for (const kind of ["PLANE", "FLIGHT", "AIRLINE", "plane", "Flight"]) {
        expect(seatPrice(kind, BASE, "BUSINESS")).toBe(1250000);
      }
    });
  });

  it("nhận cả chuỗi hạng lẫn cả đối tượng chỗ", () => {
    expect(seatPrice("BUS", BASE, "VIP")).toBe(seatPrice("BUS", BASE, { seatType: "VIP" }));
  });

  it("giá gốc rỗng hoặc hỏng cho ra 0 chứ không NaN", () => {
    expect(seatPrice("BUS", null, "VIP")).toBe(0);
    expect(seatPrice("BUS", undefined, "VIP")).toBe(0);
    expect(seatPrice("BUS", "khong-phai-so", "VIP")).toBe(0);
  });

  it("nhận giá gốc dạng chuỗi vì backend trả BigDecimal dạng chuỗi", () => {
    expect(seatPrice("BUS", "500000", "BUSINESS")).toBe(600000);
  });
});

describe("seatsSubtotal", () => {
  it("cộng từng chỗ theo hạng THẬT của nó, không nhân số lượng với một mức đại diện", () => {
    // Một đơn hai chỗ khác hạng: 500.000 + (500.000 + 100.000) = 1.100.000.
    // Cách sai hay gặp là lấy hạng của chỗ đầu rồi nhân hai -> 1.000.000.
    const seats = [{ seatType: "ECONOMY" }, { seatType: "BUSINESS" }];
    expect(seatsSubtotal("BUS", 500000, seats)).toBe(1100000);
  });

  it("đơn máy bay trộn hạng cũng cộng từng vé", () => {
    const seats = [{ seatType: "ECONOMY" }, { seatType: "BUSINESS" }, { seatType: "ECONOMY" }];
    expect(seatsSubtotal("PLANE", 1000000, seats)).toBe(1000000 + 2500000 + 1000000);
  });

  it("không có chỗ nào thì bằng 0", () => {
    expect(seatsSubtotal("BUS", 500000, [])).toBe(0);
    expect(seatsSubtotal("BUS", 500000, null)).toBe(0);
    expect(seatsSubtotal("BUS", 500000, undefined)).toBe(0);
  });
});

describe("groupSeatsByClass", () => {
  /** Đúng hàm mà bước xác nhận dùng để tính tiền từng dòng. */
  const busPrice = (base, seat) => seatPrice("BUS", base, seat);

  it("gộp các chỗ cùng hạng thành một dòng, cộng dồn tiền", () => {
    const seats = [{ seatType: "ECONOMY" }, { seatType: "ECONOMY" }, { seatType: "BUSINESS" }];
    expect(groupSeatsByClass(seats, 500000, busPrice)).toEqual([
      { type: "ECONOMY", count: 2, total: 1000000 },
      { type: "BUSINESS", count: 1, total: 600000 },
    ]);
  });

  it("giữ thứ tự hạng xuất hiện lần đầu, để bảng giá không nhảy chỗ giữa hai lần vẽ", () => {
    const seats = [{ seatType: "BUSINESS" }, { seatType: "ECONOMY" }, { seatType: "BUSINESS" }];
    expect(groupSeatsByClass(seats, 500000, busPrice).map(g => g.type)).toEqual(["BUSINESS", "ECONOMY"]);
  });

  it("chỗ không khai hạng được tính là hạng thường", () => {
    // Backend có thể trả về chỗ thiếu seatType; gom vào ECONOMY thì tổng vẫn khớp
    // với seatsSubtotal, còn để undefined thì bảng giá hiện một dòng trống.
    const seats = [{ seatNumber: "A1" }, { seatType: "ECONOMY" }];
    expect(groupSeatsByClass(seats, 500000, busPrice)).toEqual([
      { type: "ECONOMY", count: 2, total: 1000000 },
    ]);
  });

  it("tổng các nhóm luôn bằng seatsSubtotal của cùng danh sách", () => {
    const seats = [{ seatType: "ECONOMY" }, { seatType: "SLEEPER" }, { seatType: "VIP" }];
    const grouped = groupSeatsByClass(seats, 500000, busPrice)
      .reduce((sum, g) => sum + g.total, 0);
    expect(grouped).toBe(seatsSubtotal("BUS", 500000, seats));
  });

  it("danh sách rỗng hoặc thiếu trả về mảng rỗng", () => {
    expect(groupSeatsByClass([], 500000, busPrice)).toEqual([]);
    expect(groupSeatsByClass(null, 500000, busPrice)).toEqual([]);
  });
});
