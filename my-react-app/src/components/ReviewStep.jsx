// @ts-check
import axios from "axios";
import { FaUser, FaTicketAlt } from "react-icons/fa";
import { MdOutlineDone, MdOutlineCreditCard } from "react-icons/md";

import SavedVoucherPicker from "./SavedVoucherPicker";
import { formatTripDateTime } from "../utils/datetime";
import { translateServiceName } from "../utils/serviceCatalog";
import { groupSeatsByClass } from "../utils/seatPricing";

/**
 * Bước 4 của luồng đặt vé: xem lại đơn, nhập mã giảm giá, đặt vé và chuyển sang VNPay.
 *
 * Ba bản chép cũ khác nhau ở màu, ở biểu tượng thẻ ngân hàng, và ở hai chỗ đáng kể hơn:
 *
 * 1. Bảng giá chi tiết của trang máy bay tự cộng tiền chỗ bằng công thức riêng
 *    (`ecoCount * base + bizCount * base * 2.5`) thay vì gọi `getSeatPrice`. Hai công
 *    thức tình cờ ra cùng kết quả cho máy bay, nên bản sao ấy sống sót — cho tới lúc
 *    backend đổi mức phụ thu và chỉ một trong hai nơi được sửa. Nay chỉ còn một đường:
 *    `utils/seatPricing.js`, cũng là nơi đã chép lại quy tắc của `BookingService`.
 * 2. Phần tách giá theo hạng ("↳ 2x Thương gia") chỉ trang máy bay mới có, dù xe khách
 *    và tàu hoả cũng bán nhiều hạng trên cùng một chuyến. Nay cả ba đều có, và danh sách
 *    hạng lấy từ chỗ thật đang chọn chứ không vẽ cứng hai dòng.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {import("../utils/bookingTheme").BookingTheme} props.theme bộ màu của luồng
 * @param {(base: number, seat: string|object) => number} props.getSeatPrice giá một chỗ theo hạng
 * @param {(type: string, t: object) => string} props.seatClassLabel nhãn hiển thị của một hạng chỗ
 * @param {string} props.tripLabel nhãn loại chuyến ("Chuyến xe", "Chuyến tàu", "Chuyến bay")
 */
