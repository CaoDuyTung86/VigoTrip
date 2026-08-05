import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { IoClose, IoSearch } from "react-icons/io5";

const CitySelector = ({ isOpen, onClose, onSelect, type }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const cities = {
    all: [
      { code: "HAN", name: "Hà Nội", airport: "Hà Nội (HAN) - Sân bay Nội Bài / Ga Hà Nội" },
      { code: "SGN", name: "TP. Hồ Chí Minh", airport: "TP. HCM (SGN) - Tân Sơn Nhất / Ga Sài Gòn" },
      { code: "DAD", name: "Đà Nẵng", airport: "Đà Nẵng (DAD) - Sân bay Đà Nẵng / Ga Đà Nẵng" },
      { code: "CXR", name: "Nha Trang", airport: "Nha Trang (CXR) - Cam Ranh / Ga Nha Trang" },
      { code: "DLI", name: "Đà Lạt", airport: "Đà Lạt (DLI) - Liên Khương / Ga Đà Lạt" },
      { code: "PQC", name: "Phú Quốc", airport: "Phú Quốc (PQC) - Sân bay Phú Quốc" },
      { code: "HUI", name: "Huế", airport: "Huế (HUI) - Sân bay Phú Bài / Ga Huế" },
      { code: "HPH", name: "Hải Phòng", airport: "Hải Phòng (HPH) - Cát Bi / Ga Hải Phòng" },
      { code: "VII", name: "Vinh", airport: "Vinh (VII) - Sân bay Vinh / Ga Vinh" },
      { code: "VCL", name: "Chu Lai", airport: "Chu Lai (VCL) - Quảng Nam" },
    ],
    north: [
      { code: "HAN", name: "Hà Nội", airport: "Hà Nội (HAN) - Sân bay Nội Bài" },
      { code: "HPH", name: "Hải Phòng", airport: "Hải Phòng (HPH) - Cát Bi" },
      { code: "VII", name: "Vinh", airport: "Vinh (VII) - Sân bay Vinh" },
    ],
    central: [
      { code: "DAD", name: "Đà Nẵng", airport: "Đà Nẵng (DAD) - Sân bay Đà Nẵng" },
      { code: "HUI", name: "Huế", airport: "Huế (HUI) - Sân bay Phú Bài" },
      { code: "CXR", name: "Nha Trang", airport: "Nha Trang (CXR) - Sân bay Cam Ranh" },
      { code: "DLI", name: "Đà Lạt", airport: "Đà Lạt (DLI) - Sân bay Liên Khương" },
      { code: "VCL", name: "Chu Lai", airport: "Chu Lai (VCL) - Quảng Nam" },
    ],
    south: [
      { code: "SGN", name: "TP. Hồ Chí Minh", airport: "TP. HCM (SGN) - Tân Sơn Nhất" },
      { code: "PQC", name: "Phú Quốc", airport: "Phú Quốc (PQC) - Sân bay Phú Quốc" },
    ],
  };

  const tabs = [
    { id: "all", label: "Tất cả Việt Nam" },
    { id: "north", label: "Miền Bắc" },
    { id: "central", label: "Miền Trung" },
    { id: "south", label: "Miền Nam" },
  ];

  const getCityName = (city) => {
    return city.name;
  };

  const filteredCities = (cityList) => {
    if (!searchTerm) return cityList;
    return cityList.filter(city => 
      getCityName(city).toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "700px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          backgroundColor: "var(--bg-card)",
          borderRadius: "16px",
          padding: "24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
       
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-main)" }}>
            {type === "from" ? t.selectDeparture : t.selectDestination}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "24px",
              color: "var(--text-secondary)",
            }}
          >
            <IoClose />
          </button>
        </div>

        
        <div style={{
          position: "relative",
          marginBottom: "20px",
        }}>
          <IoSearch style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }} />
          <input
            type="text"
            placeholder={t.searchCity}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 40px",
              border: "1px solid var(--border-main)",
              borderRadius: "8px",
              fontSize: "15px",
              outline: "none",
              background: "var(--bg-input)",
              color: "var(--text-main)",
            }}
          />
        </div>

        
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: "12px",
          flexWrap: "wrap",
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: selectedTab === tab.id ? "var(--primary)" : "transparent",
                color: selectedTab === tab.id ? "#fff" : "var(--text-secondary)",
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: selectedTab === tab.id ? "600" : "400",
                transition: "all 0.2s",
                flex: "0 1 auto",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        
        <div style={{
          overflowY: "auto",
          flex: 1,
          paddingRight: "8px",
        }}>
         
          {cities[selectedTab] && (
            <div>
              <h4 style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                marginBottom: "12px",
                textTransform: "uppercase",
              }}>
                {tabs.find(t => t.id === selectedTab)?.label || "ĐỊA ĐIỂM VIỆT NAM"}
              </h4>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "8px",
                marginBottom: "16px",
              }}>
                {filteredCities(cities[selectedTab]).map(city => (
                  <button
                    key={city.code}
                    onClick={() => {
                      onSelect(city);
                      onClose();
                    }}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--border-main)",
                      borderRadius: "8px",
                      background: "var(--bg-input)",
                      color: "var(--text-main)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-main)";
                      e.currentTarget.style.background = "var(--bg-input)";
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px", color: "var(--text-main)" }}>
                      {getCityName(city)}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {city.code} {city.airport ? `• ${city.airport}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitySelector;