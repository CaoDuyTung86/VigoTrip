// @ts-check
import { FaRegCalendarAlt, FaUser } from "react-icons/fa";
import { FiChevronDown, FiLock } from "react-icons/fi";
import { CgSandClock } from "react-icons/cg";
import { IoMdSearch } from "react-icons/io";

import DatePicker from "./DatePicker";

/** Ba loại hành khách, kèm khoá dịch tên gọi và khoá dịch mô tả độ tuổi. */
const PASSENGER_TYPES = [
  { key: "adult", nameKey: "adult", hintKey: "ageAdultHint" },
  { key: "child", nameKey: "child", hintKey: "ageChildHint" },
  { key: "infant", nameKey: "infant", hintKey: "ageInfantHint" },
];

/** Tổng số khách tối đa một đơn — giữ nguyên con số cũ của cả ba trang. */
const MAX_PASSENGERS = 5;

/**
 * Form tìm chuyến: điểm đi, điểm đến, ngày, số khách, và lịch giá 30 ngày.
 *
 * Ba bản chép cũ giống nhau tới mức bản của trang xe khách vẫn dùng nguyên màu nút xanh
 * `#4f7cff` của trang máy bay, còn bản của trang tàu hoả đổi nửa vời thành `"blue"` —
 * tức là không ai từng chọn màu cho hai trang ấy, họ chỉ chép rồi sửa chỗ nào đập vào mắt.
 *
 * Hai lỗi được vá nhân dịp gộp:
 *
 * 1. Lưới 5 cột chỉ có class responsive ở bản của trang máy bay. Trên màn 375px, hai trang
 *    kia giữ nguyên 5 cột nên mỗi ô rộng chừng 60px — form tìm vé xe khách và tàu hoả
 *    gần như không điền được trên điện thoại. Xem mục 8 trong index.css.
 * 2. Viền ô nhập ở hai trang ấy ghi thẳng `#e0e7ff`. Ở chế độ tối, viền sáng ấy nổi bật
 *    hơn cả chữ bên trong. Nay dùng `var(--border-main)` như trang máy bay.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {React.ComponentType} props.PlaceIcon biểu tượng đứng trước nhãn điểm đi/đến
 * @param {object} props.labels chữ đã dịch sẵn, khác nhau theo phương tiện
 * @param {string} props.labels.selectPlace gợi ý khi chưa chọn điểm ("Chọn bến xe"…)
 * @param {string} props.labels.searchButton nhãn nút tìm ("Tìm chuyến xe"…)
 * @param {string} props.labels.noCalendarResults lời nhắn khi lịch giá rỗng
 */
