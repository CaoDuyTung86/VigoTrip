import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import BookingTabs from "../components/BookingTabs";
import { ShieldCheck, Zap, Headphones, RefreshCw, Plane, TrainTrack, Bus, Sparkles, MapPin } from "lucide-react";



const Home = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const trustItems = [
    { icon: <ShieldCheck size={20} />, text: t.safePayment },
    { icon: <Zap size={20} />, text: t.instantConfirmation },
    { icon: <Headphones size={20} />, text: t.support247 },
    { icon: <RefreshCw size={20} />, text: t.easyRefund },
  ];

  const promoItems = [
    { icon: <Plane size={24} style={{ color: "var(--primary)" }} />, label: t.flight, desc: t.bestPriceAllAirlines, path: "/ve-may-bay" },
    { icon: <TrainTrack size={24} style={{ color: "var(--primary)" }} />, label: t.train, desc: t.easyBookingSeat, path: "/ve-tau-hoa" },
    { icon: <Bus size={24} style={{ color: "var(--primary)" }} />, label: t.bus, desc: t.hundredsBusOperators, path: "/xe-khach" },
  ];

  const destinations = [
    { name: t.hanoi, from: t.startingFrom?.replace("{price}", "299.000đ") || "Từ 299.000đ", image: "/destinations/hanoi.png" },
    { name: t.hcmc, from: t.startingFrom?.replace("{price}", "350.000đ") || "Từ 350.000đ", image: "/destinations/tphcm.jpg" },
    { name: t.danang, from: t.startingFrom?.replace("{price}", "450.000đ") || "Từ 450.000đ", image: "/destinations/danang.jpg" },
    { name: t.nhaTrang || "Nha Trang", from: t.startingFrom?.replace("{price}", "520.000đ") || "Từ 520.000đ", image: "/destinations/nhatrang.jpg" },
  ];

  return (
    <div className="home-wrap">

      {/* ===== HERO SECTION ===== */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">{t.heroTitle}</h1>
          <p className="hero-subtitle">{t.heroTagline}</p>

          <div className="hero-badges">
            {trustItems.map((item) => (
              <span key={item.text} className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
        <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} style={{ color: 'var(--primary)' }} /> {t.quickBooking}
        </p>
        <div className="promo-grid">
          {promoItems.map((item) => (
            <div
              key={item.path}
              className="promo-card"
              onClick={() => navigate(item.path)}
            >
              <div className="promo-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                {item.icon}
              </div>
              <div className="promo-label">{item.label}</div>
              <div className="promo-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== DESTINATIONS ===== */}
      <div style={{ height: 40 }} />
      <div className="home-section">
        <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} style={{ color: 'var(--primary)' }} /> {t.popularDestinations}
        </p>
        <div className="dest-grid">
          {destinations.map((dest) => (
            <div key={dest.name} className="dest-card">
              <img src={dest.image} alt={dest.name} />
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
          {trustItems.map((item) => (
            <div key={item.text} className="trust-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="trust-icon" style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>{item.icon}</span>
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