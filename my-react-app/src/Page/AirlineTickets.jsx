import { useState } from "react";
import axios from "axios";

import DatePicker from "../components/DatePicker";
import PassengerInfoForm from "../components/PassengerInfoForm";
import ContactInfoForm from "../components/ContactInfoForm";
import AirplaneSeatMap from "../components/AirplaneSeatMap";
import Sidebar from "../components/Sidebar";
import SavedVoucherPicker from "../components/SavedVoucherPicker";
import HoldCountdownBanner from "../components/HoldCountdownBanner";
import WeatherPanel from "../components/WeatherPanel";
import ExtrasStep from "../components/ExtrasStep";
import { CgSandClock } from "react-icons/cg";
import { IoMdSearch } from "react-icons/io";
import { FiChevronDown, FiClock, FiSearch, FiLock, FiInfo } from "react-icons/fi";
import { FaPlaneDeparture, FaPlaneArrival, FaRegCalendarAlt, FaUser, FaBell, FaShieldAlt, FaTaxi, FaChair, FaTicketAlt } from "react-icons/fa";
import { RiBuilding4Line } from "react-icons/ri";
import { MdOutlineDone } from "react-icons/md";
import { CiCreditCard1 } from "react-icons/ci";

import useTicketBooking from "../hooks/useTicketBooking";
import { canSelectSeats, isSeatLockedByOthers } from "../utils/seatBookingHelpers";
import { formatTripDateTime } from "../utils/datetime";
import { translateServiceName } from "../utils/serviceCatalog";
import { providersFor } from "../utils/providerBranding";
import { seatPrice } from "../utils/seatPricing";

/** Giá một chỗ theo hạng, đã chốt sẵn loại phương tiện của trang này. */
const getSeatPrice = (base, seat) => seatPrice("PLANE", base, seat);

/** Nhãn hiệu nhà cung cấp của luồng này — xem utils/providerBranding.js. */
const PROVIDER_LOGOS = providersFor("air");


