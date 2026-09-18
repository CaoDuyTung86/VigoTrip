/**
 * Phụ thu theo hạng chỗ — PHẢI khớp `BookingService.createBooking` ở backend.
 *
 * Trước đây quy tắc này nằm rải ở ba trang đặt vé: `AirlineTickets.jsx` tự cộng tiền theo
 * cách riêng ngay trong `orderSubtotal`, còn `BusTickets.jsx` và `TrainTickets.jsx` mỗi bên
 * giữ một bản `getSeatPrice` giống hệt nhau. Ba bản sao của một quy tắc về TIỀN là ba chỗ
 * có thể lệch khỏi backend một cách độc lập, và lệch ở đây không báo lỗi: giao diện hứa
 * một con số, `BookingService` thu một con số khác, khách chỉ phát hiện lúc nhìn hoá đơn.
 *
 * Nhánh rẽ theo phương tiện không phải chuyện làm cho đẹp — backend rẽ đúng chỗ này
 * (xem `BookingService`: `FLIGHT`/`AIRLINE`/`PLANE` đi một nhánh, còn lại đi nhánh kia),
 * nên bản sao ở web phải rẽ y như vậy thì hai bên mới ra cùng một số.
 */

/** Phương tiện bay — backend nhận cả ba cách viết này. */
const AIR_KINDS = ["FLIGHT", "AIRLINE", "PLANE"];

/**
 * Giá của MỘT chỗ, đã cộng phụ thu theo hạng.
 *
 * @param {string} vehicleKind loại phương tiện của chuyến ("BUS" | "TRAIN" | "PLANE"…)
 * @param {number|string|null|undefined} basePrice giá gốc của chuyến
 * @param {string|{seatType?: string}|null|undefined} seat hạng chỗ, hoặc cả đối tượng chỗ
 * @returns {number} số tiền của chỗ đó
 */
export const seatPrice = (vehicleKind, basePrice, seat) => {
  const type = typeof seat === "string" ? seat : seat?.seatType;
  const base = Number(basePrice || 0);
  if (!Number.isFinite(base)) return 0;

  if (AIR_KINDS.includes(String(vehicleKind || "").toUpperCase())) {
    // Máy bay chỉ có một mức phụ thu, và nó là phép NHÂN chứ không phải phép cộng.
    return "BUSINESS" === type ? base * 2.5 : base;
  }

  if ("VIP" === type) return base * 2;
  if ("BUSINESS" === type) return base + 100000;
  if ("SLEEPER" === type) return base + 50000;
  return base;
};

/**
 * Tổng tiền của những chỗ đang chọn.
 *
 * Cộng từng chỗ theo hạng THẬT của nó thay vì nhân số lượng với một mức giá đại diện:
 * một đơn có thể gồm nhiều hạng khác nhau, và backend cũng cộng từng vé một.
 *
 * @param {string} vehicleKind loại phương tiện của chuyến
 * @param {number|string|null|undefined} basePrice giá gốc của chuyến
 * @param {Array<{seatType?: string}>} seats danh sách chỗ đang chọn
 * @returns {number} tổng tiền chỗ, chưa gồm dịch vụ đi kèm
 */
export const seatsSubtotal = (vehicleKind, basePrice, seats) =>
  (seats || []).reduce((sum, s) => sum + seatPrice(vehicleKind, basePrice, s), 0);

/**
 * Gộp các chỗ đang chọn theo hạng, giữ nguyên thứ tự xuất hiện.
 *
 * Dùng cho phần chi tiết thanh toán: một đơn có thể gồm nhiều hạng, và người mua cần thấy
 * tiền của từng hạng chứ không phải một dòng "N ghế" gộp lại.
 *
 * @param {Array<{seatType?: string}>} seats các chỗ đang chọn
 * @param {number} basePrice giá gốc của chuyến
 * @param {(base: number, seat: object) => number} getSeatPrice giá một chỗ theo hạng
 * @returns {Array<{type: string, count: number, total: number}>}
 */
export const groupSeatsByClass = (seats, basePrice, getSeatPrice) => {
  const groups = [];
  for (const seat of seats || []) {
    const type = seat.seatType || "ECONOMY";
    const price = getSeatPrice(basePrice, seat);
    const found = groups.find(g => g.type === type);
    if (found) {
      found.count += 1;
      found.total += price;
    } else {
      groups.push({ type, count: 1, total: price });
    }
  }
  return groups;
};

export default seatPrice;
