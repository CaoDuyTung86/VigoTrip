// @ts-check
import { PiAirplaneTilt } from "react-icons/pi";
import { MdOutlineTrain } from "react-icons/md";
import { IoIosBus } from "react-icons/io";
import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";

/**
 * Thanh điều hướng cạnh trái, ẩn hoặc mở theo trạng thái `isOpen`.
 *
 * Đóng/mở bằng cách chuyển chiều rộng giữa 170px và 0 (có transition), kèm
 * `overflow: hidden` để menu không lòi ra ngoài khi đang thu. `top` bám biến
 * `--header-offset` thay vì cứng 70px, để sidebar không hụt hay chui dưới header
 * trên iPhone có tai thỏ.
 *
 * @param {object} props
 * @param {boolean} props.isOpen sidebar đang mở hay không
 * @returns {React.JSX.Element}
 */
const Sidebar = ({ isOpen }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const menuItems = [
    { icon: <PiAirplaneTilt />, label: t.flight, path: "/ve-may-bay" },
    { icon: <MdOutlineTrain />, label: t.train, path: "/ve-tau-hoa" },
    { icon: <IoIosBus />, label: t.bus, path: "/xe-khach" },
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
        top: "var(--header-offset)",
        left: 0,
        width: isOpen ? "170px" : "0",
        height: "calc(100vh - var(--header-offset))",
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