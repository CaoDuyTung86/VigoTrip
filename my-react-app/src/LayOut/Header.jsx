import React, { useState } from "react";
import { MdOutlinePhone } from "react-icons/md";
import { IoChevronDown } from "react-icons/io5";
import Auth from "../Page/Auth";
import { useLanguage, LANGUAGES } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { AiOutlineGlobal } from "react-icons/ai";
import { MdOutlineLightMode, MdOutlineDarkMode } from "react-icons/md";
import { PiAirplaneTilt } from "react-icons/pi";
import { MdOutlineTrain, MdOutlinePercent } from "react-icons/md";
import { IoIosBus } from "react-icons/io";
import { useNavigate, useLocation } from "react-router-dom";
import { User, Ticket, LogOut, Navigation, MapPin, Undo2, QrCode, DollarSign, MessageSquare, Users, Tag } from "lucide-react";

const Header = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { currentLanguage, t, changeLanguage } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const languages = LANGUAGES;

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
    { icon: <Tag size={16} />, label: "Ưu đãi", path: "/uu-dai" },
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
              width: 38,
              height: 38,
              background: "linear-gradient(135deg, #0071EB, #00b4d8)",
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 19,
              fontWeight: 800,
              flexShrink: 0,
            }}>
              ✈
            </div>
            <span style={{
              fontWeight: 800,
              fontSize: 22,
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
              <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* RIGHT: Actions */}
        <div className="app-header-actions">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? t.themeLight : t.themeDark}
            style={{
              background: "none",
              border: "1px solid var(--border-input)",
              borderRadius: 8,
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 19,
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
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-input)",
                background: isLanguageOpen ? "var(--bg-hover)" : "transparent",
                fontSize: 15,
                color: "var(--text-main)",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
              onClick={(e) => { e.stopPropagation(); setIsLanguageOpen(!isLanguageOpen); setShowPhone(false); setShowUserMenu(false); }}
            >
              <img
                src={currentLanguage.flag}
                alt={currentLanguage.name}
                style={{
                  width: 26,
                  height: 18,
                  objectFit: "cover",
                  borderRadius: 3,
                  border: "1px solid var(--border-light)",
                  flexShrink: 0,
                }}
              />
              <span>{currentLanguage.code.toUpperCase()}</span>
              <IoChevronDown style={{ fontSize: 14, color: "var(--text-muted)", transform: isLanguageOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
            </button>
            {isLanguageOpen && (
              <div style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 236,
                background: "var(--bg-dropdown)",
                borderRadius: 12,
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--border-light)",
                zIndex: 1001,
                padding: 8,
              }}>
                <div style={{ padding: "4px 8px 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <AiOutlineGlobal style={{ marginRight: 4 }} />{t.selectLanguage}
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    style={{
                      padding: "10px 10px",
                      border: "none",
                      borderRadius: 8,
                      background: currentLanguage.code === lang.code ? "var(--primary-light)" : "transparent",
                      cursor: "pointer",
                      fontSize: 14.5,
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
                    <img
                      src={lang.flag}
                      alt={lang.name}
                      style={{
                        width: 30,
                        height: 21,
                        objectFit: "cover",
                        borderRadius: 3,
                        border: "1px solid var(--border-light)",
                        flexShrink: 0,
                      }}
                    />
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
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-input)",
                background: showPhone ? "var(--bg-hover)" : "transparent",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-secondary)",
                fontFamily: "inherit",
              }}
              onClick={(e) => { e.stopPropagation(); setShowPhone(!showPhone); setIsLanguageOpen(false); setShowUserMenu(false); }}
            >
              <MdOutlinePhone style={{ fontSize: 17 }} />
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
                  {t.support247Text}
                </div>
              </div>
            )}
          </div>

          {/* User area & Dropdown Menu */}
          {isAuthenticated ? (
            <div className="user-menu-container" style={{ position: "relative" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: showUserMenu ? "var(--bg-hover)" : "transparent",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-main)",
                  fontFamily: "inherit",
                }}
                onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); setIsLanguageOpen(false); setShowPhone(false); }}
              >
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0071EB, #00b4d8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {(user?.fullName || user?.email || "U")[0].toUpperCase()}
                </div>
                <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.fullName || user?.email}
                </span>
                <IoChevronDown style={{ fontSize: 14, color: "var(--text-muted)", transform: showUserMenu ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
              </button>
              {showUserMenu && (
                <div style={{
                  position: "absolute",
                  top: 44,
                  right: 0,
                  width: 230,
                  background: "var(--bg-dropdown)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-light)",
                  zIndex: 1001,
                  overflow: "hidden",
                  padding: "4px 0",
                }}>
                  {/* Mục cá nhân */}
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

                  {/* Mục chức năng Quản trị / Admin */}
                  {user?.role === "ROLE_ADMIN" && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border-light)", margin: "4px 0" }} />
                      <div style={{ padding: "4px 14px 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Quản trị hệ thống
                      </div>
                      {[
                        { label: t.adminTrips || "Quản lý chuyến đi", path: "/admin/trips", icon: <Navigation size={16} color="#3b82f6" /> },
                        { label: "Quản lý tuyến đường", path: "/admin/routes", icon: <MapPin size={16} color="#8b5cf6" /> },
                        { label: "Quản lý người dùng", path: "/admin/users", icon: <Users size={16} color="#06b6d4" /> },
                        { label: "Quản lý voucher", path: "/admin/vouchers", icon: <Tag size={16} color="#f59e0b" /> },
                        { label: t.refunds || "Hoàn tiền & Hủy vé", path: "/provider/refunds", icon: <Undo2 size={16} color="#ef4444" /> },
                        { label: t.revenue || "Thống kê doanh thu", path: "/admin/revenue", icon: <DollarSign size={16} color="#fbbf24" /> },
                        { label: t.providerReviews || "Đánh giá & Feedback", path: "/admin/reviews", icon: <MessageSquare size={16} color="#60a5fa" /> },
                        { label: t.checkInQR || "Quét vé (Check-in)", path: "/provider/check-in", icon: <QrCode size={16} color="#10b981" /> },
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
                    </>
                  )}

                  {/* Mục chức năng Nhà cung cấp / Provider */}
                  {user?.role === "ROLE_PROVIDER" && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border-light)", margin: "4px 0" }} />
                      <div style={{ padding: "4px 14px 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Nhà cung cấp
                      </div>
                      {[
                        { label: t.providerReviews || "Đánh giá khách hàng", path: "/admin/reviews", icon: <MessageSquare size={16} color="#60a5fa" /> },
                        { label: t.revenue || "Doanh thu", path: "/admin/revenue", icon: <DollarSign size={16} color="#fbbf24" /> },
                        { label: t.checkInQR || "Quét vé (Check-in)", path: "/provider/check-in", icon: <QrCode size={16} color="#10b981" /> },
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
                    </>
                  )}

                  {/* Nút Đăng xuất */}
                  <div style={{ borderTop: "1px solid var(--border-light)", margin: "4px 0" }} />
                  <button
                    style={{ ...dropdownItemStyle, color: "var(--danger)" }}
                    onClick={() => { logout(); setShowUserMenu(false); showToast(t.authXLogoutSuccess, "info"); }}
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
                padding: "9px 22px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15.5,
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