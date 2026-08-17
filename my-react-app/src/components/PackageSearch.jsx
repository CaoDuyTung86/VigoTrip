import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { FaCalendarAlt, FaSearch, FaUser, FaHotel } from "react-icons/fa";
import { MdOutlineFlight } from "react-icons/md";
import { IoLocationOutline } from "react-icons/io5";
import { IoTicketSharp } from "react-icons/io5";
import { IoIosAirplane } from "react-icons/io";
import { useToast } from "../context/ToastContext";

const CITY_NAME_I18N = {
  hanoi: { vi: "Hà Nội", en: "Hanoi", ja: "ハノイ", zh: "河內" },
  hcmc: { vi: "TP. Hồ Chí Minh", en: "Ho Chi Minh City", ja: "ホーチミン", zh: "胡志明市" },
  danang: { vi: "Đà Nẵng", en: "Da Nang", ja: "ダナン", zh: "峴港" },
  haiphong: { vi: "Hải Phòng", en: "Hai Phong", ja: "ハイフォン", zh: "海防" },
  cantho: { vi: "Cần Thơ", en: "Can Tho", ja: "カントー", zh: "芹苴" },
  nhatrang: { vi: "Nha Trang", en: "Nha Trang", ja: "ニャチャン", zh: "芽莊" },
  dalat: { vi: "Đà Lạt", en: "Da Lat", ja: "ダラット", zh: "大叻" },
  hue: { vi: "Huế", en: "Hue", ja: "フエ", zh: "順化" },
  quangninh: { vi: "Quảng Ninh", en: "Quang Ninh", ja: "クアンニン", zh: "廣寧" },
  vinh: { vi: "Vinh", en: "Vinh", ja: "ヴィン", zh: "榮市" },
  quynhon: { vi: "Quy Nhơn", en: "Quy Nhon", ja: "クイニョン", zh: "歸仁" },
  bmt: { vi: "Buôn Ma Thuột", en: "Buon Ma Thuot", ja: "バンメートート", zh: "邦美蜀" },
  phuquoc: { vi: "Phú Quốc", en: "Phu Quoc", ja: "フーコック", zh: "富國島" },
  halong: { vi: "Hạ Long", en: "Ha Long", ja: "ハロン", zh: "下龍" },
  sapa: { vi: "Sa Pa", en: "Sa Pa", ja: "サパ", zh: "沙壩" },
};

const PackageSearch = () => {
  const { t, currentLanguage } = useLanguage();

  const localName = (id) => CITY_NAME_I18N[id]?.[currentLanguage?.code || "vi"] || id;
  const [tripType, setTripType] = useState("oneway");

  // State cho combo
  const [from, setFrom] = useState("hcmc");
  const [to, setTo] = useState("hanoi");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // State cho khách sạn
  const [hotelDestination, setHotelDestination] = useState("hanoi");
  const [checkinDate, setCheckinDate] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [nights, setNights] = useState(0);

  // State cho hành khách
  const [rooms, setRooms] = useState({
    adults: 2,
    children: 0,
    rooms: 1
  });
  const [showPassengerModal, setShowPassengerModal] = useState(false);

  // State cho dropdown
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showHotelDropdown, setShowHotelDropdown] = useState(false);

  // Danh sách tỉnh thành Việt Nam
  const vietnamCities = [
    { id: "hanoi", name: "Hà Nội" },
    { id: "hcmc", name: "TP. Hồ Chí Minh" },
    { id: "danang", name: "Đà Nẵng" },
    { id: "haiphong", name: "Hải Phòng" },
    { id: "cantho", name: "Cần Thơ" },
    { id: "nhatrang", name: "Nha Trang" },
    { id: "dalat", name: "Đà Lạt" },
    { id: "hue", name: "Huế" },
    { id: "quangninh", name: "Quảng Ninh" },
    { id: "vinh", name: "Vinh" },
    { id: "quynhon", name: "Quy Nhơn" },
    { id: "bmt", name: "Buôn Ma Thuột" },
    { id: "phuquoc", name: "Phú Quốc" },
    { id: "halong", name: "Hạ Long" },
    { id: "sapa", name: "Sa Pa" },
  ];

  const { showToast } = useToast();

  const tripTypes = [
    { id: "oneway", label: t.oneWay || "Một chiều" },
    { id: "roundtrip", label: `${t.roundTrip || "Khứ hồi"} (${t.underMaintenance || "Đang bảo trì"})`, isMaintenance: true },
  ];

  const handleSearch = () => {
    console.log("Search package:", {
      tripType,
      from,
      to,
      departDate,
      returnDate,
      hotelDestination,
      checkinDate,
      checkoutDate,
      nights,
      rooms
    });
  };

  const handleSwapCities = () => {
    const tempFrom = from;
    const tempTo = to;
    setFrom(tempTo);
    setTo(tempFrom);
  };

  const handleDateChange = (type, value) => {
    if (type === 'depart') {
      setDepartDate(value);
      setCheckinDate(value);
      if (value && checkoutDate) {
        calculateNights(value, checkoutDate);
      }
    } else if (type === 'return') {
      setReturnDate(value);
      setCheckoutDate(value);
      if (departDate && value) {
        calculateNights(departDate, value);
      }
    }
  };

  const calculateNights = (start, end) => {
    const checkin = new Date(start);
    const checkout = new Date(end);
    const diffTime = Math.abs(checkout - checkin);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setNights(diffDays);
  };

  const handleCheckinChange = (value) => {
    setCheckinDate(value);
    if (value && checkoutDate) {
      calculateNights(value, checkoutDate);
    }
  };

  const handleCheckoutChange = (value) => {
    setCheckoutDate(value);
    if (checkinDate && value) {
      calculateNights(checkinDate, value);
    }
  };

  const handleSelectFrom = (city) => {
    setFrom(city.id);
    setShowFromDropdown(false);
  };

  const handleSelectTo = (city) => {
    setTo(city.id);
    setShowToDropdown(false);
  };

  const handleSelectHotel = (city) => {
    setHotelDestination(city.id);
    setShowHotelDropdown(false);
  };

  const getRoomText = () => {
    return `${rooms.adults} ${t.adult || 'Người lớn'} · ${rooms.rooms} ${t.rooms || 'phòng'}`;
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      marginTop: "20px",
    }}>
      {/* Header - Đặt theo gói */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "2px solid #4f7cff",
      }}>
        <IoTicketSharp style={{ fontSize: "28px", color: "var(--primary)" }} />
        <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-main)", margin: 0 }}>
          {t.package || "Đặt theo gói"}
        </h3>
      </div>

      {/* Trip type segmented pill */}
      <div className="trip-type-segmented">
        {tripTypes.map(type => (
          <button
            key={type.id}
            className={`trip-type-btn ${tripType === type.id ? "active" : ""} ${type.isMaintenance ? "maintenance" : ""}`}
            onClick={() => {
              if (type.isMaintenance) {
                const now = Date.now();
                if (!window._lastMaintenanceToast || now - window._lastMaintenanceToast > 3000) {
                  window._lastMaintenanceToast = now;
                  showToast(t.roundTripMaintenanceMsg || "⚠️ Tính năng vé Khứ hồi hiện đang bảo trì & nâng cấp hệ thống. Vui lòng sử dụng vé Một chiều quý khách nhé!", "warning");
                }
                return;
              }
              setTripType(type.id);
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Passenger info - Hành khách */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          padding: "12px 16px",
          background: "var(--bg-input)",
          borderRadius: "12px",
          border: "1px solid var(--border-input)",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => setShowPassengerModal(!showPassengerModal)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaUser style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: "600", color: "var(--text-main)" }}>{getRoomText()}</span>
        </div>
        <span style={{ color: "var(--primary)", fontSize: "13px" }}>▼</span>

        {/* Passenger modal */}
        {showPassengerModal && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--bg-card)",
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
              padding: "16px",
              zIndex: 1000,
              marginTop: "4px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Số phòng */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px"
            }}>
              <span style={{ fontWeight: "500" }}>{t.rooms || "Số phòng"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, rooms: Math.max(1, rooms.rooms - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >-</button>
                <span>{rooms.rooms}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, rooms: rooms.rooms + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >+</button>
              </div>
            </div>

            {/* Người lớn */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px"
            }}>
              <span style={{ fontWeight: "500" }}>{t.adult || "Người lớn"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, adults: Math.max(1, rooms.adults - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >-</button>
                <span>{rooms.adults}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, adults: rooms.adults + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >+</button>
              </div>
            </div>

            {/* Trẻ em */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px"
            }}>
              <span style={{ fontWeight: "500" }}>{t.child || "Trẻ em"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, children: Math.max(0, rooms.children - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >-</button>
                <span>{rooms.children}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRooms({ ...rooms, children: rooms.children + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                  }}
                >+</button>
              </div>
            </div>

            {/* Apply button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPassengerModal(false);
              }}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              {t.apply || "Áp dụng"}
            </button>
          </div>
        )}
      </div>

      {/* Flight Section - Vé máy bay */}
      <div style={{
        background: "var(--bg-main)",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "20px",
      }}>
        <h4 style={{
          fontSize: "15px",
          fontWeight: "600",
          color: "var(--text-main)",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <MdOutlineFlight style={{ color: "var(--primary)" }} />
          {t.flight || "Vé máy bay"}
        </h4>

        {/* From - Từ */}
        <div style={{
          display: "grid",
          gridTemplateColumns: tripType === "roundtrip" ? "1fr auto 1fr" : "1fr",
          gap: "12px",
          marginBottom: "16px",
        }}>
          {/* From */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "10px",
                background: "var(--bg-card)",
                cursor: "pointer",
              }}
              onClick={() => {
                setShowFromDropdown(!showFromDropdown);
                setShowToDropdown(false);
                setShowHotelDropdown(false);
              }}
            >
              <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                {t.from || "Từ"}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <IoLocationOutline style={{ color: "var(--primary)", fontSize: "14px" }} />
                <span style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: "500" }}>{localName(from)}</span>
              </div>
            </div>

            {/* Dropdown From */}
            {showFromDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-card)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  padding: "8px",
                  zIndex: 10,
                  marginTop: "4px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {vietnamCities.map((city) => (
                  <div
                    key={city.id}
                    onClick={() => handleSelectFrom(city)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                    onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                    onMouseLeave={(e) => e.target.style.background = "transparent"}
                  >
                    {localName(city.id)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Swap button */}
          {tripType === "roundtrip" && (
            <button
              onClick={handleSwapCities}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "1px solid #e0e0e0",
                background: "var(--bg-card)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "16px",
              }}
            >
              <IoIosAirplane style={{ fontSize: "18px", color: "var(--primary)", transform: "rotate(0deg)" }} />
            </button>
          )}

          {/* To - Đến */}
          {tripType === "roundtrip" && (
            <div style={{ position: "relative" }}>
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "10px",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setShowToDropdown(!showToDropdown);
                  setShowFromDropdown(false);
                  setShowHotelDropdown(false);
                }}
              >
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                  {t.to || "Đến"}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <IoLocationOutline style={{ color: "var(--primary)", fontSize: "14px" }} />
                  <span style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: "500" }}>{localName(to)}</span>
                </div>
              </div>

              {/* Dropdown To */}
              {showToDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "var(--bg-card)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    padding: "8px",
                    zIndex: 10,
                    marginTop: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {vietnamCities.map((city) => (
                    <div
                      key={city.id}
                      onClick={() => handleSelectTo(city)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                      onMouseLeave={(e) => e.target.style.background = "transparent"}
                    >
                      {localName(city.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dates - Ngày đi / Ngày về */}
        <div style={{
          display: "grid",
          gridTemplateColumns: tripType === "roundtrip" ? "1fr 1fr" : "1fr",
          gap: "12px",
        }}>
          {/* Depart date - Chiều đi */}
          <div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "10px",
            background: "var(--bg-card)",
          }}>
            <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
              {t.departureDate || "Chiều đi"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "12px" }} />
              <input
                type="date"
                value={departDate}
                onChange={(e) => handleDateChange('depart', e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "13px",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Return date - Chiều về */}
          {tripType === "roundtrip" && (
            <div style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "10px",
              background: "var(--bg-card)",
            }}>
              <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                {t.returnDate || "Chiều về"}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "12px" }} />
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => handleDateChange('return', e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "13px",
                    width: "100%",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hotel Section - Khách sạn */}
      <div style={{
        background: "var(--bg-main)",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "20px",
      }}>
        <h4 style={{
          fontSize: "15px",
          fontWeight: "600",
          color: "var(--text-main)",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <FaHotel style={{ color: "var(--primary)" }} />
          {t.hotel || "Khách sạn"}
        </h4>

        {/* Hotel Destination - Điểm đến */}
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "10px",
              background: "var(--bg-card)",
              cursor: "pointer",
            }}
            onClick={() => {
              setShowHotelDropdown(!showHotelDropdown);
              setShowFromDropdown(false);
              setShowToDropdown(false);
            }}
          >
            <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
              {t.destination || "Điểm đến"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoLocationOutline style={{ color: "var(--primary)", fontSize: "14px" }} />
              <span style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: "500" }}>{localName(hotelDestination)}</span>
            </div>
          </div>

          {/* Dropdown Hotel */}
          {showHotelDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-card)",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                padding: "8px",
                zIndex: 10,
                marginTop: "4px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {vietnamCities.map((city) => (
                <div
                  key={city.id}
                  onClick={() => handleSelectHotel(city)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                  onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  {localName(city.id)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Check-in / Check-out */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "8px",
          alignItems: "center",
        }}>
          {/* Check-in - Nhận phòng */}
          <div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "10px",
            background: "var(--bg-card)",
          }}>
            <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
              {t.checkin || "Nhận phòng"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "12px" }} />
              <input
                type="date"
                value={checkinDate}
                onChange={(e) => handleCheckinChange(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "13px",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Nights - Số đêm */}
          <div style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--primary)",
            textAlign: "center",
            minWidth: "60px",
          }}>
            {nights > 0 ? `${nights} ${t.nights || "đêm"}` : "-"}
          </div>

          {/* Check-out - Trả phòng */}
          <div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "10px",
            background: "var(--bg-card)",
          }}>
            <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
              {t.checkout || "Trả phòng"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "12px" }} />
              <input
                type="date"
                value={checkoutDate}
                onChange={(e) => handleCheckoutChange(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "13px",
                  width: "100%",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search button - Tìm kiếm */}
      <button
        onClick={handleSearch}
        className="btn-search-glow"
        style={{ width: "100%", borderRadius: "14px", padding: "14px" }}
      >
        <FaSearch />
        {t.search || "Tìm kiếm"}
      </button>
    </div>
  );
};

export default PackageSearch;