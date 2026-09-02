import { PiAirplaneTilt } from "react-icons/pi";
import { MdOutlineTrain } from "react-icons/md";
import { IoIosBus } from "react-icons/io";
import { MdOutlinePercent } from "react-icons/md";
import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const menuItems = [
    { icon: <PiAirplaneTilt />, label: t.flight, path: "/ve-may-bay" },
    { icon: <MdOutlineTrain />, label: t.train, path: "/ve-tau-hoa" },
    { icon: <IoIosBus />, label: t.bus, path: "/xe-khach" },
    { icon: <MdOutlinePercent />, label: t.package, path: "/dat-theo-goi" },
  ];

  const handleMenuClick = (path) => {
    navigate(path);
  };

  return (
    <aside
      className="app-sidebar"
      style={{
        position: "fixed",
        // Trước đây cắm cứng 70px. Header nay cao 64px ở desktop và 56px + vùng
        // tai thỏ ở mobile, nên phải bám biến — không thì sidebar hoặc hụt hoặc
        // chui xuống dưới header trên iPhone có notch.
        top: "var(--header-height)",
        left: 0,
        width: isOpen ? "170px" : "0",
        height: "calc(100vh - var(--header-height))",
        backgroundColor: "var(--bg-card)",
        boxShadow: isOpen ? "2px 0 10px rgba(0,0,0,0.05)" : "none",
        transition: "width 0.3s",
        overflow: "hidden",
        zIndex: 999,
      }}
    >
      <div style={{ 
        padding: isOpen ? "20px" : "0",
        opacity: isOpen ? 1 : 0,
        transition: "opacity 0.2s",
        width: "190px", 
      }}>
        {menuItems.map((item, index) => (
          <div 
            key={index}
            onClick={() => handleMenuClick(item.path)}
            style={{ 
              padding: "14px 16px",
              margin: "4px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              borderRadius: "8px",
              transition: "background 0.2s",
              color: "var(--text-main)",
              fontSize: "15px",
              fontWeight: "500",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: "20px", color: "var(--primary)" }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;