export default function TripSearchPanel({ booking, theme, PlaceIcon, labels }) {
  const {
    t, money, stations, from, setFrom, to, setTo, date, setDate,
    showFromDropdown, setShowFromDropdown, showToDropdown, setShowToDropdown,
    passengerCounts, passengerCountLocked, changePassengerCount,
    showPassengersDropdown, setShowPassengersDropdown, todayISO,
    handleSearch, handleSearchWithDate, formErrors, setFormErrors, loading,
    calendarOpen, setCalendarOpen, calendarLoading, calendarData, loadCalendar,
  } = booking;

  const totalPassengers = passengerCounts.adult + passengerCounts.child + passengerCounts.infant;

  /** Ô chọn điểm đi hoặc điểm đến — hai ô chỉ khác nhau ở hướng, nên dùng chung. */
  const renderPlacePicker = ({ label, value, other, error, open, setOpen, closeOther, onPick, clearKey }) => (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>
        <PlaceIcon /> {label}
      </label>
      <div
        onClick={() => { setOpen(!open); closeOther(false); }}
        style={{
          padding: "10px 14px", borderRadius: 10,
          border: error ? "2px solid #e53935" : "2px solid var(--border-main)",
          background: "var(--bg-input)", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {stations.find(a => a.code === value)?.name || labels.selectPlace}
        </div>
      </div>
      {error && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{error}</div>}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
          boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)",
        }}>
          {stations.filter(a => a.code !== other).map(a => (
            <div
              key={a.code}
              onClick={() => { onPick(a.code); setOpen(false); setFormErrors(p => ({ ...p, [clearKey]: undefined })); }}
              style={{
                padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                background: value === a.code ? "var(--bg-hover)" : "transparent",
                color: "var(--text-main)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = value === a.code ? "var(--bg-hover)" : "transparent"; }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {a.code} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>– {a.name}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.fullName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "12px", padding: "24px",
      boxShadow: "var(--shadow-md)", marginBottom: "24px",
    }}>
      <div className="booking-search-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr auto", gap: 12, alignItems: "start" }}>

        {renderPlacePicker({
          label: t.departurePoint || t.from,
          value: from, other: to, error: formErrors.from,
          open: showFromDropdown, setOpen: setShowFromDropdown, closeOther: setShowToDropdown,
          onPick: setFrom, clearKey: "from",
        })}

        <button
          type="button"
          onClick={() => { const swap = from; setFrom(to); setTo(swap); }}
          style={{
            marginTop: 28, width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--border-main)",
            background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "var(--primary)", flexShrink: 0, transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
          title={t.swapDestinations}
        >⇄</button>

        {renderPlacePicker({
          label: t.destinationPoint || t.to,
          value: to, other: from, error: formErrors.to,
          open: showToDropdown, setOpen: setShowToDropdown, closeOther: setShowFromDropdown,
          onPick: setTo, clearKey: "to",
        })}

        <div>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>
            <FaRegCalendarAlt /> {t.departureDate}
          </label>
          <div style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
            border: formErrors.date ? "2px solid #e53935" : "2px solid var(--border-main)", background: "var(--bg-input)",
          }}>
            <DatePicker
              value={date}
              min={todayISO}
              onChange={(next) => { setDate(next); setFormErrors(p => ({ ...p, date: undefined })); }}
              ariaLabel={t.departureDate}
            />
          </div>
          {formErrors.date && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.date}</div>}
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>
            <FaUser /> {t.passengers}
          </label>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <div
              onClick={() => { if (!passengerCountLocked) setShowPassengersDropdown(!showPassengersDropdown); }}
              title={passengerCountLocked ? t.passengerCountLockedHint : undefined}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border-main)",
                background: "var(--bg-input)", color: "var(--text-main)", fontSize: 15,
                cursor: passengerCountLocked ? "not-allowed" : "pointer", opacity: passengerCountLocked ? 0.6 : 1,
                display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box",
              }}
            >
              <span>
                {passengerCounts.adult} {t.adult}, {passengerCounts.child} {t.child}, {passengerCounts.infant} {t.infant}
              </span>
              <FiChevronDown />
            </div>

            {showPassengersDropdown && !passengerCountLocked && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 16, marginTop: 4, border: "1px solid var(--border-main)",
              }}>
                {PASSENGER_TYPES.map(type => (
                  <div key={type.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{t[type.nameKey]}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t[type.hintKey]}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        type="button"
                        disabled={passengerCounts[type.key] <= (type.key === "adult" ? 1 : 0)}
                        onClick={() => changePassengerCount(type.key, -1)}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)",
                          background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >-</button>
                      <span style={{ fontWeight: 600, width: 16, textAlign: "center", color: "var(--text-main)" }}>
                        {passengerCounts[type.key]}
                      </span>
                      <button
                        type="button"
                        disabled={totalPassengers >= MAX_PASSENGERS}
                        onClick={() => changePassengerCount(type.key, 1)}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)",
                          background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {passengerCountLocked && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                <FiLock style={{ display: "inline", verticalAlign: "middle", fontSize: 11 }} /> {t.passengerCountLockedHint}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            style={{
              width: "100%", padding: "11px", borderRadius: 10, border: "none",
              background: loading ? "#aaa" : `linear-gradient(135deg, ${theme.accent}, ${theme.accentStrong})`,
              color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {loading
              ? <><CgSandClock /> {t.searching}</>
              : <><IoMdSearch style={{ fontSize: 17 }} /> {labels.searchButton}</>}
          </button>

          <button
            type="button"
            onClick={loadCalendar}
            disabled={calendarLoading}
            style={{
              width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--border-main)",
              background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 600,
              cursor: calendarLoading ? "not-allowed" : "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {calendarLoading
              ? <><CgSandClock /> {t.loadingCalendar}</>
              : <><FaRegCalendarAlt /> {t.viewCheapCalendar}</>}
          </button>
        </div>
      </div>

      {calendarOpen && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{t.calendar30Days}</div>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }}
            >{"×"}</button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {calendarData.filter(d => d.available).map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => handleSearchWithDate(d.date)}
                style={{
                  width: 150, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-main)",
                  background: "var(--bg-card)", cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{d.date}</div>
                <div style={{ marginTop: 6, color: "#f97316", fontWeight: 700 }}>
                  {d.minPrice != null ? `${money(Number(d.minPrice))}` : "—"}
                </div>
              </button>
            ))}
          </div>

          {!calendarLoading && calendarData.filter(d => d.available).length === 0 && (
            <p style={{ marginTop: 12, color: "var(--text-secondary)", fontSize: 13 }}>
              {labels.noCalendarResults}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
