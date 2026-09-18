// @ts-check
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { IoClose, IoSearch } from "react-icons/io5";
import ModalPortal from "./ModalPortal";

const CitySelector = ({ isOpen, onClose, onSelect, type }) => {
  const { t, currentLanguage } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const searchRef = useRef(null);

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
    },
  };

  const getLocalizedCity = (code) => {
    const lang = currentLanguage?.code || "vi";
    const dict = cityTranslations[lang] || cityTranslations.vi;
    return {
      code,
      name: dict[code]?.name || code,
      airport: dict[code]?.airport || code,
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

  // Bỏ dấu trước khi so khớp: gõ "da nang" phải ra "Đà Nẵng", chứ bắt gõ đủ dấu thì
  // hộp tìm kiếm coi như vô dụng với chính người dùng Việt.
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");

  // Đang gõ thì tìm trên TOÀN BỘ danh sách, không giới hạn theo tab đang chọn: người dùng
  // gõ "Huế" khi tab đang ở "Miền Bắc" mà nhận về danh sách rỗng sẽ tưởng là không có.
  const visibleCities = useMemo(() => {
    const term = normalize(searchTerm).trim();
    if (!term) return cities[selectedTab] || [];
    return cities.all.filter(
      (city) =>
        normalize(city.name).includes(term) ||
        normalize(city.code).includes(term) ||
        normalize(city.airport).includes(term),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedTab, currentLanguage?.code]);

  // Mở lại lần sau phải là một hộp sạch, không giữ từ khoá của lần trước.
  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    setSelectedTab("all");
    const id = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  if (!isOpen) return null;

  const heading = searchTerm.trim()
    ? `${t.searchResults} (${visibleCities.length})`
    : tabs.find((tab) => tab.id === selectedTab)?.label;

  const choose = (city) => {
    onSelect(city);
    onClose();
  };

  return (
    <ModalPortal onClose={onClose} zIndex={2000} blur={4} backdrop="rgba(15, 23, 42, 0.55)">
      <div
        style={{
          width: "min(720px, 100%)",
          // Cao tối đa theo màn hình, trừ đúng phần padding 20px x2 của ModalPortal;
          // phần vượt quá do danh sách dài sẽ cuộn bên trong thân hộp.
          maxHeight: "calc(100vh - 40px)",
          background: "var(--bg-card)",
          borderRadius: "20px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Đầu hộp + ô tìm + tab: cố định, chỉ danh sách bên dưới cuộn */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: "16px",
          }}>
            <h3 style={{
              fontSize: "19px",
              fontWeight: 700,
              color: "var(--text-main)",
              margin: 0,
            }}>
              {type === "from" ? t.selectDeparture : t.selectDestination}
            </h3>
            <button
              onClick={onClose}
              aria-label={t.close}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "50%",
                background: "var(--bg-input)",
                border: "1px solid var(--border-main)",
                cursor: "pointer",
                fontSize: "20px",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IoClose />
            </button>
          </div>

          <div style={{ position: "relative", marginBottom: "14px" }}>
            <IoSearch style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }} />
            <input
              ref={searchRef}
              type="text"
              placeholder={t.searchCity}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                // Gõ xong nhấn Enter là chọn luôn kết quả đầu, khỏi phải rời bàn phím.
                if (e.key === "Enter" && visibleCities.length > 0) choose(visibleCities[0]);
              }}
              style={{
                width: "100%",
                padding: "12px 40px 12px 42px",
                border: "1px solid var(--border-input)",
                borderRadius: "12px",
                fontSize: "15px",
                outline: "none",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontFamily: "inherit",
              }}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  searchRef.current?.focus();
                }}
                aria-label={t.clear}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  border: "none",
                  borderRadius: "50%",
                  background: "var(--bg-tag)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                <IoClose />
              </button>
            )}
          </div>

          <div style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--border-light)",
            paddingBottom: "12px",
            flexWrap: "wrap",
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedTab(tab.id);
                  setSearchTerm("");
                }}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  background: selectedTab === tab.id && !searchTerm ? "var(--primary)" : "transparent",
                  color: selectedTab === tab.id && !searchTerm ? "#fff" : "var(--text-secondary)",
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  fontWeight: selectedTab === tab.id && !searchTerm ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          overflowY: "auto",
          overscrollBehavior: "contain",
          flex: 1,
          minHeight: 0, // không có dòng này thì flex item không chịu co lại để cuộn
          padding: "16px 20px 20px",
        }}>
          <h4 style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "var(--text-muted)",
            margin: "0 0 12px",
            textTransform: "uppercase",
          }}>
            {heading}
          </h4>

          {visibleCities.length === 0 ? (
            <div style={{
              padding: "36px 12px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 14,
            }}>
              {t.notFound}
            </div>
          ) : (
            <div style={{
              display: "grid",
              // auto-fit + minmax: màn hẹp tự rơi về 1 cột thay vì ép 2 cột rồi vỡ chữ.
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px",
            }}>
              {visibleCities.map((city) => (
                <button
                  key={city.code}
                  onClick={() => choose(city)}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--border-main)",
                    borderRadius: "12px",
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "border-color 0.2s, background 0.2s",
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
                  <span style={{
                    flexShrink: 0,
                    minWidth: 46,
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "center",
                  }}>
                    {city.code}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "2px",
                      color: "var(--text-main)",
                    }}>
                      {city.name}
                    </span>
                    <span style={{
                      display: "block",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      lineHeight: 1.35,
                    }}>
                      {city.airport}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default CitySelector;
