import React from "react";
import { useLanguage } from "../context/LanguageContext";
import Visa from "../Picture/Visa.png";
import GPay from "../Picture/GPay.png";
import JCB from "../Picture/JCB.png";
import Plus from "../Picture/Plus.png";
import ApplePay from "../Picture/ApplePay.png";
import Google from "../Picture/Google.png";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer style={{
    backgroundColor: "var(--bg-main)",
    borderTop: "1px solid #e9ecef",
    padding: "48px 0 24px 0",
    marginTop: "60px",
    width: "100%",
    boxSizing: "border-box",
    transition: "all 0.3s ease", 

    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
        padding: "0 24px",
        boxSizing: "border-box",
      }}>
       
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "40px",
          marginBottom: "40px",
          width: "100%",
        }}>
         
          <div style={{ width: "100%" }}>
            <h4 style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-main)",
              marginBottom: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.contactUs || "LIÊN HỆ VỚI CHÚNG TÔI"}
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.customerCare || "Chăm Sóc Khách Hàng"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.serviceGuarantee || "Bảo Đảm Dịch Vụ"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.moreServiceInfo || "Xem thêm thông tin dịch vụ"}
                </a>
              </li>
            </ul>
          </div>

          
          <div style={{ width: "100%" }}>
            <h4 style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-main)",
              marginBottom: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.otherServices || "CÁC DỊCH VỤ KHÁC"}
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.investorRelations || "Quan Hệ Đầu Tư"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.careers || "Tuyển dụng"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.termsConditions || "Điều Khoản & Điều Kiện"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.privacyPolicy || "Tuyên bố quyền riêng tư"}
                </a>
              </li>
              <li style={{ marginBottom: "12px" }}>
                <a href="#" style={{ 
                  color: "var(--text-secondary)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  transition: "color 0.2s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => e.target.style.color = "#4f7cff"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  {t.aboutGroup || "Giới Thiệu Về Tập Đoàn VigoTrip"}
                </a>
              </li>
            </ul>
          </div>

          
          <div style={{ width: "100%" }}>
            <h4 style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-main)",
              marginBottom: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.paymentMethods || "PHƯƠNG THỨC THANH TOÁN"}
            </h4>
            <div style={{ 
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={Visa} alt="VISA" style={{ width: "40px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={JCB} alt="JCB" style={{ width: "50px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={Plus} alt="PLUS" style={{ width: "40px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>              
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={ApplePay} alt="Apple Pay" style={{ width: "50px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={GPay} alt="Google Pay" style={{ width: "50px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>

              
            </div>
          </div>

          
          <div style={{ width: "100%" }}>
            <h4 style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-main)",
              marginBottom: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {t.ourPartners || "ĐỐI TÁC CỦA CHÚNG TÔI"}
            </h4>
            <div style={{ 
              display: "flex", 
              flexDirection: "column",
              gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={Google} alt="Google " style={{ width: "90px", height: "auto" }} />
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}></span>
              </div>

              <span style={{ 
                fontSize: "14px", 
                fontWeight: "600", 
                color: "#00aa6c",
                background: "var(--bg-card)",
                padding: "6px 16px",
                borderRadius: "30px",
                border: "2px solid #00aa6c",
                display: "inline-block",
                width: "fit-content",
              }}>
                DatXeVisor
              </span>
            </div>
          </div>
        </div>

        
        <div style={{
          borderTop: "1px solid #e0e0e0",
          paddingTop: "24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
          lineHeight: "1.6",
        }}>
          <p style={{ margin: 0 }}>
            {t.copyright || "Bản quyền © 2025 VigoTrip Travel VietNam Pte. Ltd. Bảo lưu mọi quyền. Nhà điều hành trang: VigoTrip Travel VietNam Pte. Ltd."}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;