import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { FaCalendarAlt, FaSearch } from "react-icons/fa";
import { IoIosSwap } from "react-icons/io";
import { IoLocationOutline } from "react-icons/io5";

const VIETNAM_CITIES = [
  { id: "HAN", code: "HAN", name: "Hà Nội" },
  { id: "SGN", code: "SGN", name: "TP. Hồ Chí Minh" },
  { id: "DAD", code: "DAD", name: "Đà Nẵng" },
  { id: "HUE", code: "HUE", name: "Huế" },
  { id: "HPH", code: "HPH", name: "Hải Phòng" },
  { id: "NTR", code: "NTR", name: "Nha Trang" },
  { id: "DLT", code: "DLT", name: "Đà Lạt" },
  { id: "SAP", code: "SAP", name: "Sa Pa" },
  { id: "QNH", code: "QNH", name: "Quảng Ninh" },
  { id: "VIN", code: "VIN", name: "Vinh" },
];

const CITY_NAME_I18N = {
  HAN: { vi: "Hà Nội", en: "Hanoi", ja: "ハノイ", zh: "河內" },
  SGN: { vi: "TP. Hồ Chí Minh", en: "Ho Chi Minh City", ja: "ホーチミン", zh: "胡志明市" },
  DAD: { vi: "Đà Nẵng", en: "Da Nang", ja: "ダナン", zh: "峴港" },
  HUE: { vi: "Huế", en: "Hue", ja: "フエ", zh: "順化" },
  HPH: { vi: "Hải Phòng", en: "Hai Phong", ja: "ハイフォン", zh: "海防" },
  NTR: { vi: "Nha Trang", en: "Nha Trang", ja: "ニャチャン", zh: "芽莊" },
  DLT: { vi: "Đà Lạt", en: "Da Lat", ja: "ダラット", zh: "大叻" },
  SAP: { vi: "Sa Pa", en: "Sa Pa", ja: "サパ", zh: "沙壩" },
  QNH: { vi: "Quảng Ninh", en: "Quang Ninh", ja: "クアンニン", zh: "廣寧" },
  VIN: { vi: "Vinh", en: "Vinh", ja: "ヴィン", zh: "榮市" },
};

const inputBoxStyle = {
  border: "1px solid var(--border-input)",
  borderRadius: "12px",
  padding: "12px",
  background: "var(--bg-input)",
  cursor: "pointer",
};

