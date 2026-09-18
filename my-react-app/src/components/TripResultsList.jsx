// @ts-check
import { FiSearch } from "react-icons/fi";

import { softenAccent } from "../utils/bookingTheme";

/** Các khung giờ khởi hành lọc nhanh. Giá trị là [giờ bắt đầu, giờ kết thúc). */
const TIME_PRESETS = [
  { labelKey: "timeRangeAll", range: [0, 24] },
  { labelKey: "timeRangeEarlyMorning", range: [0, 6] },
  { labelKey: "timeRangeMorning", range: [6, 12] },
  { labelKey: "timeRangeAfternoon", range: [12, 18] },
  { labelKey: "timeRangeEvening", range: [18, 24] },
];

/** Giờ khởi hành có thể là "2026-09-18T07:30:00" hoặc "07:30:00". Nhận cả hai. */
const parseTripTime = (timeStr) => {
  if (!timeStr) return null;
  if (timeStr.includes("T")) return new Date(timeStr);
  return new Date(`2000-01-01T${timeStr}`);
};

/** Chỉ lấy "hh:mm" để hiện trên thẻ chuyến. */
const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return "--:--";
  if (timeStr.includes("T")) {
    const timePart = timeStr.split("T")[1];
    return timePart ? timePart.slice(0, 5) : "--:--";
  }
  return timeStr.slice(0, 5);
};

/**
 * Thời gian chạy giữa hai mốc, dạng "5g 30ph".
 *
 * Chuyến qua đêm có giờ đến nhỏ hơn giờ đi (22:00 → 05:00), nên hiệu số âm được cộng
 * thêm một ngày thay vì hiện ra số âm.
 */
const tripDuration = (departureTime, arrivalTime, t) => {
  const dep = parseTripTime(departureTime);
  const arr = parseTripTime(arrivalTime);
  if (!dep || !arr) return "";

  let diff = (arr.getTime() - dep.getTime()) / 60000;
  if (diff < 0) diff += 1440;
  const hours = Math.floor(diff / 60);
  const mins = Math.round(diff % 60);
  const hUnit = t.durationHours;
  const mUnit = t.durationMins;
  return `${hours}${hUnit}${mins > 0 ? ` ${mins}${mUnit}` : ""}`;
};

/**
 * Danh sách chuyến ở bước "chooseTrip": bộ lọc, bộ sắp xếp và các thẻ chuyến.
 *
 * Đây là khối JSX dài nhất của luồng đặt vé, và ba bản chép của nó giống nhau 90% (xe
 * khách ↔ tàu hoả). Phần khác nhau thật chỉ là MÀU và BIỂU TƯỢNG: đỏ cho xe khách, xanh
 * đậm cho tàu hoả, xanh tím cho máy bay. Không một khác biệt nào về cấu trúc hay cách
 * tính, nên chúng thành `theme` và `ModeIcon` ở đây.
 *
 * Ba chỗ được sửa nhân dịp gộp, đều là lỗi chép rồi quên sửa:
 *
 * 1. Bản của xe khách và tàu hoả tô chữ bằng `var(--text-primary)` — một biến KHÔNG hề
 *    được khai báo trong index.css (biến thật tên `--text-main`). Trình duyệt bỏ qua
 *    khai báo sai và để chữ thừa hưởng màu cha, nên lỗi không lộ ra ở chế độ sáng; ở chế
 *    độ tối thì tên nhà xe và giờ khởi hành mới lệch tông so với phần còn lại của thẻ.
 * 2. Thanh biểu thị chỗ trống lấy nền `#e5e7eb` — xám nhạt cố định, gần như vô hình
 *    trên nền tối. Nay dùng `var(--bg-input)` như bản của trang máy bay.
 * 3. Nền thẻ đang chọn ghi thẳng màu sáng. Nay pha từ chính màu nhấn của luồng, nên nền
 *    nào cũng ra đúng sắc của nền đó — xem `softenAccent`.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {React.ComponentType<{style?: object}>} props.ModeIcon biểu tượng phương tiện
 * @param {Record<string, {code?: string, color?: string, bg?: string, logo?: string}>} props.providerLogos
 *        nhãn hiệu nhà cung cấp — xem utils/providerBranding.js
 * @param {object} props.labels chữ đã dịch sẵn, khác nhau theo phương tiện
 * @param {string} props.labels.listTitle tiêu đề danh sách ("Danh sách chuyến xe khách"…)
 * @param {string} props.labels.providerLabel nhãn trước dãy nút lọc nhà cung cấp
 * @param {string} props.labels.clearProviderFilter nút bỏ lọc nhà cung cấp
 * @param {string} props.labels.noMatchingTrips lời nhắn khi bộ lọc loại hết chuyến
 * @param {string} props.labels.modeBadge chữ nhỏ dưới mã nhà cung cấp ("XE KHÁCH"…)
 * @param {string} props.labels.vehicleFallback loại phương tiện khi chuyến không ghi rõ
 * @param {string} props.labels.directRoute chữ dưới đường chặng ("Chạy thẳng"…)
 */
