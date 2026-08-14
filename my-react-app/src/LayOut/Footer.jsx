import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import Visa from "../Picture/Visa.png";
import GPay from "../Picture/GPay.png";
import JCB from "../Picture/JCB.png";
import ApplePay from "../Picture/ApplePay.png";
import { MdOutlinePhone, MdOutlineEmail, MdOutlineSecurity } from "react-icons/md";
import { PiAirplaneTilt } from "react-icons/pi";
import { TbTrain, TbBus } from "react-icons/tb";

const phoneNumbers = {
  vi: "0977.999999",
  en: "+84 13 1234 5678",
  ja: "+84 58 1234 5678",
  zh: "+84 43 1234 5678",
};

const Footer = () => {
  const { t, currentLanguage } = useLanguage();
  const { isDark } = useTheme();

  const currentPhone = phoneNumbers[currentLanguage?.code] || phoneNumbers.vi;

  return (
    <footer style={{
      backgroundColor: "var(--bg-main)",
      borderTop: "1px solid var(--border-light)",
      padding: "56px 0 28px 0",
      marginTop: "60px",
      width: "100%",
      boxSizing: "border-box",
      transition: "all 0.3s ease",
    }}>
      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        width: "100%",
        padding: "0 32px",
        boxSizing: "border-box",
      }}>
        {/* Main Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr",
          gap: "36px",
          marginBottom: "48px",
          width: "100%",
        }}>
          {/* Brand & Contact Column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                background: "linear-gradient(135deg, #0071EB, #00b4d8)",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 18,
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
                letterSpacing: "-0.4px",
              }}>
                VigoTrip
              </span>
            </div>

            <p style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              lineHeight: 1.6,
              marginBottom: "18px",
              maxWidth: "340px",
            }}>
              {t.footerTagline || "Nền tảng đặt vé máy bay, tàu hỏa và xe khách trực tuyến hàng đầu. Cam kết giá tốt nhất, thao tác nhanh gọn và hỗ trợ 24/7."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href={`tel:${currentPhone.replace(/[^\d+]/g, '')}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "14px",
                  color: "var(--text-main)",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <MdOutlinePhone style={{ color: "var(--primary)", fontSize: 17 }} />
                <span>{t.hotlineLabel || "Hotline:"} <strong style={{ color: "var(--primary)" }}>{currentPhone}</strong> ({t.support === "CSKH" ? "24/7" : t.support === "Support" ? "24/7" : t.support === "サポート" ? "24時間" : "24小時"})</span>
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "14px", color: "var(--text-secondary)" }}>
                <MdOutlineEmail style={{ color: "var(--primary)", fontSize: 17 }} />
                <span>Email: support@vigotrip.vn</span>
              </div>
            </div>
          </div>

          {/* Column 2: Customer Care & Services */}
          <div>
            <h4 style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "var(--text-heading)",
              marginBottom: "18px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.contactUs || "LIÊN HỆ & DỊCH VỤ"}
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--primary)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-secondary)")}>
                  {t.customerCare || "Chăm Sóc Khách Hàng"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--primary)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-secondary)")}>
                  {t.serviceGuarantee || "Bảo Đảm Dịch Vụ"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--primary)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-secondary)")}>
                  {t.termsConditions || "Điều Khoản & Điều Kiện"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--primary)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text-secondary)")}>
                  {t.privacyPolicy || "Chính Sách Bảo Mật"}
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Payment Methods */}
          <div>
            <h4 style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "var(--text-heading)",
              marginBottom: "18px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.paymentMethods || "PHƯƠNG THỨC THANH TOÁN"}
            </h4>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "16px",
            }}>
              {[
                { src: Visa, alt: "Visa / Mastercard", width: 42 },
                { src: JCB, alt: "JCB", width: 42 },
                { src: ApplePay, alt: "Apple Pay", width: 44 },
                { src: GPay, alt: "Google Pay", width: 44 },
              ].map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.92)" : "#ffffff",
                    borderRadius: "8px",
                    padding: "4px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "32px",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.08)",
                    border: isDark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.08)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <img src={p.src} alt={p.alt} style={{ width: p.width, height: "auto", objectFit: "contain" }} />
                </div>
              ))}
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "12px",
              color: "#22c55e",
              fontWeight: 600,
            }}>
              <MdOutlineSecurity style={{ fontSize: 16 }} />
              <span>{t.securityBadge || "Bảo mật SSL 256-bit & PCI-DSS"}</span>
            </div>
          </div>

          {/* Column 4: Transport Partners */}
          <div>
            <h4 style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "var(--text-heading)",
              marginBottom: "18px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.transportPartnersTitle || t.ourPartners || "ĐỐI TÁC VẬN CHUYỂN"}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: "var(--text-secondary)" }}>
                <PiAirplaneTilt style={{ color: "var(--primary)", fontSize: 16 }} />
                <span>Vietnam Airlines • Vietjet Air • Bamboo</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: "var(--text-secondary)" }}>
                <TbTrain style={{ color: "#1d4ed8", fontSize: 16 }} />
                <span>{t.vietnamRailway || "Đường sắt Việt Nam (VNR)"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: "var(--text-secondary)" }}>
                <TbBus style={{ color: "#ef4444", fontSize: 16 }} />
                <span>{t.busPartners || "Phương Trang (FUTA) • Hoàng Long"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sub-Footer Divider & Copyright */}
        <div style={{
          borderTop: "1px solid var(--border-light)",
          paddingTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          color: "var(--text-muted)",
          fontSize: "13px",
          lineHeight: "1.6",
        }}>
          <div>
            {t.copyright || "Bản quyền © 2025 VigoTrip Travel VietNam Pte. Ltd. Bảo lưu mọi quyền. Nhà điều hành trang: VigoTrip Travel VietNam Pte. Ltd."}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {t.smartBookingPlatform || "Nền tảng đặt vé đa phương thức thông minh"}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;