import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { FaCalendarAlt, FaSearch, FaBus } from "react-icons/fa";
import { IoIosSwap } from "react-icons/io";
import { IoLocationOutline } from "react-icons/io5";

const BusSearch = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);


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

  const handleSearch = () => {
    if (!from || !to || !departDate) {
      return;
    }

    const params = new URLSearchParams({
      from,
      to,
      date: departDate,
      passengers: "1",
    });

    navigate(`/xe-khach?${params.toString()}`);
  };

  const handleSwapCities = () => {
    const tempFrom = from;
    const tempTo = to;
    setFrom(tempTo);
    setTo(tempFrom);
  };

  const handleSelectFrom = (city) => {
    setFrom(city.name);
    setShowFromDropdown(false);
  };

  const handleSelectTo = (city) => {
    setTo(city.name);
    setShowToDropdown(false);
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      marginTop: "20px",
    }}>
     
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "2px solid #4f7cff",
      }}>
        <FaBus style={{ fontSize: "28px", color: "var(--primary)" }} />
        <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-main)", margin: 0 }}>
          {t.bus || "Xe khách"}
        </h3>
      </div>

  
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "12px",
        marginBottom: "16px",
      }}>
   
        <div style={{
          position: "relative",
        }}>
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              padding: "12px",
              background: "var(--bg-main)",
              cursor: "pointer",
            }}
            onClick={() => {
              setShowFromDropdown(!showFromDropdown);
              setShowToDropdown(false);
            }}
          >
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              {t.from || "Từ"} · {t.departurePoint || "Điểm đi"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoLocationOutline style={{ color: "var(--primary)", fontSize: "18px" }} />
              <span style={{ 
                fontSize: "15px", 
                color: from ? "#333" : "#999",
                flex: 1,
              }}>
                {from || (t.selectDeparture || "Chọn điểm đi")}
              </span>
            </div>
          </div>

       
          {showFromDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-card)",
                borderRadius: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                padding: "8px",
                zIndex: 10,
                marginTop: "4px",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {vietnamCities.map((city) => (
                <div
                  key={city.id}
                  onClick={() => handleSelectFrom(city)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  {city.name}
                </div>
              ))}
            </div>
          )}
        </div>

    
        <button 
          onClick={handleSwapCities}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "1px solid #e0e0e0",
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


        <div style={{
          position: "relative",
        }}>
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              padding: "12px",
              background: "var(--bg-main)",
              cursor: "pointer",
            }}
            onClick={() => {
              setShowToDropdown(!showToDropdown);
              setShowFromDropdown(false);
            }}
          >
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              {t.to || "Đến"} · {t.destinationPoint || "Điểm đến"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoLocationOutline style={{ color: "var(--primary)", fontSize: "18px" }} />
              <span style={{ 
                fontSize: "15px", 
                color: to ? "#333" : "#999",
                flex: 1,
              }}>
                {to || (t.selectDestination || "Chọn điểm đến")}
              </span>
            </div>
          </div>

   
          {showToDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-card)",
                borderRadius: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                padding: "8px",
                zIndex: 10,
                marginTop: "4px",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {vietnamCities.map((city) => (
                <div
                  key={city.id}
                  onClick={() => handleSelectTo(city)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  {city.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      <div style={{
        border: "1px solid #e0e0e0",
        borderRadius: "12px",
        padding: "12px",
        background: "var(--bg-main)",
        marginBottom: "20px",
      }}>
        <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
          {t.departureTime || "Ngày đi"}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCalendarAlt style={{ color: "var(--primary)", fontSize: "14px" }} />
          <input
            type="date"
            value={departDate}
            onChange={(e) => setDepartDate(e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "15px",
              width: "100%",
            }}
          />
        </div>
      </div>


      <button
        onClick={handleSearch}
        style={{
          width: "100%",
          padding: "14px",
          background: "var(--primary)",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.target.style.background = "var(--primary-hover)"}
        onMouseLeave={(e) => e.target.style.background = "var(--primary)"}
      >
        <FaSearch />
        {t.search || "Tìm kiếm"}
      </button>
    </div>
  );
};

export default BusSearch;