export default function TripResultsList({ booking, theme, ModeIcon, providerLogos, labels }) {
  const {
    t, money, stations, from, to, trips, filteredTrips,
    sortBy, setSortBy, filterAvailableOnly, setFilterAvailableOnly,
    allProviders, filterProviders, setFilterProviders, timeRange, setTimeRange,
    selectedTrip, handleSelectTrip,
  } = booking;

  if (trips.length === 0) return null;

  const minPrice = Math.min(...trips.map(trip => trip.price || Infinity));
  const accentSoft = softenAccent(theme.accent, 12);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Tiêu đề + chặng đang xem */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--text-main)" }}>
            <ModeIcon style={{ color: theme.accent }} /> {labels.listTitle}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {t.showingTrips
              .replace("{filtered}", filteredTrips.length)
              .replace("{total}", trips.length)}
          </p>
        </div>
        <div style={{
          background: `linear-gradient(135deg,${theme.accent},${theme.accentStrong})`,
          color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600,
        }}>
          {stations.find(a => a.code === from)?.name || from} → {stations.find(a => a.code === to)?.name || to}
        </div>
      </div>

      {/* Thanh lọc & sắp xếp */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 16, padding: "16px 20px", marginBottom: 20,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid var(--border-light)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{t.sortByLabel}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
                background: "var(--bg-input)", color: "var(--text-main)", fontSize: 13,
                fontWeight: 600, cursor: "pointer", outline: "none",
              }}
            >
              <option value="price_asc">{t.sortPriceAsc}</option>
              <option value="price_desc">{t.sortPriceDesc}</option>
              <option value="time_asc">{t.sortTimeAsc}</option>
              <option value="time_desc">{t.sortTimeDesc}</option>
              <option value="duration_asc">{t.sortDurationAsc}</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
            <input
              type="checkbox"
              checked={filterAvailableOnly}
              onChange={(e) => setFilterAvailableOnly(e.target.checked)}
              style={{ accentColor: theme.accent, width: 16, height: 16, cursor: "pointer" }}
            />
            {t.availableSeatsOnly}
          </label>
        </div>

        {/* Khung giờ khởi hành */}
        <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
            🕒 {t.departureTimeRange}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {TIME_PRESETS.map(preset => {
              const isSelected = timeRange[0] === preset.range[0] && timeRange[1] === preset.range[1];
              return (
                <button
                  key={preset.labelKey}
                  type="button"
                  onClick={() => setTimeRange(preset.range)}
                  style={{
                    padding: "8px 16px", borderRadius: 20,
                    border: isSelected ? `1.5px solid ${theme.accent}` : "1px solid var(--border-main)",
                    background: isSelected ? theme.accent : "var(--bg-card)",
                    color: isSelected ? "#ffffff" : "var(--text-main)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease",
                    boxShadow: isSelected ? `0 2px 8px ${softenAccent(theme.accent, 30)}` : "none",
                  }}
                >
                  {t[preset.labelKey]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lọc theo nhà cung cấp */}
        {allProviders.length > 0 && (
          <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{labels.providerLabel}</span>
            {allProviders.map(pName => {
              const isChecked = filterProviders.includes(pName);
              return (
                <button
                  key={pName}
                  type="button"
                  onClick={() => setFilterProviders(prev => (
                    isChecked ? prev.filter(x => x !== pName) : [...prev, pName]
                  ))}
                  style={{
                    padding: "5px 12px", borderRadius: 20,
                    border: isChecked ? `1.5px solid ${theme.accent}` : "1px solid var(--border-light)",
                    background: isChecked ? accentSoft : "var(--bg-input)",
                    color: isChecked ? theme.accent : "var(--text-main)",
                    fontSize: 12, fontWeight: isChecked ? 700 : 500, cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {isChecked ? "✓ " : ""}{pName}
                </button>
              );
            })}
            {filterProviders.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterProviders([])}
                style={{ border: "none", background: "none", color: theme.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {labels.clearProviderFilter}
              </button>
            )}
          </div>
        )}
      </div>

      {filteredTrips.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 20px", background: "var(--bg-card)",
          borderRadius: 16, border: "1px dashed var(--border-light)", color: "var(--text-secondary)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%", background: "var(--bg-input)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 20,
          }}>
            <FiSearch />
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, maxWidth: 480, lineHeight: 1.5 }}>
            {labels.noMatchingTrips}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredTrips.map((trip) => {
            const isSelected = selectedTrip?.id === trip.id;
            const isCheapest = trip.price === minPrice;
            const seatPct = trip.availableSeats / (trip.totalSeats || 1);
            const seatWarning = trip.availableSeats <= 5;
            const duration = tripDuration(trip.departureTime, trip.arrivalTime, t);

            const pInfo = providerLogos[trip.providerName];
            const pColor = pInfo?.color || theme.accent;
            const initials = (trip.providerName || theme.fallbackCode)
              .split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();

            return (
              <div
                key={trip.id}
                onClick={() => handleSelectTrip(trip)}
                style={{
                  background: isSelected ? accentSoft : "var(--bg-card)",
                  border: isSelected ? `2px solid ${theme.accent}` : "1.5px solid var(--border-light)",
                  borderRadius: 16, padding: "18px 22px", cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                  boxShadow: isSelected ? `0 6px 24px ${softenAccent(theme.accent, 18)}` : "0 2px 8px rgba(0,0,0,0.05)",
                  position: "relative", overflow: "hidden",
                }}
              >
                {isCheapest && (
                  <div style={{
                    position: "absolute", top: 0, right: 0,
                    background: "linear-gradient(135deg,#22c55e,#16a34a)",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "4px 12px 4px 16px", borderBottomLeftRadius: 12, letterSpacing: "0.5px",
                  }}>
                    🏷️ {t.cheapest}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Huy hiệu nhà cung cấp */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: pInfo?.bg || softenAccent(pColor, 10),
                    border: `1.5px solid ${pColor}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, padding: 4, overflow: "hidden", position: "relative",
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: pColor, lineHeight: 1, display: "block" }}>
                        {pInfo?.code || initials}
                      </span>
                      <span style={{ fontSize: 8, color: pColor + "bb", fontWeight: 600, marginTop: 2, display: "block" }}>
                        {labels.modeBadge}
                      </span>
                    </div>
                    {pInfo?.logo && (
                      <img
                        src={pInfo.logo}
                        alt={trip.providerName}
                        style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%",
                          objectFit: "contain", padding: 6, background: pInfo?.bg || "#fff",
                        }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>

                  {/* Tên nhà cung cấp */}
                  <div style={{ minWidth: 110, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>
                      {trip.providerName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {trip.vehicleType || labels.vehicleFallback}
                    </div>
                  </div>

                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Giờ đi — chặng — giờ đến */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                        {formatTimeDisplay(trip.departureTime)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                        {trip.origin}
                      </div>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 80 }}>
                      {duration && (
                        <div style={{
                          fontSize: 11, color: theme.accent, fontWeight: 700,
                          background: accentSoft, padding: "2px 10px", borderRadius: 20,
                        }}>
                          ⏱ {duration}
                        </div>
                      )}
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg,${theme.accent}44,${theme.accent})` }} />
                        <ModeIcon style={{ fontSize: 16, color: theme.accent }} />
                        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg,${theme.accent},${theme.accent}44)` }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{labels.directRoute}</div>
                    </div>

                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                        {formatTimeDisplay(trip.arrivalTime)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                        {trip.destination}
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Chỗ trống */}
                  <div style={{ minWidth: 90, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{t.availableSeats}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: seatWarning ? "#ef4444" : "#22c55e" }}>
                      {trip.availableSeats}/{trip.totalSeats}
                    </div>
                    <div style={{ marginTop: 5, height: 4, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${Math.round(seatPct * 100)}%`,
                        background: seatWarning
                          ? "linear-gradient(90deg,#ef4444,#f97316)"
                          : "linear-gradient(90deg,#22c55e,#4ade80)",
                        transition: "width 0.4s",
                      }} />
                    </div>
                    {seatWarning && (
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>
                        {t.almostSoldOut}
                      </div>
                    )}
                  </div>

                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Giá + nút chọn */}
                  <div style={{ textAlign: "center", minWidth: 130, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.pricePerPerson}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: theme.accent, lineHeight: 1.2, whiteSpace: "nowrap", marginBottom: 8 }}>
                      {money(trip.price)}
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleSelectTrip(trip); }}
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg,#22c55e,#16a34a)"
                          : `linear-gradient(135deg,${theme.accent},${theme.accentStrong})`,
                        color: "#fff", border: "none", padding: "8px 22px", borderRadius: 10,
                        fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%",
                        boxShadow: isSelected
                          ? "0 4px 12px rgba(34,197,94,0.35)"
                          : `0 4px 12px ${softenAccent(theme.accent, 35)}`,
                        transition: "all 0.2s",
                      }}
                    >
                      {isSelected ? (t.selected) : (t.selectTicket)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
