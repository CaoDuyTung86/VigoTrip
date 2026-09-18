// @ts-check
/**
 * Con trỏ kỳ báo cáo cho màn Thống kê doanh thu.
 *
 * Tách khỏi AdminRevenue.jsx vì đây là phần dễ sai nhất của màn hình mà lại thuần tuý tính
 * toán: cộng trừ tháng qua mốc cuối tháng, và so sánh hai mốc neo cùng thuộc một kỳ nhưng
 * khác chuỗi ngày. Nằm riêng thì kiểm chứng được bằng test thay vì phải bấm tay qua từng kỳ.
 */

export const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Luôn neo vào ngày 1 trước khi cộng trừ tháng. Nếu giữ nguyên ngày 31 rồi lùi một tháng,
 * JavaScript sẽ tràn sang tháng kế tiếp (31/03 lùi một tháng ra 03/03), làm nhảy cóc kỳ.
 */
export const shiftAnchor = (iso, period, direction) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1);
  if (period === "MONTH") d.setMonth(d.getMonth() + direction);
  else if (period === "QUARTER") d.setMonth(d.getMonth() + 3 * direction);
  else d.setFullYear(d.getFullYear() + direction);
  return toIsoDate(d);
};

export const currentAnchor = () => {
  const now = new Date();
  now.setDate(1);
  return toIsoDate(now);
};

/**
 * Quy một ngày bất kỳ về mốc đầu kỳ chứa nó, theo đúng cách backend chia kỳ.
 *
 * Cần thiết vì mốc neo chỉ được chuẩn hoá tới ngày 1 của THÁNG, nên ở kỳ Quý và Năm hai mốc
 * trỏ vào cùng một kỳ vẫn là hai chuỗi khác nhau (01/07 và 01/08 cùng thuộc Q3). So sánh thô
 * sẽ kết luận sai ở cả hai đầu chặn: nút lùi mở ra khi đã chạm đáy dữ liệu, nút tiến mở ra
 * khi đang đứng ở kỳ hiện tại.
 */
export const startOfPeriod = (iso, period) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1);
  if (period === "QUARTER") d.setMonth(Math.floor(d.getMonth() / 3) * 3);
  else if (period === "YEAR") d.setMonth(0);
  return toIsoDate(d);
};

/**
 * Đã chạm đáy dải dữ liệu chưa — tức là còn lùi được nữa không.
 *
 * `earliestDataDate` rỗng nghĩa là phạm vi này chưa có giao dịch nào; khi đó không có đáy
 * nào để chặn, và chặn bừa sẽ khoá cứng nút lùi ở một màn hình vốn đã trống.
 */
export const isAtEarliestPeriod = (anchor, period, earliestDataDate) => {
  if (!earliestDataDate) return false;
  return startOfPeriod(anchor, period) <= startOfPeriod(earliestDataDate, period);
};

/** Đã ở kỳ hiện tại chưa — chặn trên, không cho xem kỳ tương lai. */
export const isAtLatestPeriod = (anchor, period) =>
  startOfPeriod(anchor, period) >= startOfPeriod(currentAnchor(), period);
