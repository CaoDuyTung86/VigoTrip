// @ts-check
import { useState } from "react";
import { PiAirplaneTilt } from "react-icons/pi";
import { MdOutlineTrain } from "react-icons/md";
import { IoIosBus } from "react-icons/io";
import { useLanguage } from "../context/LanguageContext";
import FlightSearch from "./FlightSearch";
import TrainSearch from "./TrainSearch";
import BusSearch from "./BusSearch";

/**
 * Panel ba tab chọn phương tiện (máy bay / tàu hoả / xe khách) ở trang chủ.
 *
 * Không nhận props — tab đang chọn được giữ trong state nội bộ; component cha
 * chỉ việc render cái này.
 *
 * @returns {React.JSX.Element}
 */
const BookingTabs = () => {
  const [active, setActive] = useState(0);
  const { t } = useLanguage();

  const tabs = [
    { icon: <PiAirplaneTilt />, label: t.flight },
    { icon: <MdOutlineTrain />, label: t.train },
    { icon: <IoIosBus />, label: t.bus },
  ];

  return (
    <div>
      {/* Tab Navigation - underline style */}
      <div className="booking-tabs-nav">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`booking-tab-btn${active === index ? " active" : ""}`}
            onClick={() => setActive(index)}
          >
            <span className="booking-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="booking-tab-content">
        {active === 0 && <FlightSearch />}
        {active === 1 && <TrainSearch />}
        {active === 2 && <BusSearch />}
      </div>
    </div>
  );
};

export default BookingTabs;