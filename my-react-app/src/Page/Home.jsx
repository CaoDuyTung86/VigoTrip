import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import BookingTabs from "../components/BookingTabs";
import beachBanner from "../Picture/beach_banner.jpg";

const Home = () => {
  const { t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", transition: "background-color 0.3s" }}>

      <Header setIsSidebarOpen={setIsSidebarOpen} />


      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <main className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}>

          {/* Hero Banner */}
          <div style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 28,
            marginTop: "clamp(80px, 10vh, 100px)",
            boxShadow: "var(--shadow-card)",
            maxHeight: 280,
          }}>
            <img
              src={beachBanner}
              alt="Khám phá thiên đường biển xanh"
              style={{
                width: "100%",
                height: 280,
                objectFit: "cover",
                display: "block",
              }}
            />
            {/* Overlay gradient + text */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "32px 40px",
            }}>
              <h2 style={{
                color: "#fff",
                fontSize: "clamp(22px, 4vw, 36px)",
                fontWeight: 800,
                margin: 0,
                textShadow: "0 2px 12px rgba(0,0,0,0.3)",
                lineHeight: 1.3,
              }}>
                {t.heroTitle}
              </h2>
              <p style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: "clamp(13px, 2vw, 17px)",
                margin: "8px 0 0",
                textShadow: "0 1px 6px rgba(0,0,0,0.3)",
                maxWidth: 800,
              }}>
                {t.heroTagline}
              </p>
            </div>
          </div>

          <BookingTabs />
        </main>
      </div>
    </div>
  );
};

export default Home;