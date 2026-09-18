// @ts-check
import { FaTicketAlt, FaShieldAlt, FaTaxi } from "react-icons/fa";
import { FiInfo } from "react-icons/fi";

import { translateServiceName } from "../utils/serviceCatalog";

/**
 * Bước 3 của luồng đặt vé: chọn hành lý, suất ăn, bảo hiểm và xe đưa đón.
 *
 * Khối này trước đây là 300 dòng JSX được chép nguyên vào cả ba trang đặt vé, và ba bản
 * chép ấy giống nhau 94% (xe khách ↔ tàu) tới 81% (cả ba). Phần khác nhau thật chỉ là
 * CHỮ và SỐ: tên gọi của gói bảo hiểm, mức bồi thường theo phương tiện, và cách hiện nhãn
 * gói hành lý. Không có khác biệt nào về cấu trúc, nên chúng thành tham số ở đây.
 *
 * Một lỗi được vá nhân dịp này: lưới `1fr 320px` chỉ có `booking-split-grid` ở bản của
 * trang máy bay, còn hai trang kia thiếu. Trên màn 375px, cột tóm tắt giá rộng 320px
 * chiếm gần trọn bề ngang và ép cột nội dung còn khoảng 35px — tức là luồng đặt vé xe
 * khách và tàu hoả gần như không dùng được trên điện thoại, trong khi trang máy bay thì
 * bình thường. Không ai cố tình làm vậy; đó là cái giá của ba bản sao, vá một chỗ thì hai
 * chỗ kia ở lại. Xem mục 8 trong index.css.
 *
 * @param {object} props
 * @param {import("../hooks/useTicketBooking").Booking} props.booking giá trị trả về của useTicketBooking
 * @param {object} props.labels chữ đã dịch sẵn, khác nhau theo phương tiện
 * @param {string} props.labels.baggageTitle
 * @param {string} props.labels.baggageSub
 * @param {string} props.labels.noExtraBaggage
 * @param {string} props.labels.mealSub
 * @param {string} props.labels.noMeals
 * @param {string} props.labels.buyMealElsewhere
 * @param {string} props.labels.insuranceTitle
 * @param {string} props.labels.insuranceSub
 * @param {string} props.labels.insuranceTip
 * @param {string} props.labels.transferTitle
 * @param {string} props.labels.transferSub
 * @param {Array<Array<string>>} props.insuranceRows bảng so sánh quyền lợi: [tên, gói cơ bản, gói cao]
 * @param {(service: {serviceName: string}) => string} [props.baggageOptionLabel] nhãn của một gói hành lý
 * @param {(base: number, seat: object) => number} props.getSeatPrice giá một chỗ theo hạng
 */
