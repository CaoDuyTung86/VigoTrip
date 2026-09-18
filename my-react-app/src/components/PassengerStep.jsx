// @ts-check
import ContactInfoForm from "./ContactInfoForm";
import PassengerInfoForm from "./PassengerInfoForm";
import TripSummaryCard from "./TripSummaryCard";

/**
 * Bước 2 của luồng đặt vé: người liên hệ và thông tin từng hành khách.
 *
 * Hai form con đã là component dùng chung từ trước; khối này chỉ là phần bọc quanh chúng,
 * và ba bản chép của nó chênh nhau đúng ba chỗ — màu nút, biểu tượng, và một lỗi:
 *
 * Trang xe khách và tàu hoả ghi thẳng chuỗi tiếng Việt "TỔNG TIỀN VÉ" vào JSX, trong khi
 * khoá `ticketTotalLabel` đã có sẵn ở cả bốn ngôn ngữ. Chọn tiếng Anh thì mọi nhãn quanh
 * nó đổi theo, riêng dòng ấy vẫn là tiếng Việt. Lỗi kiểu này không làm gì vỡ nên không ai
 * phát hiện, và `npm run i18n:check` cũng không bắt được: khoá vẫn tồn tại, chỉ là không
 * ai gọi tới.
 *
 * Cách tính tiền chỗ nay đi qua `getSeatPrice` của trang (tức `utils/seatPricing.js`).
 * Bản của trang máy bay trước đây tự nhân 2.5 cho cả BUSINESS, VIP và SLEEPER ngay tại
 * chỗ này — một quy tắc TIỀN thứ tư, khác cả ba nơi còn lại, kể cả khác bước xác nhận của
 * chính nó.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {React.ComponentType<{style?: object}>} props.ModeIcon biểu tượng phương tiện
 * @param {string[]} props.premiumSeatTypes các hạng cao, để chú thích sau số ghế
 * @param {(type: string, t: object) => string} props.premiumSeatLabel nhãn hiển thị của một hạng
 * @param {(base: number, seat: string|object) => number} props.getSeatPrice giá một chỗ theo hạng
 */
export default function PassengerStep({
  booking,
  theme,
  ModeIcon,
  premiumSeatTypes,
  premiumSeatLabel,
  getSeatPrice,
}) {
  const {
    t, money, user, savedPassengers, selectedTrip, seats, selectedSeatIds, setSelectedSeatIds,
    contactInfo, setContactInfo, globalContact, setGlobalContact,
    passengerInfoList, handlePassengerChange,
    unlockSeats, setLockDeadline, setStep, goToExtrasFromPassenger,
  } = booking;

  if (!selectedTrip) return null;

  const chosenSeats = seats.filter(s => selectedSeatIds.includes(s.id));
  const basePrice = Number(selectedTrip.price || 0);
  const seatsTotal = chosenSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s), 0);

  /** "A12, B03 (Thương gia)" — chú thích hạng chỉ hiện với chỗ hạng cao. */
  const seatNumbersLabel = chosenSeats
    .map(s => `${s.seatNumber}${premiumSeatTypes.includes(s.seatType) ? ` (${premiumSeatLabel(s.seatType, t)})` : ""}`)
    .join(", ");

  return (
    <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step2}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.passengerInstruction}</p>

        <ContactInfoForm
          data={contactInfo}
          onChange={setContactInfo}
          accountEmail={user?.email}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {passengerInfoList.map((pi, idx) => (
            <PassengerInfoForm
              key={idx}
              type={pi.type}
              index={idx}
              data={pi.data}
              onChange={handlePassengerChange}
              savedPassengers={savedPassengers}
              onSelectSaved={(i, type, p) => handlePassengerChange(i, type, {
                ...p,
                fullName: p.fullName || "",
                phone: p.phone || "",
                email: p.email || "",
                idNumber: p.idNumber || "",
                dateOfBirth: p.dateOfBirth || "",
                gender: p.gender || "",
                nationality: p.nationality || "Việt Nam",
              })}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
          <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: "var(--text-main)", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={globalContact.remember}
              onChange={e => setGlobalContact(p => ({ ...p, remember: e.target.checked }))}
              style={{ accentColor: theme.accent, width: 16, height: 16 }}
            />
            {t.rememberInfo}
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => {
              unlockSeats({ tripId: selectedTrip.id, seatIds: [...selectedSeatIds] });
              setSelectedSeatIds([]);
              setLockDeadline(null);
              setStep("seatClass");
            }}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)",
              background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
            }}
          >← {t.goBack}</button>

          <button
            type="button"
            onClick={goToExtrasFromPassenger}
            style={{
              padding: "10px 28px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentStrong})`,
              color: "#fff", fontWeight: 700, cursor: "pointer",
            }}
          >{t.nextStep} →</button>
        </div>
      </div>

      <TripSummaryCard booking={booking} theme={theme} ModeIcon={ModeIcon}>
        <div style={{
          marginTop: 10, padding: "12px 14px", background: "var(--bg-input)",
          borderRadius: 10, border: "1px solid var(--border-main)",
        }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t.seatsSelectedLabel}</div>
          <div style={{ fontWeight: 800, color: theme.accent, fontSize: 15, marginBottom: 8 }}>
            {seatNumbersLabel || t.notSelected}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>{t.ticketTotalLabel}</div>
          <div style={{ fontWeight: 900, color: "#f97316", fontSize: 18, whiteSpace: "nowrap" }}>
            {seatsTotal > 0 ? money(seatsTotal) : `${money(basePrice)} ${t.perSeatUnit}`}
          </div>
        </div>
      </TripSummaryCard>
    </div>
  );
}
