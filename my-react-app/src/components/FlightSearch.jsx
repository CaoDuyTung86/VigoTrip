import React, { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { IoIosSwap } from "react-icons/io";
import { FaCalendarAlt, FaUser, FaSearch, FaPlus, FaPlane } from "react-icons/fa";
import { MdFlightTakeoff, MdFlightLand } from "react-icons/md";
import CitySelector from "./CitySelector";
import { useNavigate } from "react-router-dom";

const FlightSearch = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tripType, setTripType] = useState("roundtrip");

  // State cho roundtrip và oneway
  const [from, setFrom] = useState("");
  const [fromCity, setFromCity] = useState(null);
  const [to, setTo] = useState("");
  const [toCity, setToCity] = useState(null);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // State cho multi-city
  const [multiCityFlights, setMultiCityFlights] = useState([
    { id: 1, from: "", fromCity: null, to: "", toCity: null, departDate: "" },
    { id: 2, from: "", fromCity: null, to: "", toCity: null, departDate: "" },
    { id: 3, from: "", fromCity: null, to: "", toCity: null, departDate: "" },
  ]);

  const [passengers, setPassengers] = useState({
    adult: 1,
    child: 0,
    infant: 0,
    class: "economy"
  });
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySelectorType, setCitySelectorType] = useState(null);
  const [currentFlightId, setCurrentFlightId] = useState(null);
  const [searchError, setSearchError] = useState("");

  const todayISO = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);

  const totalPassengers = useMemo(
    () => passengers.adult + passengers.child + passengers.infant,
    [passengers],
  );

  const tripTypes = [
    { id: "oneway", label: t.oneWay },
    { id: "roundtrip", label: t.roundTrip },
  ];

  const handleSearch = () => {
    if (tripType === "multi") return;

    if (!fromCity) { setSearchError("Vui lòng chọn điểm đi."); return; }
    if (!toCity) { setSearchError("Vui lòng chọn điểm đến."); return; }
    if (fromCity.code === toCity.code) { setSearchError("Điểm đi và điểm đến không được trùng nhau."); return; }
    if (!departDate) { setSearchError("Vui lòng chọn ngày đi."); return; }
    setSearchError("");

    const params = new URLSearchParams({
      from: fromCity.code,
      to: toCity.code,
      date: departDate,
      passengers: String(totalPassengers || 1),
    });
    if (tripType === "roundtrip" && returnDate) params.set("returnDate", returnDate);

    navigate(`/ve-may-bay?${params.toString()}`);
  };

  const handleCitySelect = (city) => {
    if (tripType === "multi") {
      // Xử lý cho multi-city
      setMultiCityFlights(prev => prev.map(flight => {
        if (flight.id === currentFlightId) {
          if (citySelectorType === 'from') {
            return { ...flight, from: getCityName(city), fromCity: city };
          } else if (citySelectorType === 'to') {
            return { ...flight, to: getCityName(city), toCity: city };
          }
        }
        return flight;
      }));
    } else {
      // Xử lý cho roundtrip và oneway
      if (citySelectorType === 'from') {
        setFromCity(city);
        setFrom(getCityName(city));
      } else if (citySelectorType === 'to') {
        setToCity(city);
        setTo(getCityName(city));
      }
    }
  };

  const getCityName = (city) => {
    if (!city) return "";
    return city.name; // City.name đã được đa ngôn ngữ từ CitySelector
  };

  const handleSwapCities = () => {
    if (tripType === "multi") {
      // Xử lý swap cho multi-city (cần flightId)
    } else {
      // Xử lý swap cho roundtrip và oneway
      const tempFrom = from;
      const tempFromCity = fromCity;
      setFrom(to);
      setFromCity(toCity);
      setTo(tempFrom);
      setToCity(tempFromCity);
    }
  };

  const handleSwapMultiCity = (flightId) => {
    setMultiCityFlights(prev => prev.map(flight => {
      if (flight.id === flightId) {
        const tempFrom = flight.from;
        const tempFromCity = flight.fromCity;
        return {
          ...flight,
          from: flight.to,
          fromCity: flight.toCity,
          to: tempFrom,
          toCity: tempFromCity
        };
      }
      return flight;
    }));
  };

  const addNewFlight = () => {
    const newId = Math.max(...multiCityFlights.map(f => f.id), 0) + 1;
    setMultiCityFlights([...multiCityFlights, {
      id: newId,
      from: "",
      fromCity: null,
      to: "",
      toCity: null,
      departDate: ""
    }]);
  };

  const removeFlight = (flightId) => {
    if (multiCityFlights.length > 1) {
      setMultiCityFlights(multiCityFlights.filter(f => f.id !== flightId));
    }
  };

  const getPassengerText = () => {
    const total = passengers.adult + passengers.child + passengers.infant;
    return `${total} ${t.passengers}`;
  };

  // Render cho multi-city
  const renderMultiCity = () => {
    return (
      <div>
        {multiCityFlights.map((flight, index) => (
          <div key={flight.id} style={{
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "16px",
            background: "var(--bg-card)",
            position: "relative",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "12px",
            }}>
              <span style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "var(--primary)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "600",
                marginRight: "8px",
              }}>
                {index + 1}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
                {t.flight} {index + 1}
              </span>

              {/* Nút xóa */}
              {multiCityFlights.length > 1 && (
                <button
                  onClick={() => removeFlight(flight.id)}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "20px",
                    fontWeight: "500",
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* From - To */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: "8px",
              marginBottom: "12px",
            }}>
              {/* From */}
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "10px",
                  background: "var(--bg-main)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setCitySelectorType('from');
                  setCurrentFlightId(flight.id);
                  setShowCitySelector(true);
                }}
              >
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                  {t.from}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MdFlightTakeoff style={{ color: "var(--primary)", fontSize: "14px" }} />
                  <span style={{
                    fontSize: "13px",
                    color: flight.from ? "#333" : "#999",
                  }}>
                    {flight.from || t.selectDeparture}
                  </span>
                </div>
              </div>

              {/* Swap button */}
              <button
                onClick={() => handleSwapMultiCity(flight.id)}
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
                <IoIosSwap style={{ fontSize: "16px", color: "var(--primary)" }} />
              </button>

              {/* To */}
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "10px",
                  background: "var(--bg-main)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setCitySelectorType('to');
                  setCurrentFlightId(flight.id);
                  setShowCitySelector(true);
                }}
              >
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                  {t.to}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MdFlightLand style={{ color: "var(--primary)", fontSize: "14px" }} />
                  <span style={{
                    fontSize: "13px",
                    color: flight.to ? "#333" : "#999",
                  }}>
                    {flight.to || t.selectDestination}
                  </span>
                </div>
              </div>
            </div>

            {/* Depart date */}
            <div style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "10px",
              background: "var(--bg-main)",
            }}>
              <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                {t.departureDate}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "12px" }} />
                <input
                  type="date"
                  value={flight.departDate}
                  min={todayISO}
                  onChange={(e) => {
                    setMultiCityFlights(prev => prev.map(f =>
                      f.id === flight.id ? { ...f, departDate: e.target.value } : f
                    ));
                  }}
                  placeholder="Chọn ngày"
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "13px",
                    width: "100%",
                    color: flight.departDate ? "#333" : "#999",
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Nút thêm chuyến bay */}
        <button
          onClick={addNewFlight}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            background: "none",
            border: "2px dashed #4f7cff",
            borderRadius: "8px",
            color: "var(--primary)",
            cursor: "pointer",
            width: "100%",
            fontSize: "14px",
            fontWeight: "500",
            marginBottom: "20px",
          }}
        >
          <FaPlus />
          {t.addFlight || "Thêm chuyến bay khác"}
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Trip type tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "24px",
        borderBottom: "1px solid #e0e0e0",
        paddingBottom: "12px",
      }}>
        {tripTypes.map(type => (
          <button
            key={type.id}
            onClick={() => setTripType(type.id)}
            style={{
              padding: "8px 18px",
              border: "none",
              background: tripType === type.id ? "var(--primary)" : "transparent",
              color: tripType === type.id ? "#fff" : "var(--text-secondary)",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: tripType === type.id ? "600" : "500",
              transition: "all 0.2s",
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Direct flight checkbox - đã bỏ: không có dữ liệu backend hỗ trợ */}

      {/* Nội dung theo loại chuyến đi */}
      {tripType === "multi" ? (
        renderMultiCity()
      ) : (
        <>
          {/* From - To cho roundtrip và oneway */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}>
            {/* From */}
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
                {t.from}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MdFlightTakeoff style={{ color: "var(--primary)", fontSize: "18px" }} />
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

            {/* Swap button */}
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

            {/* To */}
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
                {t.to}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MdFlightLand style={{ color: "var(--primary)", fontSize: "18px" }} />
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
                  value={departDate}
                  min={todayISO}
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
                    value={returnDate}
                    min={departDate || todayISO}
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
        </>
      )}

      {/* Passengers - Chung cho tất cả loại chuyến đi */}
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
          <FaUser style={{ color: "var(--primary)", fontSize: "14px" }} />
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
                    setPassengers({ ...passengers, adult: Math.max(1, passengers.adult - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >-</button>
                <span style={{ minWidth: "20px", textAlign: "center" }}>{passengers.adult}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({ ...passengers, adult: passengers.adult + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                    setPassengers({ ...passengers, child: Math.max(0, passengers.child - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >-</button>
                <span style={{ minWidth: "20px", textAlign: "center" }}>{passengers.child}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({ ...passengers, child: passengers.child + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                    setPassengers({ ...passengers, infant: Math.max(0, passengers.infant - 1) });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >-</button>
                <span style={{ minWidth: "20px", textAlign: "center" }}>{passengers.infant}</span>
                <button disabled={passengers.adult + passengers.child + passengers.infant >= 5}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPassengers({ ...passengers, infant: passengers.infant + 1 });
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1px solid #4f7cff",
                    background: "var(--bg-card)",
                    color: "var(--primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                padding: "12px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                marginTop: "16px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              {t.apply}
            </button>
          </div>
        )}
      </div>

      {/* Validation error */}
      {searchError && (
        <div style={{
          padding: "10px 14px",
          background: "#fff0f0",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          color: "#dc2626",
          fontSize: 13,
          marginBottom: 16,
        }}>
          ⚠️ {searchError}
        </div>
      )}

      {/* Search button */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
        <button
          onClick={handleSearch}
          style={{
            padding: "12px 36px",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: "30px",
            fontSize: "15px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background 0.2s",
            fontFamily: "inherit",
          }}
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

export default FlightSearch;