export default function ExtrasStep({
  booking,
  labels,
  insuranceRows,
  baggageOptionLabel,
  getSeatPrice,
}) {
  const {
    t,
    money,
    setStep,
    goToReview,
    servicesLoading,
    services,
    categories,
    selectedServiceIds,
    setSingleServiceInCategory,
    showAllMeals,
    setShowAllMeals,
    showInsuranceInfo,
    setShowInsuranceInfo,
    seats,
    selectedSeatIds,
    selectedTrip,
    membershipDiscount,
    membershipDiscountPercent,
  } = booking;

  /** Có chỗ nào trong nhóm này đang được chọn không. */
  const noneSelectedIn = (group) =>
    !selectedServiceIds.some((id) => group.map((s) => s.id).includes(id));

  const showName = baggageOptionLabel || ((s) => translateServiceName(s, t));

  return (
    <div
      className="booking-split-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--border-main)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>
          {t.step3}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
          {t.extrasInstruction}
        </p>

        {servicesLoading && <p style={{ color: "var(--text-muted)" }}>{t.loadingServices}</p>}

        {!servicesLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Hành lý */}
            <div
              style={{
                border: "1px solid var(--border-main)",
                borderRadius: 12,
                padding: 16,
                background: "var(--bg-input)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <FaTicketAlt style={{ color: "var(--primary)", fontSize: 22 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>
                    {labels.baggageTitle}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {labels.baggageSub}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: `2px solid ${noneSelectedIn(categories.baggage) ? "var(--primary)" : "var(--border-main)"}`,
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    minWidth: 80,
                    textAlign: "center",
                  }}
                >
                  <input
                    type="radio"
                    name="baggage"
                    style={{ display: "none" }}
                    checked={noneSelectedIn(categories.baggage)}
                    onChange={() => setSingleServiceInCategory(null, categories.baggage)}
                  />
                  <span style={{ fontSize: 16, color: "var(--text-muted)" }}>✕</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {labels.noExtraBaggage}
                  </span>
                </label>
                {categories.baggage.map((s) => {
                  const isSel = selectedServiceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "10px 18px",
                        borderRadius: 10,
                        border: `2px solid ${isSel ? "var(--primary)" : "var(--border-main)"}`,
                        background: "var(--bg-card)",
                        cursor: "pointer",
                        minWidth: 80,
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="baggage"
                        style={{ display: "none" }}
                        checked={isSel}
                        onChange={() => setSingleServiceInCategory(s.id, categories.baggage)}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                        {showName(s)}
                      </span>
                      <span style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}>
                        {money(Number(s.price || 0))}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Suất ăn */}
            <div
              style={{
                border: "1px solid var(--border-main)",
                borderRadius: 12,
                padding: "20px",
                background: "var(--bg-input)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22, color: "#f59e0b" }}>🍱</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)" }}>
                      {t.meal}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {labels.mealSub}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    borderRadius: 30,
                    border: `2px solid ${noneSelectedIn(categories.meal) ? "var(--primary)" : "var(--border-main)"}`,
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    color: noneSelectedIn(categories.meal) ? "var(--primary)" : "var(--text-secondary)",
                  }}
                >
                  <input
                    type="radio"
                    name="meal"
                    style={{ display: "none" }}
                    checked={noneSelectedIn(categories.meal)}
                    onChange={() => setSingleServiceInCategory(null, categories.meal)}
                  />
                  ✕ {t.noMealSelect}
                </label>
              </div>

              {categories.meal.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 0",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                  }}
                >
                  {labels.noMeals}
                  <br />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {labels.buyMealElsewhere}
                  </span>
                </div>
              ) : (
                <>
                  <div
                    className="stack-on-mobile"
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
                  >
                    {(showAllMeals ? categories.meal : categories.meal.slice(0, 4)).map(
                      (s, index) => {
                        const fallbackImages = [
                          "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=400&auto=format&fit=crop",
                          "https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=400&auto=format&fit=crop",
                          "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=400&auto=format&fit=crop",
                          "https://images.unsplash.com/photo-1555126634-323283e090fa?q=80&w=400&auto=format&fit=crop",
                        ];
                        const img = s.img || fallbackImages[index % fallbackImages.length];
                        const isSelected = selectedServiceIds.includes(s.id);
                        // Bỏ phần "Suất ăn - " / "Meal - " ở đầu vì tiêu đề khối đã nói rồi.
                        // Cắt theo dấu " - " đầu tiên chứ không theo chữ tiếng Việt, để một dòng
                        // code này chạy đúng ở mọi ngôn ngữ.
                        const fullName = translateServiceName(s, t);
                        const cleanName = fullName.includes(" - ")
                          ? fullName.slice(fullName.indexOf(" - ") + 3)
                          : fullName;
                        return (
                          <div
                            key={s.id}
                            onClick={() => setSingleServiceInCategory(s.id, categories.meal)}
                            style={{
                              borderRadius: 12,
                              overflow: "hidden",
                              border: `2px solid ${isSelected ? "var(--primary)" : "var(--border-main)"}`,
                              background: "var(--bg-card)",
                              cursor: "pointer",
                              position: "relative",
                              transition: "all 0.2s",
                              boxShadow: isSelected ? "0 4px 12px rgba(56, 139, 253, 0.2)" : "none",
                            }}
                          >
                            <div
                              style={{
                                height: 160,
                                backgroundImage: `url("${encodeURI(img)}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            />
                            <div style={{ padding: "10px 12px", background: "var(--bg-card)" }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: "var(--text-main)",
                                  lineHeight: 1.3,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  height: 34,
                                }}
                              >
                                {cleanName}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: 6,
                                }}
                              >
                                <span style={{ color: "#f97316", fontWeight: 800, fontSize: 14 }}>
                                  {money(Number(s.price || 0))}
                                </span>
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                    background: isSelected ? "var(--primary)" : "var(--bg-input)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: isSelected ? "#fff" : "var(--text-muted)",
                                    fontWeight: "bold",
                                    fontSize: 12,
                                  }}
                                >
                                  {isSelected ? "✓" : "+"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {categories.meal.length > 4 && (
                    <div style={{ textAlign: "center", marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => setShowAllMeals((v) => !v)}
                        style={{
                          padding: "8px 20px",
                          borderRadius: 20,
                          border: "1px solid var(--border-main)",
                          background: "var(--bg-card)",
                          color: "var(--primary)",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {showAllMeals
                          ? `▲ ${t.showLessMeals}`
                          : `▼ ${t.showMoreMeals.replace("{count}", categories.meal.length - 4)}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bảo hiểm & Xe đưa đón */}
            {[
              {
                cat: categories.insurance,
                icon: <FaShieldAlt style={{ color: "#22c55e", fontSize: 22 }} />,
                title: labels.insuranceTitle,
                sub: labels.insuranceSub,
                id: "insurance",
              },
              {
                cat: categories.transfer,
                icon: <FaTaxi style={{ color: "#f59e0b", fontSize: 22 }} />,
                title: labels.transferTitle,
                sub: labels.transferSub,
                id: "taxi",
              },
            ].map(
              ({ cat, icon, title, sub, id }) =>
                cat.length > 0 && (
                  <div
                    key={id}
                    style={{
                      border: "1px solid var(--border-main)",
                      borderRadius: 12,
                      padding: 16,
                      background: "var(--bg-input)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {icon}
                        <div>
                          <div
                            style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}
                          >
                            {title}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
                        </div>
                      </div>
                      {id === "insurance" && (
                        <button
                          type="button"
                          onClick={() => setShowInsuranceInfo((v) => !v)}
                          style={{
                            fontSize: 12,
                            padding: "4px 12px",
                            borderRadius: 20,
                            border: "1px solid var(--border-main)",
                            background: "var(--bg-card)",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {showInsuranceInfo ? t.hide : t.comparePlans}
                        </button>
                      )}
                    </div>

                    {id === "insurance" && showInsuranceInfo && (
                      <div
                        style={{
                          marginBottom: 14,
                          padding: 14,
                          background: "var(--bg-card)",
                          borderRadius: 10,
                          border: "1px solid var(--border-main)",
                          fontSize: 13,
                        }}
                      >
                        <div
                          style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}
                        >
                          📋 {t.compareInsurancePlans}
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table
                            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                          >
                            <thead>
                              <tr style={{ background: "var(--bg-input)" }}>
                                <th
                                  style={{
                                    padding: "6px 8px",
                                    textAlign: "left",
                                    borderBottom: "1px solid var(--border-main)",
                                    color: "var(--text-main)",
                                  }}
                                >
                                  {t.benefitCol}
                                </th>
                                <th
                                  style={{
                                    padding: "6px 8px",
                                    textAlign: "center",
                                    borderBottom: "1px solid var(--border-main)",
                                    color: "#22c55e",
                                  }}
                                >
                                  {t.planBasic}
                                </th>
                                <th
                                  style={{
                                    padding: "6px 8px",
                                    textAlign: "center",
                                    borderBottom: "1px solid var(--border-main)",
                                    color: "#60a5fa",
                                  }}
                                >
                                  {t.planPremium}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {insuranceRows.map(([benefit, basic, premium]) => (
                                <tr
                                  key={benefit}
                                  style={{ borderBottom: "1px solid var(--border-main)" }}
                                >
                                  <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>
                                    {benefit}
                                  </td>
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "center",
                                      color: basic === "✕" ? "var(--text-muted)" : "#22c55e",
                                    }}
                                  >
                                    {basic}
                                  </td>
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "center",
                                      color: premium === "✕" ? "var(--text-muted)" : "#60a5fa",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {premium}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            padding: "8px 10px",
                            background: "var(--bg-input)",
                            borderRadius: 8,
                            color: "var(--text-secondary)",
                            fontSize: 11,
                          }}
                        >
                          <FiInfo
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              fontSize: 12,
                              marginRight: 2,
                            }}
                          />{" "}
                          <b>{t.insuranceTipLabel}</b> {labels.insuranceTip}
                        </div>
                      </div>
                    )}

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${noneSelectedIn(cat) ? "var(--primary)" : "var(--border-main)"}`,
                        background: "var(--bg-card)",
                        cursor: "pointer",
                        marginBottom: 8,
                        fontWeight: 600,
                        fontSize: 13,
                        color: noneSelectedIn(cat) ? "var(--primary)" : "var(--text-secondary)",
                      }}
                    >
                      <input
                        type="radio"
                        name={`cat_${id}`}
                        style={{ display: "none" }}
                        checked={noneSelectedIn(cat)}
                        onChange={() => setSingleServiceInCategory(null, cat)}
                      />
                      {t.doNotSelect}
                    </label>

                    {cat.map((s) => {
                      // Không cắt tiền tố nữa. Bản cũ cắt bằng regex tiếng Việt và trượt ở CẢ BA
                      // trang: trang tàu cắt "Taxi đưa đón sân ga" còn dữ liệu ghi "sân bay",
                      // trang xe khách cắt "Bảo hiểm chuyến đi" còn dữ liệu ghi "Bảo hiểm du
                      // lịch" — trượt thì hiện nguyên cả câu, trúng thì còn lại "cơ bản" viết
                      // thường. Bảng dịch giờ cho sẵn tên gọn và đủ nghĩa.
                      const shortName = translateServiceName(s, t);
                      const sel = selectedServiceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          onClick={() => setSingleServiceInCategory(s.id, cat)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: "var(--bg-card)",
                            border: `1.5px solid ${sel ? "var(--primary)" : "var(--border-main)"}`,
                            cursor: "pointer",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                  color: "var(--text-main)",
                                }}
                              >
                                {shortName}
                              </div>
                              {sel && (
                                <div style={{ fontSize: 11, color: "var(--primary)" }}>
                                  {t.selected}
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: "#f97316",
                              flexShrink: 0,
                            }}
                          >
                            {Number(s.price || 0) === 0 ? t.free : `${money(Number(s.price || 0))}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setStep("passenger")}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← {t.goBack}
          </button>
          <button
            type="button"
            onClick={goToReview}
            style={{
              padding: "10px 28px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.reviewAndPay} →
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--border-main)",
          height: "fit-content",
          position: "sticky",
          top: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 12,
            borderBottom: "1px solid var(--border-main)",
            paddingBottom: 10,
            color: "var(--text-main)",
          }}
        >
          {t.totalCost}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
          {(() => {
            const selSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
            const basePrice = Number(selectedTrip.price || 0);
            const seatsTotal = selSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s), 0);
            const extraTotal = services
              .filter((s) => selectedServiceIds.includes(s.id))
              .reduce((sum, s) => sum + (s.price || 0), 0);

            return (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    gap: 8,
                  }}
                >
                  <span>
                    {t.ticketPriceForSeats
                      .replace("{count}", selectedSeatIds.length)
                      .replace("{seats}", t.seatUnit)}
                  </span>
                  <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{money(seatsTotal)}</b>
                </div>
                {services
                  .filter((s) => selectedServiceIds.includes(s.id))
                  .map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        color: "var(--text-secondary)",
                        gap: 10,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                        + {translateServiceName(s, t)}
                      </span>
                      <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>
                        {Number(s.price || 0) === 0 ? t.free : `${money(Number(s.price || 0))}`}
                      </b>
                    </div>
                  ))}
                {membershipDiscount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#22c55e",
                      marginTop: 6,
                      fontWeight: 600,
                      gap: 8,
                    }}
                  >
                    <span>🏅 {t.memberDiscountLabel.replace("{rate}", membershipDiscountPercent)}</span>
                    <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                      -{money(membershipDiscount)}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-main)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>
                    {t.totalLabel}
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      color: "#f97316",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {money(Math.max(0, seatsTotal + extraTotal - membershipDiscount))}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
