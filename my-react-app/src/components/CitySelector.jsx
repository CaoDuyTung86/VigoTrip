import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { IoClose, IoSearch } from "react-icons/io5";

const CitySelector = ({ isOpen, onClose, onSelect, type }) => {
  const { t, currentLanguage } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const cityTranslations = {
    vi: {
      HAN: { name: "Hà Nội", airport: "Hà Nội (HAN) - Sân bay Nội Bài / Ga Hà Nội" },
      SGN: { name: "TP. Hồ Chí Minh", airport: "TP. HCM (SGN) - Tân Sơn Nhất / Ga Sài Gòn" },
      DAD: { name: "Đà Nẵng", airport: "Đà Nẵng (DAD) - Sân bay Đà Nẵng / Ga Đà Nẵng" },
      CXR: { name: "Nha Trang", airport: "Nha Trang (CXR) - Cam Ranh / Ga Nha Trang" },
      DLI: { name: "Đà Lạt", airport: "Đà Lạt (DLI) - Liên Khương / Ga Đà Lạt" },
      PQC: { name: "Phú Quốc", airport: "Phú Quốc (PQC) - Sân bay Phú Quốc" },
      HUI: { name: "Huế", airport: "Huế (HUI) - Sân bay Phú Bài / Ga Huế" },
      HPH: { name: "Hải Phòng", airport: "Hải Phòng (HPH) - Cát Bi / Ga Hải Phòng" },
      VII: { name: "Vinh", airport: "Vinh (VII) - Sân bay Vinh / Ga Vinh" },
      VCL: { name: "Chu Lai", airport: "Chu Lai (VCL) - Quảng Nam" },
    },
    en: {
      HAN: { name: "Hanoi", airport: "Hanoi (HAN) - Noi Bai Intl / Hanoi Station" },
      SGN: { name: "Ho Chi Minh City", airport: "HCMC (SGN) - Tan Son Nhat Intl / Saigon Station" },
      DAD: { name: "Da Nang", airport: "Da Nang (DAD) - Da Nang Intl / Da Nang Station" },
      CXR: { name: "Nha Trang", airport: "Nha Trang (CXR) - Cam Ranh Intl / Nha Trang Station" },
      DLI: { name: "Da Lat", airport: "Da Lat (DLI) - Lien Khuong Airport / Da Lat Station" },
      PQC: { name: "Phu Quoc", airport: "Phu Quoc (PQC) - Phu Quoc Intl" },
      HUI: { name: "Hue", airport: "Hue (HUI) - Phu Bai Intl / Hue Station" },
      HPH: { name: "Hai Phong", airport: "Hai Phong (HPH) - Cat Bi Intl / Hai Phong Station" },
      VII: { name: "Vinh", airport: "Vinh (VII) - Vinh Airport / Vinh Station" },
      VCL: { name: "Chu Lai", airport: "Chu Lai (VCL) - Quang Nam" },
    },
    ja: {
      HAN: { name: "ハノイ", airport: "ハノイ (HAN) - ノイバイ国際空港 / ハノイ駅" },
      SGN: { name: "ホーチミン", airport: "ホーチミン (SGN) - タンソンニャット国際空港 / サイゴン駅" },
      DAD: { name: "ダナン", airport: "ダナン (DAD) - ダナン国際空港 / ダナン駅" },
      CXR: { name: "ニャチャン", airport: "ニャチャン (CXR) - カムラン国際空港 / ニャチャン駅" },
      DLI: { name: "ダラット", airport: "ダラット (DLI) - リエンクオン空港 / ダラット駅" },
      PQC: { name: "フーコック", airport: "フーコック (PQC) - フーコック国際空港" },
      HUI: { name: "フエ", airport: "フエ (HUI) - フーバイ国際空港 / フエ駅" },
      HPH: { name: "ハイフォン", airport: "ハイフォン (HPH) - カットビ国際空港 / ハイフォン駅" },
      VII: { name: "ヴィン", airport: "ヴィン (VII) - ヴィン空港 / ヴィン駅" },
      VCL: { name: "チュライ", airport: "チュライ (VCL) - クアンナム" },
    },
    zh: {
      HAN: { name: "河內", airport: "河內 (HAN) - 內排國際機場 / 河內火車站" },
      SGN: { name: "胡志明市", airport: "胡志明市 (SGN) - 新山一國際機場 / 西貢火車站" },
      DAD: { name: "峴港", airport: "峴港 (DAD) - 峴港國際機場 / 峴港火車站" },
      CXR: { name: "芽莊", airport: "芽莊 (CXR) - 金蘭國際機場 / 芽莊火車站" },
      DLI: { name: "大叻", airport: "大叻 (DLI) - 蓮姜機場 / 大叻火車站" },
      PQC: { name: "富國島", airport: "富國島 (PQC) - 富國國際機場" },
      HUI: { name: "順化", airport: "順化 (HUI) - 符牌國際機場 / 順化火車站" },
      HPH: { name: "海防", airport: "海防 (HPH) - 吉碑國際機場 / 海防火車站" },
      VII: { name: "榮市", airport: "榮市 (VII) - 榮市機場 / 榮市火車站" },
      VCL: { name: "朱萊", airport: "朱萊 (VCL) - 廣南" },
    }
  };

  const getLocalizedCity = (code) => {
    const lang = currentLanguage?.code || "vi";
    const dict = cityTranslations[lang] || cityTranslations.vi;
    return {
      code,
      name: dict[code]?.name || code,
      airport: dict[code]?.airport || code
    };
  };

  const cities = {
    all: ["HAN", "SGN", "DAD", "CXR", "DLI", "PQC", "HUI", "HPH", "VII", "VCL"].map(getLocalizedCity),
    north: ["HAN", "HPH", "VII"].map(getLocalizedCity),
    central: ["DAD", "HUI", "CXR", "DLI", "VCL"].map(getLocalizedCity),
    south: ["SGN", "PQC"].map(getLocalizedCity),
  };

  const tabs = [
    { id: "all", label: t.allVietnam || "Tất cả Việt Nam" },
    { id: "north", label: t.northVietnam || "Miền Bắc" },
    { id: "central", label: t.centralVietnam || "Miền Trung" },
    { id: "south", label: t.southVietnam || "Miền Nam" },
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