import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { FaCalendarAlt, FaSearch, FaTrain } from "react-icons/fa";
import { IoIosSwap } from "react-icons/io";
import CitySelector from "./CitySelector";

const TrainSearch = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [tripType, setTripType] = useState("oneway");
  
  
  const [from, setFrom] = useState("");
  const [fromCity, setFromCity] = useState(null);
  const [to, setTo] = useState("");
  const [toCity, setToCity] = useState(null);
  
  const todayISO = React.useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState({
    adult: 1,
    child: 0,
    infant: 0,
    class: "all"
  });
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  

  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySelectorType, setCitySelectorType] = useState(null);
  const [searchError, setSearchError] = useState("");

  const tripTypes = [
    { id: "oneway", label: t.oneWay },
    { id: "roundtrip", label: `${t.roundTrip} (Đang bảo trì)`, isMaintenance: true },
  ];

  const trainClasses = [
    { id: "all", label: t.all || "Tất cả" },
    { id: "economy", label: t.economy },
    { id: "business", label: t.business },
    { id: "vip", label: t.vip || "VIP" },
  ];

  const handleSearch = () => {
    if (!fromCity) { setSearchError("Vui lòng chọn ga khởi hành."); return; }
    if (!toCity) { setSearchError("Vui lòng chọn ga đến."); return; }
    if ((fromCity.code || fromCity.name) === (toCity.code || toCity.name)) { setSearchError("Ga đi và ga đến không được trùng nhau."); return; }
    if (!departDate) { setSearchError("Vui lòng chọn ngày đi."); return; }
    setSearchError("");

    const totalPassengers = passengers.adult + passengers.child + passengers.infant;

    const params = new URLSearchParams({
      from: fromCity.code || fromCity.name,
      to: toCity.code || toCity.name,
      date: departDate,
      passengers: String(totalPassengers || 1),
    });

    navigate(`/ve-tau-hoa?${params.toString()}`);
  };

  const handleCitySelect = (city) => {
    if (citySelectorType === 'from') {
      setFromCity(city);
      setFrom(city.name);
    } else if (citySelectorType === 'to') {
      setToCity(city);
      setTo(city.name);
    }
  };

  const handleSwapCities = () => {
    const tempFrom = from;
    const tempFromCity = fromCity;
    setFrom(to);
    setFromCity(toCity);
    setTo(tempFrom);
    setToCity(tempFromCity);
  };

  const getPassengerText = () => {
    const total = passengers.adult + passengers.child + passengers.infant;
    return `${total} ${t.passengers}`;
  };

  return (
    <div>
      {/* Trip type tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "20px",
      }}>
        {tripTypes.map(type => (
          <button
            key={type.id}
            onClick={() => {
              if (type.isMaintenance) {
                alert("⚠️ Tính năng vé Khứ hồi hiện đang bảo trì & nâng cấp hệ thống. Vui lòng sử dụng vé Một chiều quý khách nhé!");
                return;
              }
              setTripType(type.id);
            }}
            style={{
              padding: "8px 18px",
              border: "none",
              background: tripType === type.id ? "var(--primary)" : "transparent",
              color: tripType === type.id ? "#fff" : type.isMaintenance ? "#94a3b8" : "var(--text-secondary)",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: tripType === type.id ? "600" : "500",
              transition: "all 0.2s",
              opacity: type.isMaintenance ? 0.75 : 1,
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "12px",
        marginBottom: "16px",
      }}>
 
        <div 
          style={{
            border: "1px solid var(--border-input)",
            borderRadius: "12px",
            padding: "12px",
            background: "var(--bg-input)",
            cursor: "pointer",
          }}
          onClick={() => {
            setCitySelectorType('from');
            setShowCitySelector(true);
          }}
        >
          <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", fontWeight: "500" }}>
            {t.from} · {t.departureStation || "Ga khởi hành"}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaTrain style={{ color: "var(--primary)", fontSize: "16px" }} />
            <span style={{ 
              fontSize: "15px", 
              fontWeight: "600",
              color: from ? "var(--text-main)" : "var(--text-muted)",
              flex: 1,
            }}>
              {from || t.selectDeparture}
            </span>
          </div>
        </div>

      
        <button 
          onClick={handleSwapCities}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "1px solid var(--border-input)",
            background: "var(--bg-card)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "20px",
          }}
        >
          <IoIosSwap style={{ fontSize: "20px", color: "var(--primary)" }} />
        </button>

       
        <div 
          style={{
            border: "1px solid var(--border-input)",
            borderRadius: "12px",
            padding: "12px",
            background: "var(--bg-input)",
            cursor: "pointer",
          }}
          onClick={() => {
            setCitySelectorType('to');
            setShowCitySelector(true);
          }}
        >
          <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", fontWeight: "500" }}>
            {t.to} · {t.arrivalStation || "Ga đến"}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaTrain style={{ color: "var(--primary)", fontSize: "16px", }} />
            <span style={{ 
              fontSize: "15px", 
              fontWeight: "600",
              color: to ? "var(--text-main)" : "var(--text-muted)",
              flex: 1,
            }}>
              {to || t.selectDestination}
            </span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div style={{
        display: "grid",
        gridTemplateColumns: tripType === "roundtrip" ? "1fr 1fr" : "1fr",
        gap: "12px",
        marginBottom: "16px",
      }}>
        {/* Depart date */}
        <div style={{
          border: "1px solid var(--border-input)",
          borderRadius: "12px",
          padding: "12px",
          background: "var(--bg-input)",
        }}>
          <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", fontWeight: "500" }}>
            {t.departureDate}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "15px" }} />
            <input
              type="date"
              min={todayISO}
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "15px",
                width: "100%",
                color: "var(--text-main)",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Return date - only for roundtrip */}
        {tripType === "roundtrip" && (
          <div style={{
            border: "1px solid var(--border-input)",
            borderRadius: "12px",
            padding: "12px",
            background: "var(--bg-input)",
          }}>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", fontWeight: "500" }}>
              {t.returnDate}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "15px" }} />
              <input
                type="date"
                min={departDate || todayISO}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "15px",
                  width: "100%",
                  color: "var(--text-main)",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* "Chỉ tàu cao tốc" - ẩn: không có dữ liệu backend hỗ trợ */}

      {/* Passengers */}
      <div style={{
        border: "1px solid var(--border-input)",
        borderRadius: "12px",
        padding: "12px",
        background: "var(--bg-input)",
        marginBottom: "20px",
        position: "relative",
        cursor: "pointer",
      }}
      onClick={() => setShowPassengerModal(!showPassengerModal)}
      >
        <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
          {t.passengers}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTrain style={{ color: "var(--primary)", fontSize: "14px" }} />
          <span style={{ fontSize: "15px", color: "var(--text-main)" }}>
            {getPassengerText()}
          </span>
        </div>

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
            {/* Adults */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "12px" 
            }}>
              <span style={{ fontWeight: "500" }}>{t.adultAge}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, adult: Math.max(1, passengers.adult - 1)});
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
                <span>{passengers.adult}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, adult: passengers.adult + 1});
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

            {/* Children */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "12px" 
            }}>
              <span style={{ fontWeight: "500" }}>{t.childAge}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, child: Math.max(0, passengers.child - 1)});
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
                <span>{passengers.child}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, child: passengers.child + 1});
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

            {/* Infants */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "16px" 
            }}>
              <span style={{ fontWeight: "500" }}>{t.infantAge}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, infant: Math.max(0, passengers.infant - 1)});
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
                <span>{passengers.infant}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({...passengers, infant: passengers.infant + 1});
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

            {/* Class */}
            <div>
              <label style={{ 
                fontSize: "14px", 
                fontWeight: "500", 
                display: "block", 
                marginBottom: "8px" 
              }}>
                {t.class}
              </label>
              <select
                value={passengers.class}
                onChange={(e) => setPassengers({...passengers, class: e.target.value})}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  outline: "none",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                {trainClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.label}</option>
                ))}
              </select>
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
                marginTop: "16px",
              }}
            >
              {t.apply}
            </button>
          </div>
        )}
      </div>

      {/* Validation error */}
      {searchError && (
        <div style={{ padding: "10px 14px", background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          ⚠️ {searchError}
        </div>
      )}

      {/* Search button */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
        <button
          onClick={handleSearch}
          style={{ padding: "12px 36px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "30px", fontSize: "15px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background 0.2s", fontFamily: "inherit" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "var(--primary)"}
        >
          <FaSearch />
          {t.search}
        </button>
      </div>

      {/* City Selector Modal */}
      <CitySelector
        isOpen={showCitySelector}
        onClose={() => setShowCitySelector(false)}
        onSelect={handleCitySelect}
        type={citySelectorType}
      />
    </div>
  );
};

export default TrainSearch;