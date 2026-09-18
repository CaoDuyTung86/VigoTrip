// @ts-check
import { FaChair, FaUser, FaConciergeBell, FaCreditCard } from "react-icons/fa";

import HoldCountdownBanner from "./HoldCountdownBanner";

/** Thứ tự bốn bước, dùng để biết bước nào đã qua. */
const STEP_ORDER = { seatClass: 0, passenger: 1, extras: 2, review: 3 };

/** Các bước có thanh tiến trình phía trên. */
export const STEPPER_STEPS = Object.keys(STEP_ORDER);

/**
 * Thanh tiến trình bốn bước, kèm hai đồng hồ giữ chỗ và giữ thanh toán.
 *
 * Ba bản chép cũ chỉ khác nhau ở bộ biểu tượng — `FaConciergeBell` với `FaCreditCard` ở
 * trang xe khách, `FaBell` với `CiCreditCard1` ở hai trang kia. Không có lý do nghiệp vụ
 * nào cho việc bước "dịch vụ thêm" đeo chuông ở trang này và chuông khác ở trang kia; đó
 * là dấu vết của lần chép file. Nên ở đây chốt một bộ, và ba trang không còn phải import
 * biểu tượng chỉ để vẽ lại cùng một thanh.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 */
export default function BookingStepper({ booking }) {
  const { t, step, timeLeft, paymentTimeLeft } = booking;
  if (!STEPPER_STEPS.includes(step)) return null;

  const current = STEP_ORDER[step];
  const steps = [
    { key: "seatClass", icon: <FaChair />, label: t.step1Title },
    { key: "passenger", icon: <FaUser />, label: t.step2Title },
    { key: "extras", icon: <FaConciergeBell />, label: t.step3Title },
    { key: "review", icon: <FaCreditCard />, label: t.step4Title },
  ];

  return (
    <div style={{
      marginBottom: 20, background: "var(--bg-card)", borderRadius: 12,
      padding: "16px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}>
      <HoldCountdownBanner seconds={timeLeft} label={t.seatHoldTimeRemaining} />
      <HoldCountdownBanner seconds={paymentTimeLeft} label={t.paymentHoldTimeRemaining} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 21, left: "12%", right: "12%", height: 3, background: "var(--border-main)", zIndex: 0 }} />
        {steps.map((s) => {
          const isDone = STEP_ORDER[s.key] < current;
          const isActive = s.key === step;
          return (
            <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, flex: 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: isDone ? "linear-gradient(135deg,#22c55e,#16a34a)" : isActive ? "var(--primary)" : "var(--bg-input)",
                color: isDone || isActive ? "#fff" : "var(--text-muted)",
                border: isActive ? "none" : "1px solid var(--border-main)",
                fontWeight: 700, fontSize: 18, transition: "all .3s",
                boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
              }}>{isDone ? "✓" : s.icon}</div>
              <div style={{
                marginTop: 8, fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--primary)" : "var(--text-secondary)",
              }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