const BusSearch = () => {
  const { t, currentLanguage } = useLanguage();
  const navigate = useNavigate();

  const localName = (city) =>
    (city && CITY_NAME_I18N[city.id]?.[currentLanguage?.code || "vi"]) || city?.name || "";

  const [fromCity, setFromCity] = useState(null);
  const [toCity, setToCity] = useState(null);
  const todayISO = React.useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);
  const [departDate, setDepartDate] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const handleSearch = () => {
    if (!fromCity) { setSearchError(t.errFromRequired); return; }
    if (!toCity) { setSearchError(t.errToRequired); return; }
    if (fromCity.id === toCity.id) { setSearchError(t.errSameLocations); return; }
    if (!departDate) { setSearchError(t.errDateRequired); return; }
    setSearchError("");

    const params = new URLSearchParams({
      from: fromCity.code || fromCity.name,
      to: toCity.code || toCity.name,
      date: departDate,
      passengers: "1",
    });
    navigate(`/xe-khach?${params.toString()}`);
  };

  const handleSwap = () => {
    const tmp = fromCity;
    setFromCity(toCity);
    setToCity(tmp);
    setFromFilter("");
    setToFilter("");
  };

  const fromOptions = VIETNAM_CITIES.filter(
    (c) => c.id !== toCity?.id && localName(c).toLowerCase().includes(fromFilter.toLowerCase())
  );
  const toOptions = VIETNAM_CITIES.filter(
    (c) => c.id !== fromCity?.id && localName(c).toLowerCase().includes(toFilter.toLowerCase())
  );

  return (
    <div>
      {/* From - Swap - To */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", marginBottom: "16px" }}>

        {/* From */}
        <div style={{ position: "relative" }}>
          <div style={inputBoxStyle} onClick={() => { setShowFromDropdown(v => !v); setShowToDropdown(false); }}>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              {t.from || "Từ"} · {t.departurePoint || "Điểm đi"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoLocationOutline style={{ color: "var(--primary)", fontSize: "18px", flexShrink: 0 }} />
              <span style={{ fontSize: "15px", color: fromCity ? "var(--text-main)" : "var(--text-muted)" }}>
                {fromCity ? localName(fromCity) : (t.selectDeparture || "Chọn điểm đi")}
              </span>
            </div>
          </div>
          {showFromDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid var(--border-light)", padding: "8px", zIndex: 20, marginTop: "4px" }}>
              <input
                autoFocus
                placeholder={t.searchProvince}
                value={fromFilter}
                onChange={(e) => setFromFilter(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-input)", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginBottom: 4, boxSizing: "border-box", outline: "none", background: "var(--bg-input)" }}
              />
              <div>
                {fromOptions.length === 0
                  ? <div style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 13 }}>{t.notFound}</div>
                  : fromOptions.map((city) => (
                    <div key={city.id} onClick={() => { setFromCity(city); setShowFromDropdown(false); setFromFilter(""); }}
                      style={{ padding: "10px 12px", cursor: "pointer", borderRadius: "8px", fontSize: 14 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >{localName(city)}</div>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        {/* Swap */}
        <button onClick={handleSwap} style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: "12px" }}>
          <IoIosSwap style={{ fontSize: "20px", color: "var(--primary)" }} />
        </button>

        {/* To */}
        <div style={{ position: "relative" }}>
          <div style={inputBoxStyle} onClick={() => { setShowToDropdown(v => !v); setShowFromDropdown(false); }}>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              {t.to || "Đến"} · {t.destinationPoint || "Điểm đến"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoLocationOutline style={{ color: "var(--primary)", fontSize: "18px", flexShrink: 0 }} />
              <span style={{ fontSize: "15px", color: toCity ? "var(--text-main)" : "var(--text-muted)" }}>
                {toCity ? localName(toCity) : (t.selectDestination || "Chọn điểm đến")}
              </span>
            </div>
          </div>
          {showToDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid var(--border-light)", padding: "8px", zIndex: 20, marginTop: "4px" }}>
              <input
                autoFocus
                placeholder={t.searchProvince}
                value={toFilter}
                onChange={(e) => setToFilter(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-input)", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginBottom: 4, boxSizing: "border-box", outline: "none", background: "var(--bg-input)" }}
              />
              <div>
                {toOptions.length === 0
                  ? <div style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 13 }}>{t.notFound}</div>
                  : toOptions.map((city) => (
                    <div key={city.id} onClick={() => { setToCity(city); setShowToDropdown(false); setToFilter(""); }}
                      style={{ padding: "10px 12px", cursor: "pointer", borderRadius: "8px", fontSize: 14 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >{localName(city)}</div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date */}
      <div style={{ ...inputBoxStyle, cursor: "default", marginBottom: "16px" }}>
        <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
          {t.departureTime || "Ngày đi"}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "14px" }} />
          <input
            type="date"
            min={todayISO}
            value={departDate}
            onChange={(e) => setDepartDate(e.target.value)}
            style={{ border: "none", background: "transparent", outline: "none", fontSize: "15px", width: "100%", color: "var(--text-main)", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* Error */}
      {searchError && (
        <div style={{ padding: "10px 14px", background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          ⚠️ {searchError}
        </div>
      )}

      {/* Search button */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 14 }}>
        <button
          onClick={handleSearch}
          className="btn-search-glow"
        >
          <FaSearch />
          {t.search || "Tìm kiếm"}
        </button>
      </div>
    </div>
  );
};

export default BusSearch;