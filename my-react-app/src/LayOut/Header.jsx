import React, { useState } from "react";
import { FaQrcode } from "react-icons/fa";
import { MdOutlinePhone } from "react-icons/md";
import { IoChevronDown } from "react-icons/io5";
import Auth from "../Page/Auth";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AiOutlineGlobal } from "react-icons/ai";
import { MdOutlineLightMode, MdOutlineDarkMode } from "react-icons/md";
import { PiAirplaneTilt } from "react-icons/pi";
import { MdOutlineTrain, MdOutlinePercent } from "react-icons/md";
import { IoIosBus } from "react-icons/io";
import { useNavigate, useLocation } from "react-router-dom";
import VNFlag from "../Picture/flags/vn.png";
import UKFlag from "../Picture/flags/uk.png";
import JPFlag from "../Picture/flags/jp.png";
import TWFlag from "../Picture/flags/tw.png";
import { User, Ticket, LogOut } from "lucide-react";

const Header = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { currentLanguage, t, changeLanguage } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const languages = [
    { code: "vi", name: "Tiếng Việt", flag: VNFlag },
    { code: "en", name: "English", flag: UKFlag },
    { code: "ja", name: "日本語", flag: JPFlag },
    { code: "zh", name: "繁體中文", flag: TWFlag },
  ];

  const phoneNumbers = {
    vi: "0977.999999",
    en: "+84 13 1234 5678",
    ja: "+84 58 1234 5678",
    zh: "+84 43 1234 5678",
  };

  const navTabs = [
    { icon: <PiAirplaneTilt />, label: t.flight, path: "/ve-may-bay" },
    { icon: <MdOutlineTrain />, label: t.train, path: "/ve-tau-hoa" },
    { icon: <IoIosBus />, label: t.bus, path: "/xe-khach" },
    { icon: <MdOutlinePercent />, label: t.package, path: "/dat-theo-goi" },
  ];

  const handleLogoClick = () => navigate("/");

  const handleLanguageSelect = (language) => {
    changeLanguage(language);
    setIsLanguageOpen(false);
  };

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest(".language-selector") &&
        !event.target.closest(".cskh-container") &&
        !event.target.closest(".user-menu-container")
      ) {
        setIsLanguageOpen(false);
        setShowPhone(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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
          zIndex: 1000,
        }}
      >
        {/* LEFT: Logo */}
        <div className="app-header-left">
          <div
            onClick={handleLogoClick}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}
          >
            <div style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #0071EB, #00b4d8)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              flexShrink: 0,
            }}>
              ✈
            </div>
            <span style={{
              fontWeight: 800,
              fontSize: 18,
              background: "linear-gradient(135deg, #0071EB, #00b4d8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.3px",
            }}>
              VigoTrip
            </span>
          </div>
        </div>

        {/* CENTER: Nav tabs */}
        <div className="app-header-center">
          {navTabs.map((tab) => (
            <button
              key={tab.path}
              className={`header-nav-tab${location.pathname === tab.path ? " active" : ""}`}
              onClick={() => navigate(tab.path)}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* RIGHT: Actions */}
        <div className="app-header-actions">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Chế độ sáng" : "Chế độ tối"}
            style={{
              background: "none",
              border: "1px solid var(--border-input)",
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {isDark ? <MdOutlineLightMode /> : <MdOutlineDarkMode />}
          </button>

          {/* Language selector */}
          <div className="language-selector" style={{ position: "relative" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-input)",
                background: isLanguageOpen ? "var(--bg-hover)" : "transparent",
                fontSize: 13,
                color: "var(--text-main)",
                fontWeight: 500,
                fontFamily: "inherit",
              }}
              onClick={(e) => { e.stopPropagation(); setIsLanguageOpen(!isLanguageOpen); setShowPhone(false); setShowUserMenu(false); }}
            >
              <img src={currentLanguage.flag} alt={currentLanguage.code} style={{ width: 20, height: 20, objectFit: "cover", borderRadius: "50%" }} />
              <span>{currentLanguage.code.toUpperCase()}</span>
              <IoChevronDown style={{ fontSize: 12, color: "var(--text-muted)", transform: isLanguageOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
            </button>
            {isLanguageOpen && (
              <div style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 220,
                background: "var(--bg-dropdown)",
                borderRadius: 12,
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--border-light)",
                zIndex: 1001,
                padding: 8,
              }}>
                <div style={{ padding: "4px 8px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <AiOutlineGlobal style={{ marginRight: 4 }} />{t.selectLanguage}
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    style={{
                      padding: "9px 10px",
                      border: "none",
                      borderRadius: 8,
                      background: currentLanguage.code === lang.code ? "var(--primary-light)" : "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: currentLanguage.code === lang.code ? "var(--primary)" : "var(--text-main)",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      fontWeight: currentLanguage.code === lang.code ? 600 : 400,
                      fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                    onClick={() => handleLanguageSelect(lang)}
                    onMouseEnter={(e) => { if (currentLanguage.code !== lang.code) e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { if (currentLanguage.code !== lang.code) e.currentTarget.style.background = "transparent"; }}
                  >
                    <img src={lang.flag} alt={lang.code} style={{ width: 22, height: 14, objectFit: "cover", borderRadius: 2 }} />
                    <span>{lang.name}</span>
                    {currentLanguage.code === lang.code && <span style={{ marginLeft: "auto", color: "var(--primary)", fontSize: 14 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CSKH */}
          <div className="cskh-container" style={{ position: "relative" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-input)",
                background: showPhone ? "var(--bg-hover)" : "transparent",
                fontSize: 13,
                color: "var(--text-secondary)",
                fontFamily: "inherit",
              }}
              onClick={(e) => { e.stopPropagation(); setShowPhone(!showPhone); setIsLanguageOpen(false); setShowUserMenu(false); }}
            >
              <MdOutlinePhone style={{ fontSize: 15 }} />
              {t.support}
            </button>
            {showPhone && (
              <div style={{
                position: "absolute",
                top: 44,
                right: 0,
                minWidth: 220,
                background: "var(--bg-dropdown)",
                borderRadius: 14,
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--border-light)",
                zIndex: 1001,
                padding: "14px 16px",
                textAlign: "center",
              }}>
                <a
                  href={`tel:${phoneNumbers[currentLanguage.code].replace(/[^\d+]/g, '')}`}
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--primary)",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <MdOutlinePhone style={{ fontSize: 18, flexShrink: 0 }} />
                  <span>{phoneNumbers[currentLanguage.code]}</span>
                </a>
                <div style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: 8,
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                }}>
                  {t.support === "CSKH" ? "Tư vấn 24/7" : t.support === "Support" ? "24/7 Support" : t.support === "サポート" ? "24時間サポート" : "24小時客服"}
                </div>
              </div>
            )}
          </div>

          {/* Admin/Provider buttons */}
          {isAuthenticated && (user?.role === "ROLE_ADMIN" || user?.role === "ROLE_PROVIDER") && (
            <div style={{ display: "flex", gap: 8 }}>
              {user?.role === "ROLE_ADMIN" && (
                <>
                  <button onClick={() => navigate("/admin/trips")} style={glowBtnStyle("#3b82f6", "rgba(59, 130, 246, 0.2)", "rgba(59, 130, 246, 0.35)")}>{t.adminTrips}</button>
                  <button onClick={() => navigate("/provider/refunds")} style={glowBtnStyle("#ef4444", "rgba(239, 68, 68, 0.2)", "rgba(239, 68, 68, 0.35)")}>{t.refunds}</button>
                </>
              )}
              {user?.role === "ROLE_PROVIDER" && (
                <>
                  <button onClick={() => navigate("/admin/reviews")} style={glowBtnStyle("#60a5fa", "rgba(96, 165, 250, 0.2)", "rgba(96, 165, 250, 0.35)")}>{t.providerReviews}</button>
                  <button onClick={() => navigate("/admin/revenue")} style={glowBtnStyle("#fbbf24", "rgba(251, 191, 36, 0.2)", "rgba(251, 191, 36, 0.35)")}>{t.revenue}</button>
                </>
              )}
              <button onClick={() => navigate("/provider/check-in")} style={{ ...glowBtnStyle("#34d399", "rgba(52, 211, 153, 0.2)", "rgba(52, 211, 153, 0.35)"), display: "flex", alignItems: "center", gap: 6 }}>
                <FaQrcode style={{ fontSize: 13, color: "#34d399" }} /> {t.checkInQR}
              </button>
            </div>
          )}

          {/* User area */}
          {isAuthenticated ? (
            <div className="user-menu-container" style={{ position: "relative" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: showUserMenu ? "var(--bg-hover)" : "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-main)",
                  fontFamily: "inherit",
                }}
                onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); setIsLanguageOpen(false); setShowPhone(false); }}
              >
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0071EB, #00b4d8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {(user?.fullName || user?.email || "U")[0].toUpperCase()}
                </div>
                <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.fullName || user?.email}
                </span>
                <IoChevronDown style={{ fontSize: 12, color: "var(--text-muted)", transform: showUserMenu ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
              </button>
              {showUserMenu && (
                <div style={{
                  position: "absolute",
                  top: 44,
                  right: 0,
                  width: 190,
                  background: "var(--bg-dropdown)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-light)",
                  zIndex: 1001,
                  overflow: "hidden",
                }}>
                  {[
                    { label: t.account, path: "/account", icon: <User size={16} /> },
                    { label: t.bookingHistory, path: "/my-bookings", icon: <Ticket size={16} /> },
                  ].map((item) => (
                    <button
                      key={item.path}
                      style={dropdownItemStyle}
                      onClick={() => { navigate(item.path); setShowUserMenu(false); }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span> {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid var(--border-light)", margin: "4px 0" }} />
                  <button
                    style={{ ...dropdownItemStyle, color: "var(--danger)" }}
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#fff0f0"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ display: "flex", alignItems: "center" }}><LogOut size={16} /></span> {t.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13.5,
                fontFamily: "inherit",
                transition: "background 0.18s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--primary)"}
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

const glowBtnStyle = (color, bg, border) => ({
  padding: "6px 13px",
  borderRadius: 8,
  border: `1px solid ${border}`,
  background: bg,
  color: color,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  boxShadow: `0 0 10px ${bg}`,
  transition: "all 0.2s",
});

const dropdownItemStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--text-main)",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "inherit",
  fontWeight: 500,
  transition: "background 0.15s",
};

export default Header;