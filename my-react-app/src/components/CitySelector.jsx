import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { IoClose, IoSearch } from "react-icons/io5";

const CitySelector = ({ isOpen, onClose, onSelect, type }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const cities = {
    all: [
      { code: "HAN", name: "Hà Nội", airport: "Sân bay Nội Bài / Ga Hà Nội / Bến xe Mỹ Đình" },
      { code: "SGN", name: "TP. Hồ Chí Minh", airport: "Sân bay Tân Sơn Nhất / Ga Sài Gòn / Bến xe Miền Đông" },
      { code: "DAD", name: "Đà Nẵng", airport: "Sân bay Đà Nẵng / Ga Đà Nẵng" },
      { code: "CXR", name: "Nha Trang (Cam Ranh)", airport: "Sân bay Cam Ranh / Ga Nha Trang" },
      { code: "PQC", name: "Phú Quốc", airport: "Sân bay Phú Quốc" },
      { code: "HUI", name: "Huế", airport: "Sân bay Phú Bài / Ga Huế" },
      { code: "DLI", name: "Đà Lạt", airport: "Sân bay Liên Khương / Bến xe Đà Lạt" },
      { code: "VCA", name: "Cần Thơ", airport: "Sân bay Cần Thơ / Bến xe Cần Thơ" },
      { code: "HPH", name: "Hải Phòng", airport: "Sân bay Cát Bi / Ga Hải Phòng" },
      { code: "VII", name: "Vinh", airport: "Sân bay Vinh / Ga Vinh" },
      { code: "SAP", name: "Sa Pa", airport: "Bến xe Sa Pa / Ga Lào Cai" },
      { code: "QNH", name: "Quy Nhơn", airport: "Sân bay Phù Cát / Bến xe Quy Nhơn" },
    ],
    north: [
      { code: "HAN", name: "Hà Nội", airport: "Sân bay Nội Bài / Ga Hà Nội / Bến xe Mỹ Đình" },
      { code: "HPH", name: "Hải Phòng", airport: "Sân bay Cát Bi / Ga Hải Phòng" },
      { code: "SAP", name: "Sa Pa (Lào Cai)", airport: "Bến xe Sa Pa / Ga Lào Cai" },
      { code: "VII", name: "Vinh (Nghệ An)", airport: "Sân bay Vinh / Ga Vinh" },
      { code: "VDO", name: "Vân Đồn (Quảng Ninh)", airport: "Sân bay Vân Đồn" },
    ],
    central: [
      { code: "DAD", name: "Đà Nẵng", airport: "Sân bay Đà Nẵng / Ga Đà Nẵng" },
      { code: "HUI", name: "Thừa Thiên Huế", airport: "Sân bay Phú Bài / Ga Huế" },
      { code: "CXR", name: "Nha Trang (Khánh Hòa)", airport: "Sân bay Cam Ranh / Ga Nha Trang" },
      { code: "QNH", name: "Quy Nhơn (Bình Định)", airport: "Sân bay Phù Cát" },
      { code: "DLI", name: "Đà Lạt (Lâm Đồng)", airport: "Sân bay Liên Khương / Bến xe Đà Lạt" },
    ],
    south: [
      { code: "SGN", name: "TP. Hồ Chí Minh", airport: "Sân bay Tân Sơn Nhất / Ga Sài Gòn" },
      { code: "PQC", name: "Phú Quốc (Kiên Giang)", airport: "Sân bay Phú Quốc" },
      { code: "VCA", name: "Cần Thơ", airport: "Sân bay Cần Thơ" },
      { code: "VKG", name: "Rạch Giá (Kiên Giang)", airport: "Sân bay Rạch Giá" },
      { code: "VCS", name: "Côn Đảo (Bà Rịa - Vũng Tàu)", airport: "Sân bay Côn Đảo" },
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
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "15px",
              outline: "none",
            }}
          />
        </div>

        
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          borderBottom: "1px solid #e0e0e0",
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
                background: selectedTab === tab.id ? "#4f7cff" : "transparent",
                color: selectedTab === tab.id ? "#fff" : "#666",
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
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      background: "var(--bg-card)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "#4f7cff";
                      e.target.style.boxShadow = "0 2px 8px rgba(79,124,255,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>
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