import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BookingTabs from "../components/BookingTabs";
import beachBanner from "../Picture/beach_banner.jpg";

const PROMO_ITEMS = [
  { icon: "✈️", label: "Vé máy bay", desc: "Giá tốt nhất mọi hãng", path: "/ve-may-bay" },
  { icon: "🚂", label: "Vé tàu hỏa", desc: "Đặt nhanh, chọn chỗ ngồi", path: "/ve-tau-hoa" },
  { icon: "🚌", label: "Xe khách", desc: "Hàng trăm nhà xe uy tín", path: "/xe-khach" },
  { icon: "🎁", label: "Đặt theo gói", desc: "Combo tiết kiệm hơn", path: "/dat-theo-goi" },
];

const DESTINATIONS = [
  { name: "Hà Nội", from: "Từ 299.000đ", color: "linear-gradient(135deg,#1a237e,#3949ab)" },
  { name: "TP. Hồ Chí Minh", from: "Từ 350.000đ", color: "linear-gradient(135deg,#b71c1c,#e53935)" },
  { name: "Đà Nẵng", from: "Từ 450.000đ", color: "linear-gradient(135deg,#004d40,#00897b)" },
  { name: "Nha Trang", from: "Từ 520.000đ", color: "linear-gradient(135deg,#01579b,#0288d1)" },
];

const TRUST_ITEMS = [
  { icon: "🔒", text: "Thanh toán an toàn" },
  { icon: "⚡", text: "Xác nhận tức thì" },
  { icon: "🎧", text: "Hỗ trợ 24/7" },
  { icon: "💸", text: "Hoàn tiền dễ dàng" },
];

const Home = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="home-wrap">

      {/* ===== HERO SECTION ===== */}
      <section className="hero-section">
        <img src={beachBanner} alt="banner" className="hero-bg-img" />

        <div className="hero-content">
          <h1 className="hero-title">{t.heroTitle}</h1>
          <p className="hero-subtitle">{t.heroTagline}</p>

          <div className="hero-badges">
            {TRUST_ITEMS.map((item) => (
              <span key={item.text} className="hero-badge">
                {item.icon} {item.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SEARCH WIDGET (overlap) ===== */}
      <div className="search-widget-wrap">
        <div className="search-widget-card">
          <BookingTabs />
        </div>
      </div>

      {/* ===== QUICK ACCESS ===== */}
      <div style={{ height: 40 }} />
      <div className="home-section">
        <p className="section-title">🚀 Đặt vé nhanh</p>
        <div className="promo-grid">
          {PROMO_ITEMS.map((item) => (
            <div
              key={item.path}
              className="promo-card"
              onClick={() => navigate(item.path)}
            >
              <div className="promo-icon">{item.icon}</div>
              <div className="promo-label">{item.label}</div>
              <div className="promo-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== DESTINATIONS ===== */}
      <div style={{ height: 40 }} />
      <div className="home-section">
        <p className="section-title">🗺️ Điểm đến phổ biến</p>
        <div className="dest-grid">
          {DESTINATIONS.map((dest) => (
            <div key={dest.name} className="dest-card">
              <div style={{
                width: "100%",
                height: "100%",
                background: dest.color,
                display: "flex",
                alignItems: "flex-end",
              }} />
              <div className="dest-card-overlay">
                <div className="dest-card-name">{dest.name}</div>
                <div className="dest-card-price">{dest.from}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== TRUST BAR ===== */}
      <div style={{ height: 48 }} />
      <div style={{
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border-light)",
        borderBottom: "1px solid var(--border-light)",
        padding: "28px 24px",
      }}>
        <div className="trust-row">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="trust-item">
              <span className="trust-icon">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
};

export default Home;