const AirlineTickets = () => {
  const [isSidebarOpen] = useState(true); // setter đã bỏ: chỉ từng truyền cho <Header />, mà Header không nhận prop

  /**
   * Luồng đặt vé dùng chung với hai trang phương tiện còn lại — xem hooks/useTicketBooking.js.
   * Trang này chỉ còn phần giao diện riêng của nó.
   */
  const booking = useTicketBooking({
    mode: "air",
    tripType: "PLANE",
    searchFailedKey: "airSearchFailed",
    calendarCountsInfants: true,
  });
  const {
    t, currentLanguage, money, stations, token, isAuthenticated, user,
    membershipDiscountPercent, savedPassengers, from, setFrom, to, setTo, date, setDate,
    showFromDropdown, setShowFromDropdown, showToDropdown, setShowToDropdown,
    passengerCounts, passengers, passengerCountLocked, changePassengerCount,
    showPassengersDropdown, setShowPassengersDropdown, todayISO, handleSearch,
    handleSearchWithDate, performSearch, formErrors, setFormErrors, trips, filteredTrips,
    allProviders, sortBy, setSortBy, filterAvailableOnly, setFilterAvailableOnly,
    filterProviders, setFilterProviders, timeRange, setTimeRange, calendarOpen,
    setCalendarOpen, calendarLoading, calendarData, loadCalendar, selectedTrip,
    handleSelectTrip, seats, selectedSeatIds, setSelectedSeatIds, toggleSeat, maxSeats,
    isMaxReached, selectedSeatClass, setSelectedSeatClass, ownerToken, timeLeft,
    paymentTimeLeft, setLockDeadline, unlockSeats, showToast, passengerInfoList,
    handlePassengerChange, contactInfo, setContactInfo, globalContact, setGlobalContact,
    services, selectedServiceIds, membershipDiscount, voucherBaseAmount, promoCode,
    setPromoCode, appliedVoucher, voucherDiscount, handleApplyVoucher, step, setStep,
    goToExtras, goToExtrasFromPassenger, submitBooking, submitLoading, bookingResult,
    loading,
  } = booking;
  const airports = stations;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>

      {/* App.jsx đã dựng <Header /> cho route này. Trang tự dựng thêm một cái nữa là
          hai header position:fixed chồng khít lên nhau — từ khi có ngăn kéo mobile thành
          hai hamburger, hai ngăn kéo trong DOM. Prop setIsSidebarOpen cũng chưa bao giờ
          có tác dụng: Header không nhận prop nào. */}

      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <div
          className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <div className="page-content-wrap" style={{ maxWidth: "1200px" }}>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "var(--text-main)",
                marginBottom: "30px",
              }}
            >
              {t.flight}
            </h1>

            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "12px",
                padding: "24px",
                boxShadow: "var(--shadow-md)",
                marginBottom: "24px",
              }}
            >

              <div className="flight-filter-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr auto", gap: 12, alignItems: "start" }}>


                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaPlaneArrival /> {t.departurePoint || t.from || "Điểm đi"}</label>
                  <div
                    onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.from ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{from}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {airports.find(a => a.code === from)?.name || t.selectAirport || "Chọn sân bay"}
                    </div>
                  </div>
                  {formErrors.from && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.from}</div>}
                  {showFromDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {airports.filter(a => a.code !== to).map(a => (
                        <div key={a.code} onClick={() => { setFrom(a.code); setShowFromDropdown(false); setFormErrors(p => ({ ...p, from: undefined })); }}
                          style={{
                            padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: from === a.code ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-main)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={e => e.currentTarget.style.background = from === a.code ? "var(--bg-hover)" : "transparent"}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.code} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>– {a.name}</span></div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.fullName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                <button type="button"
                  onClick={() => { const t = from; setFrom(to); setTo(t); }}
                  style={{
                    marginTop: 28, width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--border-main)",
                    background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "var(--primary)", flexShrink: 0, transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
                  title={t.swapDestinations || "Đổi điểm đi/đến"}
                >⇄</button>


                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaPlaneDeparture /> {t.destinationPoint || t.to || "Điểm đến"}</label>
                  <div
                    onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.to ? "2px solid #e53935" : "2px solid var(--border-main)",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{to}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {airports.find(a => a.code === to)?.name || t.selectAirport || "Chọn sân bay"}
                    </div>
                  </div>
                  {formErrors.to && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.to}</div>}
                  {showToDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {airports.filter(a => a.code !== from).map(a => (
                        <div key={a.code} onClick={() => { setTo(a.code); setShowToDropdown(false); setFormErrors(p => ({ ...p, to: undefined })); }}
                          style={{
                            padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: to === a.code ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-main)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={e => e.currentTarget.style.background = to === a.code ? "var(--bg-hover)" : "transparent"}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.code} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>– {a.name}</span></div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.fullName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaRegCalendarAlt /> {t.departureDate || "Ngày đi"}</label>
                  <div style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                    border: formErrors.date ? "2px solid #e53935" : "2px solid var(--border-main)", background: "var(--bg-input)"
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
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaUser /> {t.passengers || "Hành khách"}</label>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <div
                      onClick={() => { if (!passengerCountLocked) setShowPassengersDropdown(!showPassengersDropdown); }}
                      title={passengerCountLocked ? t.passengerCountLockedHint : undefined}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border-main)",
                        background: "var(--bg-input)", color: "var(--text-main)", fontSize: 15, cursor: passengerCountLocked ? "not-allowed" : "pointer", opacity: passengerCountLocked ? 0.6 : 1, display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box"
                      }}
                    >
                      <span>{passengerCounts.adult} {t.adult || 'Người lớn'}, {passengerCounts.child} {t.child || 'Trẻ em'}, {passengerCounts.infant} {t.infant || 'Em bé'}</span>
                      <FiChevronDown />
                    </div>
                    {showPassengersDropdown && !passengerCountLocked && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 16, marginTop: 4, border: "1px solid var(--border-main)" }}>
                        {['adult', 'child', 'infant'].map(type => (
                          <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{type === 'adult' ? t.adult || 'Người lớn' : type === 'child' ? t.child || 'Trẻ em' : t.infant || 'Em bé'}</div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{type === 'adult' ? (t.ageAdultHint || '>12 tuổi') : type === 'child' ? (t.ageChildHint || '2-11 tuổi') : (t.ageInfantHint || '<2 tuổi')}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button type="button" disabled={passengerCounts[type] <= (type === 'adult' ? 1 : 0)} onClick={() => changePassengerCount(type, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                              <span style={{ fontWeight: 600, width: 16, textAlign: "center", color: "var(--text-main)" }}>{passengerCounts[type]}</span>
                              <button type="button" disabled={passengerCounts.adult + passengerCounts.child + passengerCounts.infant >= 5} onClick={() => changePassengerCount(type, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
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
                      width: "100%",
                      padding: "11px",
                      borderRadius: 10,
                      border: "none",
                      background: loading
                        ? "#555"
                        : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 14,
                      marginBottom: 8,
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    {loading ? (
                      <>
                        <CgSandClock /> {t.searching || "Đang tìm..."}
                      </>
                    ) : (
                      <>
                        <IoMdSearch style={{ fontSize: 17 }} /> {t.searchFlight || "Tìm chuyến bay"}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={loadCalendar}
                    disabled={calendarLoading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: "1px solid var(--border-main)",
                      background: "var(--bg-input)",
                      color: "var(--text-main)",
                      fontWeight: 600,
                      cursor: calendarLoading ? "not-allowed" : "pointer",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    {calendarLoading ? (
                      <>
                        <CgSandClock /> {t.loadingCalendar || "Đang tải..."}
                      </>
                    ) : (
                      <>
                        <FaRegCalendarAlt /> {t.viewCheapCalendar || "Xem lịch giá rẻ"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {calendarOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{t.calendar30Days || "Lịch giá 30 ngày tới"}</div>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: 18,
                        color: "var(--text-secondary)",
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {calendarData.filter(d => d.available).map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => handleSearchWithDate(d.date)}
                        style={{
                          width: 150,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--border-main)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s",
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
                      {t.noCheapFlights || "Hiện chưa có chuyến bay phù hợp trong khoảng ngày này. Bạn có thể bỏ chọn \"tìm vé rẻ nhất\" và dùng tìm kiếm thường, hoặc đổi điểm đi/điểm đến/ngày khác."}
                    </p>
                  )}
                </div>
              )}

            </div>

            {step === "chooseTrip" && trips.length > 0 && (() => {
              const minPrice = Math.min(...trips.map(t => t.price || Infinity));
              return (
                <div style={{ marginBottom: 24 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FaPlaneDeparture style={{ color: "#4f7cff" }} /> {t.listFlightTitle || "Danh sách chuyến bay"}
                      </h2>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        {(t.showingTrips || "Hiển thị {filtered}/{total} chuyến phù hợp")
                          .replace("{filtered}", filteredTrips.length)
                          .replace("{total}", trips.length)}
                      </p>
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg,#4f7cff,#6a3de8)",
                      color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600
                    }}>
                      {airports.find(a => a.code === from)?.name || from} → {airports.find(a => a.code === to)?.name || to}
                    </div>
                  </div>

                  {/* ──── Filter & Sort Bar ──── */}
                  <div style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    padding: "16px 20px",
                    marginBottom: 20,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      {/* Sort selection */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.sortByLabel || "Sắp xếp theo:"}</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border-light)",
                            background: "var(--bg-input)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="price_asc">{t.sortPriceAsc || "Giá vé: Thấp đến Cao"}</option>
                          <option value="price_desc">{t.sortPriceDesc || "Giá vé: Cao đến Thấp"}</option>
                          <option value="time_asc">{t.sortTimeAsc || "Giờ đi: Sớm nhất đến Muộn nhất"}</option>
                          <option value="time_desc">{t.sortTimeDesc || "Giờ đi: Muộn nhất đến Sớm nhất"}</option>
                          <option value="duration_asc">{t.sortDurationAsc || "Thời gian chạy: Ngắn nhất"}</option>
                        </select>
                      </div>

                      {/* Seat Availability Filter */}
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={filterAvailableOnly}
                          onChange={(e) => setFilterAvailableOnly(e.target.checked)}
                          style={{ accentColor: "#4f7cff", width: 16, height: 16, cursor: "pointer" }}
                        />
                        {t.availableSeatsOnly || "Chỉ chuyến còn ghế trống"}
                      </label>
                    </div>

                    {/* Time Range Filter (Presets Only) */}
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                        🕒 {t.departureTimeRange || "Khung giờ khởi hành:"}
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: t.timeRangeAll || "Tất cả", range: [0, 24] },
                          { label: t.timeRangeEarlyMorning || "Sáng sớm (0 - 6h)", range: [0, 6] },
                          { label: t.timeRangeMorning || "Sáng (6 - 12h)", range: [6, 12] },
                          { label: t.timeRangeAfternoon || "Chiều (12 - 18h)", range: [12, 18] },
                          { label: t.timeRangeEvening || "Tối (18 - 24h)", range: [18, 24] },
                        ].map(preset => {
                          const isSelected = timeRange[0] === preset.range[0] && timeRange[1] === preset.range[1];
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setTimeRange(preset.range)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 20,
                                border: isSelected
                                  ? "1.5px solid var(--primary)"
                                  : "1px solid var(--border-main)",
                                background: isSelected
                                  ? "var(--primary)"
                                  : "var(--bg-card)",
                                color: isSelected
                                  ? "#ffffff"
                                  : "var(--text-main)",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                boxShadow: isSelected ? "0 2px 8px rgba(79, 124, 255, 0.3)" : "none",
                              }}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Provider Filter Pills */}
                    {allProviders.length > 0 && (
                      <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.airlineProvider || "Hãng bay:"}</span>
                        {allProviders.map(pName => {
                          const isChecked = filterProviders.includes(pName);
                          return (
                            <button
                              key={pName}
                              type="button"
                              onClick={() => {
                                setFilterProviders(prev =>
                                  isChecked ? prev.filter(x => x !== pName) : [...prev, pName]
                                );
                              }}
                              style={{
                                padding: "5px 12px",
                                borderRadius: 20,
                                border: isChecked ? "1.5px solid #4f7cff" : "1px solid var(--border-light)",
                                background: isChecked ? "#eff6ff" : "var(--bg-input)",
                                color: isChecked ? "#4f7cff" : "var(--text-primary)",
                                fontSize: 12,
                                fontWeight: isChecked ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            {t.clearAirlineFilter || "Xóa lọc hãng"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {filteredTrips.length === 0 ? (
                    <div style={{
                      textAlign: "center", padding: "40px 20px", background: "var(--bg-card)",
                      borderRadius: 16, border: "1px dashed var(--border-light)", color: "var(--text-secondary)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%", background: "var(--bg-input)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 20
                      }}>
                        <FiSearch />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, maxWidth: 480, lineHeight: 1.5 }}>
                        {t.noMatchingFlightTrips || "Không có chuyến bay nào phù hợp với bộ lọc hiện tại. Hãy thử mở rộng khung giờ hoặc bỏ lọc hãng."}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {filteredTrips.map((trip) => {
                      const isSelected = selectedTrip?.id === trip.id;
                      const isCheapest = trip.price === minPrice;
                      const seatPct = trip.availableSeats / (trip.totalSeats || 1);
                      const seatWarning = trip.availableSeats <= 5;

                      // Calculate flight duration & time parsing
                      const parseTripTime = (timeStr) => {
                        if (!timeStr) return null;
                        if (timeStr.includes("T")) return new Date(timeStr);
                        return new Date(`2000-01-01T${timeStr}`);
                      };
                      const formatTimeDisplay = (timeStr) => {
                        if (!timeStr) return "--:--";
                        if (timeStr.includes("T")) {
                          const timePart = timeStr.split("T")[1];
                          return timePart ? timePart.slice(0, 5) : "--:--";
                        }
                        return timeStr.slice(0, 5);
                      };

                      const dep = parseTripTime(trip.departureTime);
                      const arr = parseTripTime(trip.arrivalTime);
                      let duration = "";
                      if (dep && arr) {
                        let diff = (arr - dep) / 60000;
                        if (diff < 0) diff += 1440;
                        const hours = Math.floor(diff / 60);
                        const mins = Math.round(diff % 60);
                        const hUnit = t.durationHours || "g";
                        const mUnit = t.durationMins || "ph";
                        duration = `${hours}${hUnit}${mins > 0 ? ` ${mins}${mUnit}` : ""}`;
                      }

                      return (
                        <div
                          key={trip.id}
                          onClick={() => handleSelectTrip(trip)}
                          style={{
                            background: isSelected
                              ? "var(--bg-accent)"
                              : "var(--bg-card)",
                            border: isSelected
                              ? "2px solid var(--primary)"
                              : "1.5px solid var(--border-main)",
                            borderRadius: 16,
                            padding: "18px 22px",
                            cursor: "pointer",
                            transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                            boxShadow: isSelected
                              ? "0 6px 24px rgba(56,139,253,0.25)"
                              : "var(--shadow-sm)",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {/* Cheapest badge ribbon */}
                          {isCheapest && (
                            <div style={{
                              position: "absolute", top: 0, right: 0,
                              background: "linear-gradient(135deg,#22c55e,#16a34a)",
                              color: "#fff", fontSize: 11, fontWeight: 700,
                              padding: "4px 12px 4px 16px",
                              borderBottomLeftRadius: 12,
                              letterSpacing: "0.5px",
                            }}>
                              🏷️ {t.cheapest || "RẺ NHẤT"}
                            </div>
                          )}

                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            {/* Airline logo circle */}
                            {(() => {
                              const pInfo = PROVIDER_LOGOS[trip.providerName];
                              const logoColor = "#4f7cff";
                              const pColor = pInfo?.color || logoColor;
                              return (
                                <div style={{
                                  width: 52, height: 52, borderRadius: 14,
                                  background: pInfo?.bg || `linear-gradient(135deg,${pColor}22,${pColor}44)`,
                                  border: `1.5px solid ${pColor}44`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0, padding: 4, overflow: "hidden", position: "relative",
                                }}>
                                  {pInfo?.logo ? (
                                    <img
                                      src={pInfo.logo}
                                      alt={trip.providerName}
                                      style={{ width: "90%", height: "90%", objectFit: "contain" }}
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  ) : (
                                    <div style={{ textAlign: "center" }}>
                                      <span style={{ fontSize: 15, fontWeight: 800, color: pColor, lineHeight: 1, display: "block" }}>
                                        {pInfo?.code || (trip.providerName || "VN").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: 8, color: pColor + "bb", fontWeight: 600, marginTop: 2, display: "block" }}>
                                        {t.airlineBadge || "MÁY BAY"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Provider name */}
                            <div style={{ minWidth: 100, flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>
                                {trip.providerName}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {trip.vehicleType || t.commercialFlight || "Máy bay"}
                              </div>
                            </div>

                            {/* Separator */}
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Time + route block */}
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                              {/* Departure */}
                              <div style={{ textAlign: "center", minWidth: 70 }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                                  {formatTimeDisplay(trip.departureTime)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                                  {trip.origin}
                                </div>
                              </div>

                              {/* Route line */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 80 }}>
                                {duration && (
                                  <div style={{
                                    fontSize: 11, color: "var(--primary)", fontWeight: 700,
                                    background: "var(--primary-light)", padding: "2px 10px", borderRadius: 20,
                                  }}>
                                    ⏱ {duration}
                                  </div>
                                )}
                                <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,var(--border-main),var(--primary))" }} />
                                  <span style={{ fontSize: 14, color: "var(--primary)" }}>✈</span>
                                  <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,var(--primary),var(--border-main))" }} />
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.directFlightRoute || "Bay thẳng"}</div>
                              </div>

                              {/* Arrival */}
                              <div style={{ textAlign: "center", minWidth: 70 }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                                  {formatTimeDisplay(trip.arrivalTime)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                                  {trip.destination}
                                </div>
                              </div>
                            </div>

                            {/* Separator */}
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Seat availability */}
                            <div style={{ minWidth: 90, textAlign: "center", flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{t.availableSeats || "Chỗ trống"}</div>
                              <div style={{
                                fontSize: 13, fontWeight: 700,
                                color: seatWarning ? "#ef4444" : "#22c55e",
                              }}>
                                {trip.availableSeats}/{trip.totalSeats}
                              </div>
                              {/* Seat bar */}
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
                                  {t.almostSoldOut || "Sắp hết vé!"}
                                </div>
                              )}
                            </div>

                            {/* Separator */}
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Price + CTA */}
                            <div style={{ textAlign: "center", minWidth: 130, flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.pricePerPerson || "Giá/người"}</div>
                              <div style={{
                                fontSize: 20, fontWeight: 900,
                                color: "#f97316",
                                lineHeight: 1.2,
                                whiteSpace: "nowrap",
                                marginBottom: 8,
                              }}>
                                {money(trip.price)}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); handleSelectTrip(trip); }}
                                style={{
                                  background: isSelected
                                    ? "linear-gradient(135deg,#22c55e,#16a34a)"
                                    : "var(--primary)",
                                  color: "#fff", border: "none",
                                  padding: "8px 22px", borderRadius: 10,
                                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                                  width: "100%",
                                  boxShadow: isSelected
                                    ? "0 4px 12px rgba(34,197,94,0.35)"
                                    : "0 4px 12px rgba(56,139,253,0.35)",
                                  transition: "all 0.2s",
                                }}
                              >
                                {isSelected ? (t.selected || "✓ Đã chọn") : (t.selectTicket || "Chọn vé")}
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
          })()}


            {["seatClass", "passenger", "extras", "review"].includes(step) && (
              <div style={{ marginBottom: 20, background: "var(--bg-card)", borderRadius: 12, padding: "16px 24px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                <HoldCountdownBanner seconds={timeLeft} label={t.seatHoldTimeRemaining} icon={<FiClock style={{ fontSize: 16 }} />} />
                <HoldCountdownBanner seconds={paymentTimeLeft} label={t.paymentHoldTimeRemaining} icon={<FiClock style={{ fontSize: 16 }} />} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>

                  <div style={{ position: "absolute", top: 20, left: "12.5%", right: "12.5%", height: 3, background: "var(--border-main)", zIndex: 0 }} />
                  {[
                    { key: "seatClass", icon: <FaChair />, label: t.step1Title },
                    { key: "passenger", icon: <FaUser />, label: t.step2Title },
                    { key: "extras", icon: <FaBell />, label: t.step3Title },
                    { key: "review", icon: <CiCreditCard1 />, label: t.step4Title },
                  ].map((s) => {
                    const orderMap = { seatClass: 0, passenger: 1, extras: 2, review: 3 };
                    const current = orderMap[step];
                    const isDone = orderMap[s.key] < current;
                    const isActive = s.key === step;
                    return (
                      <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, flex: 1 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: isDone ? "#22c55e" : isActive ? "var(--primary)" : "var(--bg-input)",
                          color: isDone || isActive ? "#fff" : "var(--text-muted)",
                          border: isActive ? "none" : "1px solid var(--border-main)",
                          fontWeight: 700, fontSize: 18, transition: "all .3s",
                        }}>{isDone ? "✓" : s.icon}</div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? "var(--primary)" : "var(--text-secondary)" }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {selectedTrip && step === "seatClass" && (
              <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step1}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>{t.selectSeatInstruction}</p>
                  {!canSelectSeats(isAuthenticated, user) && (
                    <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 12, padding: "10px 12px", background: "rgba(245,158,11,0.1)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)" }}>
                      {t.loginRequiredSeat}
                    </p>
                  )}

                  {loading && <p style={{ color: "var(--text-muted)" }}>{t.loadingSeatMap}</p>}


                  {!loading && seats.length > 0 && (
                    <AirplaneSeatMap
                      seats={seats}
                      selectedSeatIds={selectedSeatIds}
                      onToggleSeat={toggleSeat}
                      isSeatLockedByOthers={isSeatLockedByOthers}
                      ownerToken={ownerToken}
                      user={user}
                      isAuthenticated={isAuthenticated}
                      canSelectSeats={canSelectSeats}
                      isMaxReached={isMaxReached}
                      maxSeats={maxSeats}
                      selectedSeatClass={selectedSeatClass}
                      setSelectedSeatClass={setSelectedSeatClass}
                    />
                  )}

                  {!loading && seats.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t.noSeatData}</p>}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => {
                      // Khôi phục bản nháp xong thì danh sách chuyến rỗng: lần tìm kiếm đó
                      // thuộc về trang trước khi tải lại. Quay về mà không tìm lại thì người
                      // dùng nhìn thấy một màn hình trống trơn không giải thích được.
                      if (trips.length === 0) performSearch(from, to, date, null);
                      else setStep("chooseTrip");
                    }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtras} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.bookingSummary}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>✈</span> <span>{selectedTrip.origin}</span> <span style={{ color: "var(--primary)" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "var(--primary)", fontSize: 14, flexShrink: 0 }} />
                      <span>{(() => {
                        const d = new Date(selectedTrip.departureTime);
                        return !Number.isNaN(d.getTime())
                          ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
                          : selectedTrip.departureTime;
                      })()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                      <RiBuilding4Line style={{ color: "var(--primary)", fontSize: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--summary-eco-bg)", borderRadius: 8, border: "1px solid var(--summary-eco-border)" }}>
                      <div style={{ fontSize: 12, color: "var(--summary-eco-title)", fontWeight: 600, marginBottom: 4 }}>🟢 {t.economy} (ECO)</div>
                      <div style={{ fontWeight: 800, color: "var(--summary-eco-price)", fontSize: 15 }}>{money(Number(selectedTrip.price || 0))}</div>
                    </div>
                    <div style={{ marginTop: 6, padding: "8px 10px", background: "var(--summary-vip-bg)", borderRadius: 8, border: "1px solid var(--summary-vip-border)" }}>
                      <div style={{ fontSize: 12, color: "var(--summary-vip-title)", fontWeight: 600, marginBottom: 4 }}>🔵 {t.business} (BUSINESS)</div>
                      <div style={{ fontWeight: 800, color: "var(--summary-vip-price)", fontSize: 15 }}>{money(Number((selectedTrip.price || 0) * 2.5))}</div>
                    </div>
                    <div style={{ marginTop: 8, color: selectedSeatIds.length >= (passengers || 1) ? "#22c55e" : "var(--text-muted)" }}>{t.seatsSelectedCount.replace('{selected}', selectedSeatIds.length).replace('{total}', passengers || 1)}</div>
                    {/* Thời tiết nơi sắp tới, ngay dưới phần tóm tắt đơn. Tự ẩn khi chuyến đi
                        quá bảy ngày nữa mới khởi hành — dự báo xa hơn thì không đáng tin. */}
                    <WeatherPanel place={selectedTrip.destination} date={selectedTrip.departureTime} />
                  </div>
                </div>
              </div>
            )}


            {selectedTrip && step === "passenger" && (
              <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t.step2}</h2>
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
                        onSelectSaved={(i, t, p) => handlePassengerChange(i, t, {
                          ...p,
                          fullName: p.fullName || "",
                          phone: p.phone || "",
                          email: p.email || "",
                          idNumber: p.idNumber || "",
                          dateOfBirth: p.dateOfBirth || "",
                          gender: p.gender || "",
                          nationality: p.nationality || "Việt Nam"
                        })}
                      />
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                    <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={globalContact.remember} onChange={e => setGlobalContact(p => ({ ...p, remember: e.target.checked }))} />
                      {t.rememberInfo}
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => {
                      const seatsToUnlock = [...selectedSeatIds];
                      unlockSeats({
                        tripId: selectedTrip.id,
                        seatIds: seatsToUnlock,
                      });
                      setSelectedSeatIds([]);
                      setLockDeadline(null);
                      setStep("seatClass");
                    }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtrasFromPassenger} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.bookingSummary}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>✈</span> <span>{selectedTrip.origin}</span> <span style={{ color: "var(--primary)" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "var(--primary)", fontSize: 14, flexShrink: 0 }} />
                      <span>{(() => {
                        const d = new Date(selectedTrip.departureTime);
                        return !Number.isNaN(d.getTime())
                          ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
                          : selectedTrip.departureTime;
                      })()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
                      <RiBuilding4Line style={{ color: "var(--primary)", fontSize: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    {(() => {
                      const selectedSeatsObj = seats.filter(s => selectedSeatIds.includes(s.id));
                      const totalPrice = selectedSeatsObj.reduce((sum, s) => {
                        const isBiz = ["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType);
                        const seatPrice = isBiz ? (selectedTrip.price || 0) * 2.5 : (selectedTrip.price || 0);
                        return sum + seatPrice;
                      }, 0);

                      return (
                        <>
                          <div style={{ marginTop: 8, color: "var(--text-main)" }}>
                            {t.seatPrefix} <b>{selectedSeatsObj.length === 0 ? t.notSelected : selectedSeatsObj.map(s => `${s.seatNumber}${["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? ` (${t.business})` : ""}`).join(", ")}</b>
                          </div>
                          <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.ticketTotalLabel}</div>
                            <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17 }}>
                              {totalPrice > 0 ? `${money(totalPrice)}` : `${money(Number(selectedTrip.price || 0))} ${t.perSeatUnit}`}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}


            {selectedTrip && step === "extras" && (
              <ExtrasStep
                booking={booking}
                getSeatPrice={getSeatPrice}
            baggageOptionLabel={(s) => s.serviceName.replace(/[^\d]+/g, "") + "kg"}
                labels={{
      baggageTitle: t.checkedBaggage,
      baggageSub: t.baggageSub,
      noExtraBaggage: t.doNotBuy,
      mealSub: t.mealSub,
      noMeals: t.airlineNoMeals,
      buyMealElsewhere: t.buyOnboard,
      insuranceTitle: t.travelInsurance,
      insuranceSub: t.insuranceSub,
      insuranceTip: t.insuranceTip,
      transferTitle: t.airportTaxi,
      transferSub: t.taxiSub,
    }}
                insuranceRows={[
      [t.insFlightAccident, `250 ${t.millionVnd}`, `500 ${t.millionVnd}`],
      [t.insTripCancellation, "✕", t.insFullRefund],
      [t.insLostBaggage, `2 ${t.millionVnd}`, `5 ${t.millionVnd}`],
      [t.insMedicalCosts, `10 ${t.millionVnd}`, `50 ${t.millionVnd}`],
      [t.insFlightDelay, "✕", t.insDelayComp],
    ]}
              />
            )}

            {selectedTrip && step === "review" && (
              <div className="booking-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step4}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.reviewInstruction}</p>


                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>✈ {t.flightLabel}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-main)" }}>{selectedTrip.origin} → {selectedTrip.destination}</div>
                        <div style={{ color: "var(--text-main)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>{formatTripDateTime(selectedTrip.departureTime, currentLanguage?.code)} · {selectedTrip.providerName}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17, whiteSpace: "nowrap" }}>
                        {(() => {
                          const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                          const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
                          const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
                          const basePrice = Number(selectedTrip.price || 0);
                          return money((ecoCount * basePrice + bizCount * basePrice * 2.5));
                        })()} đ
                      </div>
                    </div>
                  </div>


                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}><FaUser /> {t.contactReviewTitle || "Người liên hệ"}</div>
                    <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.6, marginBottom: 14, paddingBottom: 12, borderBottom: "1px dashed var(--border-main)" }}>
                      <b style={{ fontSize: 15, textTransform: "uppercase" }}>{contactInfo.name}</b>
                      <div>{contactInfo.email} · {contactInfo.phone}</div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}><FaUser /> {t.passengerNameText}</div>
                    {passengerInfoList.map((pi, idx) => (
                      <div key={idx} style={{ fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: idx < passengerInfoList.length - 1 ? "1px dashed var(--border-main)" : "none", color: "var(--text-main)", lineHeight: 1.6 }}>
                        <b style={{ fontSize: 15 }}>{pi.data.fullName || `${t.passengerNameText} ${idx + 1}`}</b> <span style={{ color: "var(--text-secondary)" }}>({pi.type === 'ADULT' ? t.adult : pi.type === 'CHILD' ? t.child : t.infant})</span>
                        <div style={{ marginTop: 2, color: "var(--text-main)" }}>{t.dobPrefix} <b>{pi.data.dateOfBirth}</b> | {t.genderPrefix} <b>{pi.data.gender === 'Male' ? t.genderMale : pi.data.gender === 'Female' ? t.genderFemale : t.genderOther}</b></div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, color: "var(--text-main)", fontSize: 14 }}>{t.seatPrefix} <b style={{ fontSize: 15, color: "#f97316" }}>{seats.filter(s => selectedSeatIds.includes(s.id)).map(s => s.seatNumber).join(", ") || t.notSelected}</b></div>
                  </div>


                  {selectedServiceIds.length > 0 && (
                    <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)" }}>🛎 {t.extrasLabel}</div>
                      {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6, color: "var(--text-main)", gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{translateServiceName(s, t)}</span>
                          <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{money(Number(s.price || 0))}</b>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ border: "1px dashed var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}><FaTicketAlt style={{ color: "var(--primary)" }} /> {t.promoCodeLabel}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder={t.promoPlaceholder}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--text-main)", fontSize: 14 }} />
                      <button type="button" onClick={() => handleApplyVoucher()} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.applyPromo}</button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.promoInstruction}</div>
                      <SavedVoucherPicker providerId={selectedTrip?.providerId} orderAmount={voucherBaseAmount} onApply={handleApplyVoucher} />
                    </div>
                  </div>


                  {bookingResult ? (
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(34, 197, 94, 0.1)", border: "1px solid #22c55e", marginTop: 8 }}>
                      <div style={{ fontWeight: 800, color: "#22c55e", fontSize: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MdOutlineDone /> {t.successBooking}</div>
                      <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.9 }}>
                        <div>{t.bookingIdPrefix} <b style={{ color: "var(--primary)" }}>#{bookingResult.id}</b></div>
                        <div>{t.totalAmountPrefix} <b style={{ color: "#f97316" }}>{money(Number(bookingResult.totalPrice || 0))}</b></div>
                        <div>{t.seatPrefix} {Array.isArray(bookingResult.seatNumbers) ? bookingResult.seatNumbers.join(", ") : ""}</div>
                      </div>
                      <button type="button"
                        onClick={async () => {
                          try {
                            const res = await axios.post("/api/payment/create", { bookingId: bookingResult.id, language: "vn", returnOrigin: window.location.origin }, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data && res.data.paymentUrl) window.location.href = res.data.paymentUrl;
                          } catch { showToast(t.errVnpayLinkFailed, "error"); }
                        }}
                        style={{ marginTop: 14, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#005baa", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <CiCreditCard1 fontSize={20} /> {t.paymentVNPAY}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                      <button type="button" onClick={() => setStep("extras")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                      <button type="button" onClick={submitBooking} disabled={submitLoading}
                        style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {submitLoading ? t.processing : `${t.bookTicketNow} →`}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.paymentDetails}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                    {(() => {
                      const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                      const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
                      const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
                      const basePrice = Number(selectedTrip.price || 0);
                      const seatsTotal = ecoCount * basePrice + bizCount * basePrice * 2.5;
                      const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-main)", gap: 8 }}>
                            <span>{t.ticketPriceForSeats.replace('{count}', selectedSeatIds.length).replace('{seats}', t.seatUnit)}</span>
                            <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{money(seatsTotal)}</b>
                          </div>
                          {ecoCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {ecoCount}x {t.economy}</span><b style={{ whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>{money((ecoCount * basePrice))}</b></div>}
                          {bizCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {bizCount}x {t.business}</span><b style={{ whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>{money((bizCount * basePrice * 2.5))}</b></div>}

                          {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--text-main)", gap: 10, marginTop: 4 }}>
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {translateServiceName(s, t)}</span>
                              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0) === 0 ? t.free : `${money(Number(s.price || 0))}`}</b>
                            </div>
                          ))}
                          {membershipDiscount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 6, fontWeight: 600, gap: 8 }}>
                              <span>🏅 {t.memberDiscountLabel.replace('{rate}', membershipDiscountPercent)}</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{money(membershipDiscount)}</span>
                            </div>
                          )}
                          {appliedVoucher && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 4, gap: 8 }}>
                              <span>🎟 {t.codePrefix} {appliedVoucher}</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{money(voucherDiscount)}</span>
                            </div>
                          )}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{t.totalLabel}</span>
                            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>{money(Number(bookingResult ? bookingResult.totalPrice || 0 : Math.max(0, seatsTotal + extraTotal - membershipDiscount - voucherDiscount)))}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirlineTickets;