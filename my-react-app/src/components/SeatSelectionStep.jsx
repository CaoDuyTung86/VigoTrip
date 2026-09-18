import TripSummaryCard from "./TripSummaryCard";
import { canSelectSeats } from "../utils/seatBookingHelpers";

/**
 * Bước 1 của luồng đặt vé: chọn chỗ trên sơ đồ.
 *
 * Sơ đồ chỗ là thứ DUY NHẤT thật sự khác nhau giữa ba phương tiện (`BusSeatMap`,
 * `TrainSeatMap`, `AirplaneSeatMap` đã là ba component riêng từ trước), nên nó được
 * truyền vào qua `seatMap`. Phần bọc quanh nó — tiêu đề, cảnh báo chưa đăng nhập, hai nút
 * điều hướng, cột tóm tắt giá theo hạng — thì ba bản chép chỉ khác nhau ở màu, cỡ chữ và
 * bán kính bo góc, tức là khác nhau vì chép chứ không vì nghiệp vụ.
 *
 * Hai điều được chốt lại ở đây:
 *
 * 1. Lưới `1fr 320px` kèm `booking-split-grid`. Bản của xe khách và tàu hoả dùng cột
 *    340px và KHÔNG có class ấy, nên trên màn 375px cột tóm tắt chiếm gần trọn bề ngang
 *    và ép sơ đồ chỗ còn chừng 15px — không bấm chọn ghế được. Xem mục 8 trong index.css.
 * 2. Bảng giá theo hạng đọc hạng THẬT có trong sơ đồ (`premiumSeatTypes` lọc theo
 *    `seats`). Bản của trang máy bay vẽ cứng một dòng "Thương gia" kể cả khi chuyến đó
 *    không có ghế thương gia nào — một mức giá cho thứ không bán.
 *
 * @param {object} props
 * @param {object} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {React.ComponentType<{style?: object}>} props.ModeIcon biểu tượng phương tiện
 * @param {React.ReactNode} props.seatMap sơ đồ chỗ của phương tiện này
 * @param {string[]} props.premiumSeatTypes các hạng cao có thể xuất hiện trong sơ đồ
 * @param {(type: string, t: object) => string} props.premiumSeatLabel nhãn hiển thị của một hạng
 * @param {(base: number, seat: string|object) => number} props.getSeatPrice giá một chỗ theo hạng
 * @param {object} props.labels chữ đã dịch sẵn, khác nhau theo phương tiện
 */
export default function SeatSelectionStep({
  booking,
  theme,
  ModeIcon,
  seatMap,
  premiumSeatTypes,
  premiumSeatLabel,
  getSeatPrice,
  labels,
}) {
  const {
    t, money, loading, seats, selectedSeatIds, selectedTrip, passengers,
    isAuthenticated, user, setStep, performSearch, from, to, date, trips, goToExtras,
  } = booking;

  if (!selectedTrip) return null;

  return (
    <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      <div style={{
        background: "var(--bg-card)", borderRadius: 12, padding: 24,
        boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step1}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>{labels.instruction}</p>

        {!canSelectSeats(isAuthenticated, user) && (
          <p style={{
            color: "#f59e0b", fontSize: 13, marginBottom: 12, padding: "10px 12px",
            background: "rgba(245,158,11,0.1)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)",
          }}>
            {t.loginRequiredSeat}
          </p>
        )}

        {loading && <p style={{ color: "var(--text-muted)" }}>{t.loadingSeatMap}</p>}
        {!loading && seats.length > 0 && seatMap}
        {!loading && seats.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t.noSeatData}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => {
              // Khôi phục bản nháp xong thì danh sách chuyến rỗng: lần tìm kiếm đó
              // thuộc về trang trước khi tải lại. Quay về mà không tìm lại thì người
              // dùng nhìn thấy một màn hình trống trơn không giải thích được.
              if (trips.length === 0) performSearch(from, to, date, null);
              else setStep("chooseTrip");
            }}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)",
              background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
            }}
          >← {t.goBack}</button>

          <button
            type="button"
            onClick={goToExtras}
            style={{
              padding: "10px 28px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentStrong})`,
              color: "#fff", fontWeight: 700, cursor: "pointer",
            }}
          >{t.nextStep} →</button>
        </div>
      </div>

      <TripSummaryCard booking={booking} theme={theme} ModeIcon={ModeIcon} showWeather>
        <div style={{
          marginTop: 10, padding: "10px 12px", background: "var(--summary-eco-bg)",
          borderRadius: 10, border: "1px solid var(--summary-eco-border)",
        }}>
          <div style={{ fontSize: 12, color: "var(--summary-eco-title)", fontWeight: 700, marginBottom: 4 }}>
            🟢 {labels.ecoSeat} (ECO)
          </div>
          <div style={{ fontWeight: 800, color: "var(--summary-eco-price)", fontSize: 16 }}>
            {money(Number(selectedTrip.price || 0))}
          </div>
        </div>

        {premiumSeatTypes.filter(cls => seats.some(s => s.seatType === cls)).map(cls => (
          <div key={cls} style={{
            marginTop: 8, padding: "10px 12px", background: "var(--summary-vip-bg)",
            borderRadius: 10, border: "1px solid var(--summary-vip-border)",
          }}>
            <div style={{ fontSize: 12, color: "var(--summary-vip-title)", fontWeight: 700, marginBottom: 4 }}>
              🔵 {premiumSeatLabel(cls, t)} ({cls})
            </div>
            <div style={{ fontWeight: 800, color: "var(--summary-vip-price)", fontSize: 16 }}>
              {money(Number(getSeatPrice(selectedTrip.price, cls)))}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 12, fontWeight: 600,
          color: selectedSeatIds.length >= (passengers || 1) ? "#22c55e" : "var(--text-muted)",
        }}>
          {t.seatsSelectedCount
            .replace("{selected}", selectedSeatIds.length)
            .replace("{total}", passengers || 1)}
        </div>
      </TripSummaryCard>
    </div>
  );
}