export default function ReviewStep({ booking, theme, getSeatPrice, seatClassLabel, tripLabel }) {
  const {
    t, money, currentLanguage, token, selectedTrip, seats, selectedSeatIds,
    contactInfo, passengerInfoList, services, selectedServiceIds,
    promoCode, setPromoCode, handleApplyVoucher, voucherBaseAmount, appliedVoucher, voucherDiscount,
    membershipDiscount, membershipDiscountPercent,
    bookingResult, submitBooking, submitLoading, setStep, showToast,
  } = booking;

  if (!selectedTrip) return null;

  const chosenSeats = seats.filter(s => selectedSeatIds.includes(s.id));
  const chosenServices = services.filter(s => selectedServiceIds.includes(s.id));
  const basePrice = Number(selectedTrip.price || 0);
  const seatsTotal = chosenSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s), 0);
  const extraTotal = chosenServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const seatGroups = groupSeatsByClass(chosenSeats, basePrice, getSeatPrice);

  /** Tạo liên kết thanh toán rồi rời trang sang cổng VNPay. */
  const goToPayment = async () => {
    try {
      const res = await axios.post(
        "/api/payment/create",
        { bookingId: bookingResult.id, language: "vn", returnOrigin: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        // Máy chủ trả lời nhưng không kèm liên kết: khác hẳn lỗi mạng bên dưới, và
        // cách xử lý cũng khác — ở đây thử lại không giúp gì.
        showToast(t.vnpayNoResponse, "error");
      }
    } catch (err) {
      console.error(err);
      showToast(t.vnpayConfigError, "error");
    }
  };

  const summaryRow = { display: "flex", justifyContent: "space-between", gap: 8 };
  const sectionBox = {
    border: "1px solid var(--border-main)", borderRadius: 12, padding: 16,
    marginBottom: 14, background: "var(--bg-input)",
  };
  const sectionTitle = {
    fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)",
    display: "flex", alignItems: "center", gap: 6,
  };

  return (
    <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      <div style={{
        background: "var(--bg-card)", borderRadius: 12, padding: 24,
        boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step4}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.reviewInstruction}</p>

        {/* Chuyến */}
        <div style={sectionBox}>
          <div style={sectionTitle}>{theme.emoji} {tripLabel}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-main)" }}>
                {selectedTrip.origin} → {selectedTrip.destination}
              </div>
              <div style={{ color: "var(--text-main)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>
                {formatTripDateTime(selectedTrip.departureTime, currentLanguage?.code)} · {selectedTrip.providerName}
              </div>
            </div>
            <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17, whiteSpace: "nowrap" }}>
              {money(seatsTotal)} đ
            </div>
          </div>
        </div>

        {/* Người liên hệ và hành khách */}
        <div style={sectionBox}>
          <div style={sectionTitle}><FaUser /> {t.contactReviewTitle}</div>
          <div style={{
            fontSize: 14, color: "var(--text-main)", lineHeight: 1.6, marginBottom: 14,
            paddingBottom: 12, borderBottom: "1px dashed var(--border-main)",
          }}>
            <b style={{ fontSize: 15, textTransform: "uppercase" }}>{contactInfo.name}</b>
            <div>{contactInfo.email} · {contactInfo.phone}</div>
          </div>

          <div style={sectionTitle}><FaUser /> {t.passengerNameText}</div>
          {passengerInfoList.map((pi, idx) => (
            <div key={idx} style={{
              fontSize: 14, marginBottom: 8, paddingBottom: 8, color: "var(--text-main)", lineHeight: 1.6,
              borderBottom: idx < passengerInfoList.length - 1 ? "1px dashed var(--border-main)" : "none",
            }}>
              <b style={{ fontSize: 15 }}>{pi.data.fullName || `${t.passengerNameText} ${idx + 1}`}</b>{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                ({pi.type === "ADULT" ? t.adult : pi.type === "CHILD" ? t.child : t.infant})
              </span>
              <div style={{ marginTop: 2, color: "var(--text-main)" }}>
                {t.dobPrefix} <b>{pi.data.dateOfBirth}</b> | {t.genderPrefix}{" "}
                <b>{pi.data.gender === "Male" ? t.genderMale : pi.data.gender === "Female" ? t.genderFemale : t.genderOther}</b>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 6, color: "var(--text-main)", fontSize: 14 }}>
            {t.seatPrefix}{" "}
            <b style={{ fontSize: 15, color: "#f97316" }}>
              {chosenSeats.map(s => s.seatNumber).join(", ") || t.notSelected}
            </b>
          </div>
        </div>

        {/* Dịch vụ đi kèm */}
        {chosenServices.length > 0 && (
          <div style={sectionBox}>
            <div style={{ ...sectionTitle, display: "block" }}>🛎 {t.extrasLabel}</div>
            {chosenServices.map(s => (
              <div key={s.id} style={{ ...summaryRow, fontSize: 14, marginBottom: 6, color: "var(--text-main)", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{translateServiceName(s, t)}</span>
                <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{money(Number(s.price || 0))}</b>
              </div>
            ))}
          </div>
        )}

        {/* Mã giảm giá */}
        <div style={{ ...sectionBox, border: "1px dashed var(--border-main)" }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
            <FaTicketAlt style={{ color: "var(--primary)" }} /> {t.promoCodeLabel}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder={t.promoPlaceholder}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)",
                background: "var(--bg-card)", color: "var(--text-main)", fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={() => handleApplyVoucher()}
              style={{
                padding: "10px 18px", borderRadius: 8, border: "none",
                background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer",
              }}
            >{t.applyPromo}</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.promoInstruction}</div>
            <SavedVoucherPicker
              providerId={selectedTrip?.providerId}
              orderAmount={voucherBaseAmount}
              onApply={handleApplyVoucher}
            />
          </div>
        </div>

        {bookingResult ? (
          <div style={{
            padding: 20, borderRadius: 12, background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid #22c55e", marginTop: 8,
          }}>
            <div style={{ fontWeight: 800, color: "#22c55e", fontSize: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <MdOutlineDone /> {t.successBooking}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.9 }}>
              <div>{t.bookingIdPrefix} <b style={{ color: "var(--primary)" }}>#{bookingResult.id}</b></div>
              <div>{t.totalAmountPrefix} <b style={{ color: "#f97316" }}>{money(Number(bookingResult.totalPrice || 0))}</b></div>
              <div>{t.seatPrefix} {Array.isArray(bookingResult.seatNumbers) ? bookingResult.seatNumbers.join(", ") : ""}</div>
            </div>
            <button
              type="button"
              onClick={goToPayment}
              style={{
                marginTop: 14, width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: "#005baa", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <MdOutlineCreditCard fontSize={20} /> {t.paymentVNPAY}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep("extras")}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)",
                background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
              }}
            >← {t.goBack}</button>
            <button
              type="button"
              onClick={submitBooking}
              disabled={submitLoading}
              style={{
                padding: "12px 32px", borderRadius: 8, border: "none", background: "#f97316",
                color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {submitLoading ? t.processing : `${t.bookTicketNow} →`}
            </button>
          </div>
        )}
      </div>

      {/* Chi tiết thanh toán */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16,
      }}>
        <div style={{
          fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)",
          paddingBottom: 10, color: "var(--text-main)",
        }}>
          {t.paymentDetails}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
          <div style={{ ...summaryRow, fontWeight: 600, color: "var(--text-main)" }}>
            <span>{t.ticketPriceForSeats.replace("{count}", selectedSeatIds.length).replace("{seats}", t.seatUnit)}</span>
            <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{money(seatsTotal)}</b>
          </div>

          {/* Tách theo hạng chỉ có nghĩa khi đơn gồm nhiều hạng khác nhau. */}
          {seatGroups.length > 1 && seatGroups.map(group => (
            <div key={group.type} style={{ ...summaryRow, color: "var(--text-main)", paddingLeft: 8 }}>
              <span>↳ {group.count}x {seatClassLabel(group.type, t)}</span>
              <b style={{ whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>{money(group.total)}</b>
            </div>
          ))}

          {chosenServices.map(s => (
            <div key={s.id} style={{ ...summaryRow, alignItems: "flex-start", color: "var(--text-main)", gap: 10, marginTop: 4 }}>
              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {translateServiceName(s, t)}</span>
              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>
                {Number(s.price || 0) === 0 ? t.free : money(Number(s.price || 0))}
              </b>
            </div>
          ))}

          {membershipDiscount > 0 && (
            <div style={{ ...summaryRow, color: "#22c55e", marginTop: 6, fontWeight: 600 }}>
              <span>🏅 {t.memberDiscountLabel.replace("{rate}", membershipDiscountPercent)}</span>
              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{money(membershipDiscount)}</span>
            </div>
          )}

          {appliedVoucher && (
            <div style={{ ...summaryRow, color: "#22c55e", marginTop: 4 }}>
              <span>🎟 {t.codePrefix} {appliedVoucher}</span>
              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{money(voucherDiscount)}</span>
            </div>
          )}

          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{t.totalLabel}</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>
              {money(Number(bookingResult
                ? bookingResult.totalPrice || 0
                : Math.max(0, seatsTotal + extraTotal - membershipDiscount - voucherDiscount)))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
