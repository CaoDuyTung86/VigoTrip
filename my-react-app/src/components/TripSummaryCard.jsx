// @ts-check
import WeatherPanel from "./WeatherPanel";
import { FaRegCalendarAlt } from "react-icons/fa";

import { formatTripDateTime } from "../utils/datetime";

/**
 * Thẻ tóm tắt chuyến nằm bên phải các bước đặt vé.
 *
 * Khối này từng có SÁU bản chép: bước chọn chỗ và bước nhập hành khách của cả ba trang,
 * mỗi bản một chút lệch. Hai lệch trong số đó là lỗi thật:
 *
 * 1. Trang máy bay tự định dạng ngày bằng `toLocaleString("vi-VN", …)` thay vì
 *    `formatTripDateTime(…, currentLanguage?.code)`. Đổi giao diện sang tiếng Anh hay
 *    tiếng Nhật thì mọi thứ đổi theo, riêng giờ khởi hành vẫn là "18:30 05/09/2026" —
 *    và không có cảnh báo nào, vì chuỗi vẫn hiện ra bình thường.
 * 2. Trang xe khách và tàu hoả ghi thẳng chữ "TỔNG TIỀN VÉ" vào JSX trong khi khoá
 *    `ticketTotalLabel` đã có sẵn ở cả bốn ngôn ngữ — xem `phần thân` mà trang truyền vào.
 *
 * Phần khác nhau còn lại là màu nhấn và biểu tượng, nên chúng thành tham số.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {React.ComponentType<{style?: object}>} props.ModeIcon biểu tượng phương tiện
 * @param {boolean} [props.showWeather] có kèm dự báo thời tiết nơi đến không
 * @param {React.ReactNode} props.children phần thân riêng của từng bước
 */
export default function TripSummaryCard({ booking, theme, ModeIcon, showWeather = false, children }) {
  const { t, selectedTrip, currentLanguage } = booking;
  if (!selectedTrip) return null;

  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)",
      border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16,
    }}>
      <div style={{
        fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)",
        paddingBottom: 10, color: "var(--text-main)",
      }}>
        {t.bookingSummary}
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span>{theme.emoji}</span> <span>{selectedTrip.origin}</span>
          <span style={{ color: theme.accent }}>→</span> <span>{selectedTrip.destination}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
          <FaRegCalendarAlt style={{ color: theme.accent, fontSize: 14, flexShrink: 0 }} />
          <span>{formatTripDateTime(selectedTrip.departureTime, currentLanguage?.code)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
          <ModeIcon style={{ color: theme.accent, fontSize: 16, flexShrink: 0 }} />
          <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
        </div>

        {children}

        {/* Thời tiết nơi sắp tới, ngay dưới phần tóm tắt đơn. Tự ẩn khi chuyến đi
            quá bảy ngày nữa mới khởi hành — dự báo xa hơn thì không đáng tin. */}
        {showWeather && (
          <WeatherPanel place={selectedTrip.destination} date={selectedTrip.departureTime} />
        )}
      </div>
    </div>
  );
}
