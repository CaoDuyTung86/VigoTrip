import React, { useState } from "react";
import { FaRegUser, FaSignOutAlt, FaHistory, FaQrcode } from "react-icons/fa";
import { IoIosPhonePortrait } from "react-icons/io";
import { MdOutlinePhone } from "react-icons/md";
import { IoChevronDown } from "react-icons/io5";
import Auth from "../Page/Auth";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AiOutlineGlobal } from "react-icons/ai";
import { MdOutlineLightMode, MdOutlineDarkMode, MdMenu, MdQrCodeScanner } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import VNFlag from "../Picture/flags/vn.png";
import UKFlag from "../Picture/flags/uk.png";
import JPFlag from "../Picture/flags/jp.png";
import TWFlag from "../Picture/flags/tw.png";

const Header = ({ setIsSidebarOpen }) => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const { currentLanguage, t, changeLanguage } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const languages = [
    { code: 'vi', name: 'Tiếng Việt', flag: VNFlag },
    { code: 'en', name: 'English', flag: UKFlag },
    { code: 'ja', name: '日本語', flag: JPFlag },
    { code: 'zh', name: '繁體中文', flag: TWFlag },
  ];

  const phoneNumbers = {
    vi: "0977.999999",
    en: "+84 13 1234 5678",
    ja: "+84 58 1234 5678",
    zh: "+84 43 1234 5678"
  };


  const handleLogoClick = () => {
    navigate("/");
  };

  React.useEffect(() => {
    const langWithFlag = languages.find(lang => lang.code === currentLanguage.code);
    if (langWithFlag && currentLanguage.flag !== langWithFlag.flag) {
      currentLanguage.flag = langWithFlag.flag;
    }
  }, [currentLanguage.code]);

  const handleLanguageSelect = (language) => {
    changeLanguage(language);
    setIsLanguageOpen(false);
  };

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.language-selector') && !event.target.closest('.cskh-container')) {
        setIsLanguageOpen(false);
        setShowPhone(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <header
        className="app-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "var(--header-height)",
          minHeight: "70px",
          background: "var(--bg-header)",
          boxShadow: "var(--shadow-sm)",
          zIndex: 1000,
          color: "var(--text-main)",
          transition: "background-color 0.3s, box-shadow 0.3s",
        }}
      >
        <div className="app-header-left">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            style={{
              fontSize: "22px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-main)",
            }}
          >
            ☰
          </button>
          <h2
            onClick={handleLogoClick}
            style={{
              margin: 0,
              color: "#20c997",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.opacity = "0.8"}
            onMouseLeave={(e) => e.target.style.opacity = "1"}
          >
            Datxe.com
          </h2>
        </div>

        <div className="app-header-actions">
          <div className="language-selector" style={{ position: "relative" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "4px 12px",
                borderRadius: "20px",
                backgroundColor: isLanguageOpen ? "#f0f0f0" : "transparent",
                border: "1px solid #e0e0e0",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsLanguageOpen(!isLanguageOpen);
                setShowPhone(false);
              }}
            >
              <img
                src={currentLanguage.flag}
                alt={currentLanguage.code}
                style={{
                  width: "24px",
                  height: "24px",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: "500" }}>{currentLanguage.code.toUpperCase()}</span>
              <IoChevronDown style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                transform: isLanguageOpen ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.3s"
              }} />
            </span>

            {isLanguageOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "45px",
                  right: 0,
                  width: "250px",
                  backgroundColor: "var(--bg-dropdown)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 1001,
                  padding: "12px",
                }}
              >
                <h3 style={{
                  margin: "0 0 12px 8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <span><AiOutlineGlobal /></span> {t.selectLanguage}
                </h3>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      style={{
                        padding: "10px 12px",
                        border: "none",
                        borderRadius: "8px",
                        background: currentLanguage.code === lang.code ? "#e8f4ff" : "transparent",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "var(--text-main)",
                        textAlign: "left",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                      }}
                      onClick={() => handleLanguageSelect(lang)}
                      onMouseEnter={(e) => {
                        if (currentLanguage.code !== lang.code) {
                          e.target.style.backgroundColor = "var(--bg-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentLanguage.code !== lang.code) {
                          e.target.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <img
                        src={lang.flag}
                        alt={lang.code}
                        style={{
                          width: "24px",
                          height: "16px",
                          objectFit: "cover",
                          borderRadius: "2px",
                        }}
                      />
                      <span style={{ fontWeight: currentLanguage.code === lang.code ? "600" : "400" }}>
                        {lang.name}
                      </span>
                      {currentLanguage.code === lang.code && (
                        <span style={{ marginLeft: "auto", color: "#20c997", fontSize: "16px" }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="cskh-container" style={{ position: "relative" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "4px",
                backgroundColor: showPhone ? "#f0f0f0" : "transparent",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowPhone(!showPhone);
                setIsLanguageOpen(false);
              }}
            >
              <MdOutlinePhone /> {t.support}
            </span>

            {showPhone && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  right: 0,
                  width: "200px",
                  backgroundColor: "var(--bg-dropdown)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                  zIndex: 1001,
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "var(--primary)",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}>
                  <MdOutlinePhone style={{ fontSize: "18px" }} />
                  {phoneNumbers[currentLanguage.code]}
                </div>
                <div style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: "8px",
                  marginTop: "8px"
                }}>
                  {t.support === "CSKH" ? "Tư vấn 24/7" :
                    t.support === "Support" ? "24/7 Support" :
                      t.support === "サポート" ? "24時間サポート" : "24小時客服"}
                </div>
                <div style={{
                  position: "absolute",
                  top: "-6px",
                  right: "20px",
                  width: "12px",
                  height: "12px",
                  backgroundColor: "var(--bg-card)",
                  transform: "rotate(45deg)",
                  borderTop: "1px solid var(--border-light)",
                  borderLeft: "1px solid #eee",
                }} />
              </div>
            )}
          </div>

          {(isAuthenticated && (user?.role === "ROLE_ADMIN" || user?.role === "ROLE_PROVIDER")) && (
            <div style={{ display: "flex", gap: "10px" }}>
              {user?.role === "ROLE_ADMIN" && (
                <>
                  <button
                    onClick={() => navigate("/admin/trips")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #20c997",
                      background: "#e6fff5",
                      color: "#059669",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {t.adminTrips}
                  </button>
                  <button
                    onClick={() => navigate("/provider/refunds")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ef4444",
                      background: "#fef2f2",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {t.refunds}
                  </button>
                </>
              )}
              {user?.role === "ROLE_PROVIDER" && (
                <>
                  <button
                    onClick={() => navigate("/admin/reviews")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #4f7cff",
                      background: "#e6edff",
                      color: "var(--primary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {t.providerReviews}
                  </button>
                  <button
                    onClick={() => navigate("/admin/revenue")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #f59e0b",
                      background: "#fef3c7",
                      color: "#d97706",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {t.revenue}
                  </button>
                </>
              )}
              <button
                onClick={() => navigate("/provider/check-in")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #16a34a",
                  background: "#dcfce7",
                  color: "#16a34a",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <FaQrcode /> {t.checkInQR}
              </button>
            </div>
          )}

          {isAuthenticated ? (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: "500" }}>
                {user?.fullName || user?.email}
              </span>
              <button
                onClick={() => navigate("/account")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #eab308",
                  background: "#fef9c3",
                  color: "#ca8a04",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {t.account}
              </button>
              <button
                onClick={() => navigate("/my-bookings")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #4f7cff",
                  background: "#eef2ff",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {t.bookingHistory}
              </button>


              <button
                onClick={logout}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                {t.logout}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              {t.login}
            </button>
          )}
        </div>
      </header>

      <Auth isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};

export default Header;