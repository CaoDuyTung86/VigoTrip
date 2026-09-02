import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../context/ToastContext";
import { useSavedPassengers } from "../context/SavedPassengersContext";
import { FiSearch, FiClock, FiInfo, FiChevronDown, FiX, FiCalendar, FiGift } from "react-icons/fi";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";
import { MdFlightTakeoff, MdFlightLand } from "react-icons/md";
import { FaSuitcase, FaUtensils, FaWifi, FaUserFriends } from "react-icons/fa";
import { GiCommercialAirplane } from "react-icons/gi";
import VNFlag from "../Picture/flags/vn.png";

// Flight Booking Detail Component
const FlightBookingDetail = ({ flightData, onClose, onContinue, passengerCounts }) => {
  const { t } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("economy");
  const [selectedPayment, setSelectedPayment] = useState("momo");
  const [passengerInfoList, setPassengerInfoList] = React.useState([]);
  const [globalContact] = React.useState({ promoOptIn: true, remember: false });
  const { addPassenger } = useSavedPassengers();

  React.useEffect(() => {
    if(!passengerCounts) return;
    const newList = [];
    for (let i = 0; i < passengerCounts.adult; i++) newList.push({ type: "ADULT", data: {} });
    for (let i = 0; i < passengerCounts.child; i++) newList.push({ type: "CHILD", data: {} });
    for (let i = 0; i < passengerCounts.infant; i++) newList.push({ type: "INFANT", data: {} });
    setPassengerInfoList(prev => newList.map((item, idx) => prev[idx] ? { ...item, data: prev[idx].data } : item));
  }, [passengerCounts]);

  // Dữ liệu mẫu - có thể nhận từ props
  const data = flightData || {
    fromCity: "TP. Hồ Chí Minh",
    fromCode: "SGN",
    fromAirport: "Tân Sơn Nhất T1",
    toCity: "Hà Nội",
    toCode: "HAN",
    toAirport: "Nội Bài T1",
    departureDate: "T2, 18 thg 5",
    returnDate: "T4, 20 thg 5",
    duration: "2g 15p",
    
    outboundFlight: {
      departureTime: "20:40",
      departureAirport: "SGN",
      departureFull: "TP. Hồ Chí Minh Cảng hàng không quốc tế Tân Sơn Nhất T1",
      arrivalTime: "22:55",
      arrivalAirport: "HAN",
      arrivalFull: "Hà Nội Cảng hàng không quốc tế Nội Bài T1",
      airline: "VietJet Air",
      flightNumber: "VJ1158",
      aircraft: "Airbus A321",
      class: "Hạng Phổ Thông"
    },
    
    inboundFlight: {
      departureTime: "22:45",
      departureAirport: "HAN",
      departureFull: "Hà Nội Cảng hàng không quốc tế Nội Bài T1",
      arrivalTime: "00:55",
      arrivalDate: "21/05",
      arrivalAirport: "SGN",
      arrivalFull: "TP. Hồ Chí Minh Cảng hàng không quốc tế Tân Sơn Nhất T1",
      airline: "VietJet Air",
      flightNumber: "VJ167",
      aircraft: "Airbus A321",
      class: "Hạng Phổ Thông"
    }
  };

  const classOptions = [
    {
      id: "economy",
      name: t.detClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.detOnePiece || "1 kiện",
        checked: t.detNoneYet || "Chưa có"
      },
      flexibility: t.detNonRefundable || "Không hoàn",
      price: "2.031.000₫",
      originalPrice: "2.053.000₫",
      benefits: [(t.detMilesAtLeast || "Dặm: ít nhất {n}").replace("{n}", "38"), t.detComboGoodPrice || "Combo chuyến bay: ✓ Giá tốt"]
    },
    {
      id: "economyPlus",
      name: t.detClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.detOnePiece || "1 kiện",
        checked: t.detNoneYet || "Chưa có"
      },
      flexibility: "TripFlex · EasyCancel Plus",
      benefits: [t.detFourBenefits || "4 quyền lợi", t.detFreeCancelFee || "Phí hủy: Miễn phí"],
      price: "2.053.000₫",
      originalPrice: "2.694.000₫"
    },
    {
      id: "economyLuggage",
      name: t.detClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.detOnePiece || "1 kiện",
        checked: "30 kg"
      },
      flexibility: t.detNonRefundable || "Không hoàn",
      price: "2.694.000₫",
      originalPrice: "2.722.000₫",
      benefits: [(t.detMilesAtLeast || "Dặm: ít nhất {n}").replace("{n}", "68")]
    }
  ];

  const paymentMethods = [
    {
      id: "momo",
      name: "MoMo",
      price: "2.031.000₫",
      originalPrice: "2.053.000₫",
      discount: "22.000₫"
    },
    {
      id: "any",
      name: t.detAnyMethod || "Bất Kỳ",
      price: "2.053.000₫",
      originalPrice: "2.053.000₫",
      discount: "0₫"
    }
  ];

  const selectedClassData = classOptions.find(c => c.id === selectedClass) || classOptions[0];

  const priceBreakdown = {
    adult: {
      count: 1,
      price: "2.031.000₫",
      base: "887.000₫",
      tax: "1.166.000₫",
      discount: "22.000₫"
    },
    total: "2.031.000₫"
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
      overflowY: "auto",
      padding: "20px",
    }} onClick={onClose}>
      <div style={{
        maxWidth: "900px",
        width: "100%",
        backgroundColor: "var(--bg-card)",
        borderRadius: "16px",
        padding: "30px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "20px",
          borderBottom: "2px solid #f0f0f0",
        }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "600" }}>
            {data.fromCity} ⇌ {data.toCity}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px" }}>
            ×
          </button>
        </div>

        {/* Outbound Flight */}
        <div style={{
          backgroundColor: "#f9f9f9",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              {t.detOutboundLeg || "Chiều đi"} · <span style={{ color: "var(--primary)" }}>{data.departureDate}</span>
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)" }}>
              <FiClock /> {data.duration}
            </div>
          </div>

          <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
            {/* Departure */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "24px", fontWeight: "600", marginBottom: "5px" }}>
                {data.outboundFlight.departureTime}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "5px" }}>
                {data.outboundFlight.departureAirport}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                {data.outboundFlight.departureFull}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <GiCommercialAirplane style={{ color: "var(--primary)", fontSize: "24px", transform: "rotate(90deg)" }} />
            </div>

            {/* Arrival */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "24px", fontWeight: "600", marginBottom: "5px" }}>
                {data.outboundFlight.arrivalTime}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "5px" }}>
                {data.outboundFlight.arrivalAirport}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                {data.outboundFlight.arrivalFull}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #e0e0e0",
            fontSize: "14px",
            color: "var(--text-secondary)",
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
          }}>
            <span><strong>{data.outboundFlight.airline}</strong> {data.outboundFlight.flightNumber}</span>
            <span>{data.outboundFlight.aircraft}</span>
            <span style={{ color: "var(--primary)" }}>{data.outboundFlight.class}</span>
          </div>
        </div>

        {/* Inbound Flight */}
        <div style={{
          backgroundColor: "#f9f9f9",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              {t.detInboundLeg || "Chiều về"} · <span style={{ color: "var(--primary)" }}>{data.returnDate}</span>
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)" }}>
              <FiClock /> 2g 10p
            </div>
          </div>

          <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
            {/* Departure */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "24px", fontWeight: "600", marginBottom: "5px" }}>
                {data.inboundFlight.departureTime}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "5px" }}>
                {data.inboundFlight.departureAirport}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                {data.inboundFlight.departureFull}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <GiCommercialAirplane style={{ color: "var(--primary)", fontSize: "24px", transform: "rotate(90deg)" }} />
              {data.inboundFlight.arrivalDate && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "5px" }}>
                  {data.inboundFlight.arrivalDate}
                </div>
              )}
            </div>

            {/* Arrival */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "24px", fontWeight: "600", marginBottom: "5px" }}>
                {data.inboundFlight.arrivalTime}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "5px" }}>
                {data.inboundFlight.arrivalAirport}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                {data.inboundFlight.arrivalFull}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #e0e0e0",
            fontSize: "14px",
            color: "var(--text-secondary)",
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
          }}>
            <span><strong>{data.inboundFlight.airline}</strong> {data.inboundFlight.flightNumber}</span>
            <span>{data.inboundFlight.aircraft}</span>
            <span style={{ color: "var(--primary)" }}>{data.inboundFlight.class}</span>
          </div>
        </div>

        {/* Class Selection */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px" }}>{t.detRecommended || "Được đề xuất"}</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
            {classOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => setSelectedClass(option.id)}
                style={{
                  border: selectedClass === option.id ? "2px solid #4f7cff" : "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "15px",
                  cursor: "pointer",
                  backgroundColor: selectedClass === option.id ? "#e8f4ff" : "#fff",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedClass !== option.id) {
                    e.currentTarget.style.borderColor = "#4f7cff";
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedClass !== option.id) {
                    e.currentTarget.style.borderColor = "#e0e0e0";
                    e.currentTarget.style.backgroundColor = "var(--bg-card)";
                  }
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>
                  {option.name}
                </div>
                
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "5px" }}>
                    <FaSuitcase style={{ color: "var(--primary)" }} />
                    <span>{t.detCarryOnLabel || "Hành lý xách tay"}: {option.luggage.carryOn}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <FaSuitcase style={{ color: "var(--primary)" }} />
                    <span>{t.detCheckedLabel || "Hành lý ký gửi"}: {option.luggage.checked}</span>
                  </div>
                </div>

                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  {option.flexibility}
                </div>

                {option.benefits && (
                  <div style={{ fontSize: "12px", color: "var(--primary)", marginBottom: "10px" }}>
                    {option.benefits.join(" · ")}
                  </div>
                )}

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--primary)" }}>
                    {option.price}
                  </div>
                  {option.originalPrice && option.originalPrice !== option.price && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                      {option.originalPrice}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div style={{
          backgroundColor: "#f9f9f9",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "15px" }}>
            {t.detPricePerPassengerTitle || "Giá khởi trình bình đối với 1 hành khách"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>{(t.detAdultTicketCount || "Vé người lớn {n} ×").replace("{n}", priceBreakdown.adult.count)}</span>
              <span>{priceBreakdown.adult.price}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginLeft: "20px", color: "var(--text-secondary)" }}>
              <span>{t.detBasePrice || "Giá"}</span>
              <span>{priceBreakdown.adult.base}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginLeft: "20px", color: "var(--text-secondary)" }}>
              <span>{t.detTaxAndFees || "Thuế & phí"}</span>
              <span>{priceBreakdown.adult.tax}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#4caf50" }}>
              <span>{t.detMomoDiscount || "Giảm giá MoMo"}</span>
              <span>- {priceBreakdown.adult.discount}</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "16px",
              fontWeight: "600",
              paddingTop: "10px",
              marginTop: "10px",
              borderTop: "1px solid #e0e0e0",
            }}>
              <span>{t.detTotalFare || "Tổng giá khởi hồi"}</span>
              <span style={{ color: "var(--primary)" }}>{priceBreakdown.total}</span>
            </div>
          </div>
        </div>

        {/* Other Benefits */}
        <div style={{
          backgroundColor: "#f0f7ff",
          borderRadius: "12px",
          padding: "15px",
          marginBottom: "20px",
          border: "1px solid #d4e4ff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <FiGift style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "14px", fontWeight: "600" }}>{t.detOtherBenefits || "Quyền lợi khác"}</span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
            <div>• {t.detAirlineMiles38 || "Dặm của hãng hàng không: ít nhất 38"}</div>
            <div>• {t.detComboBenefits || "Combo chuyến bay: ✓ Giá tốt ✓ Cam kết bảo toàn hành trình"}</div>
          </div>
          <div style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}>
            * {t.detBenefitsNote || "Có hiệu lực trước giờ khởi hành của chuyến bay đầu tiên. Không được chuyển sang chuyến bay đã đổi."}
          </div>
        </div>

        {/* Payment Methods */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "15px" }}>
            {t.detSelectPaymentMethod || "Chọn Hình Thức Thanh Toán"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px" }}>
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                onClick={() => setSelectedPayment(method.id)}
                style={{
                  border: selectedPayment === method.id ? "2px solid #4f7cff" : "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "15px",
                  cursor: "pointer",
                  backgroundColor: selectedPayment === method.id ? "#e8f4ff" : "#fff",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedPayment !== method.id) {
                    e.currentTarget.style.borderColor = "#4f7cff";
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPayment !== method.id) {
                    e.currentTarget.style.borderColor = "#e0e0e0";
                    e.currentTarget.style.backgroundColor = "var(--bg-card)";
                  }
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>
                  {method.name}
                </div>
                <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--primary)" }}>
                  {method.price}
                </div>
                {method.originalPrice !== method.price && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                    {method.originalPrice}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Hotel Promotion */}
        <div style={{
          backgroundColor: "#fff3e0",
          borderRadius: "12px",
          padding: "15px",
          marginBottom: "20px",
          border: "1px solid #ffe0b2",
        }}>
          <div style={{ fontSize: "13px", color: "#e65100", lineHeight: "1.6" }}>
            🏨 {t.detHotelPromo || "Được giảm giá đến 25% cho phòng khách sạn khi đặt vé máy bay, thêm quyền lợi miễn phí hủy phòng nếu chuyến bay bị đổi lịch"} 🚗
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: "flex",
          gap: "15px",
          justifyContent: "flex-end",
          marginTop: "20px",
          paddingTop: "20px",
          borderTop: "2px solid var(--border-light)",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              background: "var(--bg-card)",
              fontSize: "16px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
            }}
          >
            {t.detCloseBtn || "Đóng"}
          </button>
          <button
            onClick={() => {
              if (globalContact.remember) {
                passengerInfoList.forEach(pi => {
                  if (pi.type === 'ADULT' && pi.data.fullName) {
                      addPassenger({ ...pi.data, passengerType: 'ADULT' }).catch(() => {});
                  }
                });
              }
              onContinue();
            }}
            style={{
              padding: "12px 32px",
              border: "none",
              borderRadius: "8px",
              background: "var(--primary)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "var(--primary-hover)";
              e.target.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "var(--primary)";
              e.target.style.transform = "scale(1)";
            }}
          >
            {t.detContinueBtn || "Tiếp tục"} · {selectedClassData.price}
          </button>
        </div>

        {/* Small note */}
        <div style={{
          marginTop: "15px",
          fontSize: "12px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}>
          {t.detSignupNote || "Đăng ký tại đây · Khởi tốt"}
        </div>
      </div>
    </div>
  );
};

// City Selector Component
const CitySelector = ({ type, onSelect, onClose }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("vietnam");

  const countries = [
    {
      id: "vietnam",
      name: "Việt Nam",
      flag: VNFlag,
      cities: [
        { name: "Hà Nội", code: "HAN", airport: "Nội Bài", district: "Mọi sân bay" },
        { name: "TP. Hồ Chí Minh", code: "SGN", airport: "Tân Sơn Nhất", district: "Mọi sân bay" },
        { name: "Đà Nẵng", code: "DAD", airport: "Đà Nẵng", district: "Mọi sân bay" },
        { name: "Nha Trang", code: "CXR", airport: "Cam Ranh", district: "Khánh Hòa" },
        { name: "Phú Quốc", code: "PQC", airport: "Phú Quốc", district: "Kiên Giang" },
        { name: "Huế", code: "HUI", airport: "Phú Bài", district: "Thừa Thiên Huế" },
        { name: "Đà Lạt", code: "DLI", airport: "Liên Khương", district: "Lâm Đồng" },
        { name: "Cần Thơ", code: "VCA", airport: "Cần Thơ", district: "Cần Thơ" },
        { name: "Hải Phòng", code: "HPH", airport: "Cát Bi", district: "Hải Phòng" },
        { name: "Vinh", code: "VII", airport: "Vinh", district: "Nghệ An" },
      ]
    },
    {
      id: "north",
      name: "Miền Bắc",
      flag: VNFlag,
      cities: [
        { name: "Hà Nội", code: "HAN", airport: "Nội Bài", district: "Mọi sân bay" },
        { name: "Hải Phòng", code: "HPH", airport: "Cát Bi", district: "Hải Phòng" },
        { name: "Vinh", code: "VII", airport: "Vinh", district: "Nghệ An" },
        { name: "Vân Đồn", code: "VDO", airport: "Vân Đồn", district: "Quảng Ninh" },
        { name: "Điện Biên", code: "DIN", airport: "Điện Biên", district: "Điện Biên" },
      ]
    },
    {
      id: "central",
      name: "Miền Trung",
      flag: VNFlag,
      cities: [
        { name: "Đà Nẵng", code: "DAD", airport: "Đà Nẵng", district: "Mọi sân bay" },
        { name: "Nha Trang", code: "CXR", airport: "Cam Ranh", district: "Khánh Hòa" },
        { name: "Huế", code: "HUI", airport: "Phú Bài", district: "Thừa Thiên Huế" },
        { name: "Quy Nhơn", code: "UIH", airport: "Phù Cát", district: "Bình Định" },
        { name: "Đà Lạt", code: "DLI", airport: "Liên Khương", district: "Lâm Đồng" },
        { name: "Tuy Hòa", code: "TBB", airport: "Tuy Hòa", district: "Phú Yên" },
      ]
    },
    {
      id: "south",
      name: "Miền Nam",
      flag: VNFlag,
      cities: [
        { name: "TP. Hồ Chí Minh", code: "SGN", airport: "Tân Sơn Nhất", district: "Mọi sân bay" },
        { name: "Phú Quốc", code: "PQC", airport: "Phú Quốc", district: "Kiên Giang" },
        { name: "Cần Thơ", code: "VCA", airport: "Cần Thơ", district: "Cần Thơ" },
        { name: "Rạch Giá", code: "VKG", airport: "Rạch Giá", district: "Kiên Giang" },
        { name: "Côn Đảo", code: "VCS", airport: "Côn Đảo", district: "Bà Rịa - Vũng Tàu" },
      ]
    },
  ];

  const currentCountry = countries.find(c => c.id === activeTab);

  const countryNameMap = {
    vietnam: t.vietnam,
    north: t.northVietnam,
    central: t.centralVietnam,
    south: t.southVietnam
  };
  
  const filteredCities = currentCountry?.cities.filter(city =>
    city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    city.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    city.airport.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
    }} onClick={onClose}>
      <div style={{
        width: "600px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "16px",
        padding: "20px",
        maxHeight: "80vh",
        overflow: "hidden",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
            {type === "from" ? t.selectDeparture : t.selectDestination}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <FiX size={24} />
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px",
          backgroundColor: "var(--bg-hover)",
          borderRadius: "8px",
          marginBottom: "20px",
        }}>
          <FiSearch style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder={t.searchCity}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: "none",
              background: "none",
              outline: "none",
              width: "100%",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Country Tabs */}
        <div style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "5px",
        }}>
          {countries.map(country => (
            <button
              key={country.id}
              onClick={() => setActiveTab(country.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                border: activeTab === country.id ? "2px solid #4f7cff" : "1px solid #ddd",
                borderRadius: "20px",
                background: activeTab === country.id ? "#e8f4ff" : "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== country.id) {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== country.id) {
                  e.currentTarget.style.backgroundColor = "var(--bg-card)";
                }
              }}
            >
              <img src={country.flag} alt={countryNameMap[country.id] || country.name} style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
              <span style={{ fontSize: "14px", fontWeight: activeTab === country.id ? "600" : "400" }}>
                {countryNameMap[country.id] || country.name}
              </span>
            </button>
          ))}
        </div>

        {/* Cities List */}
        <div style={{
          maxHeight: "400px",
          overflowY: "auto",
        }}>
          {filteredCities?.map((city, index) => (
            <div
              key={index}
              onClick={() => onSelect(city)}
              style={{
                padding: "12px",
                borderBottom: "1px solid var(--border-light)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.transform = "translateX(5px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-main)" }}>{city.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    {city.airport} ({city.code}) · {city.district}
                  </div>
                </div>
                <div style={{ 
                  fontSize: "14px", 
                  color: "var(--primary)", 
                  fontWeight: "500",
                  opacity: 0,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                >
                  {t.detSelectArrow || "Chọn →"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Passenger and Class Selector Component
const PassengerClassSelector = ({ onClose, onSelect, initialPassengers, initialClass }) => {
  const { t } = useLanguage();
  const [passengers, setPassengers] = useState(initialPassengers || {
    adult: 1,
    child: 0,
    infant: 0
  });
  const [selectedClass, setSelectedClass] = useState(initialClass || "economy");

  const classOptions = [
    { id: "economy", label: t.economy, price: "2.566.000₫", icon: "Y" },
    { id: "premium", label: t.premium, price: "3.120.000₫", icon: "W" },
    { id: "business", label: t.business, price: "5.890.000₫", icon: "J" },
    { id: "first", label: t.first, price: "8.450.000₫", icon: "F" },
  ];

  const updatePassenger = (type, increment) => {
    setPassengers(prev => {
      const newValue = increment ? prev[type] + 1 : Math.max(0, prev[type] - 1);
      const total = Object.values({...prev, [type]: newValue}).reduce((a, b) => a + b, 0);
      if (total > 9) return prev;
      return { ...prev, [type]: newValue };
    });
  };

  const handleApply = () => {
    onSelect({ passengers, selectedClass });
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
    }} onClick={onClose}>
      <div style={{
        width: "400px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{t.detSelectPassengerClass || "Chọn hành khách & hạng vé"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <FiX size={24} />
          </button>
        </div>

        {/* Passengers */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "15px" }}>{t.detNumPassengers || "Số hành khách"}</h4>
          
          {/* Adult */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
          }}>
            <div>
              <div style={{ fontWeight: "500" }}>{t.adult}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.ageAdultHint}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <button
                onClick={() => updatePassenger('adult', false)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: passengers.adult > 1 ? "#fff" : "#f5f5f5",
                  cursor: passengers.adult > 1 ? "pointer" : "not-allowed",
                  fontSize: "18px",
                }}
              >-</button>
              <span style={{ fontSize: "16px", fontWeight: "600", minWidth: "20px", textAlign: "center" }}>
                {passengers.adult}
              </span>
              <button
                onClick={() => updatePassenger('adult', true)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >+</button>
            </div>
          </div>

          {/* Child */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
          }}>
            <div>
              <div style={{ fontWeight: "500" }}>{t.child}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.ageChildHint}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <button
                onClick={() => updatePassenger('child', false)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: passengers.child > 0 ? "#fff" : "#f5f5f5",
                  cursor: passengers.child > 0 ? "pointer" : "not-allowed",
                  fontSize: "18px",
                }}
              >-</button>
              <span style={{ fontSize: "16px", fontWeight: "600", minWidth: "20px", textAlign: "center" }}>
                {passengers.child}
              </span>
              <button
                onClick={() => updatePassenger('child', true)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >+</button>
            </div>
          </div>

          {/* Infant */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
          }}>
            <div>
              <div style={{ fontWeight: "500" }}>{t.infant}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.ageInfantHint}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <button
                onClick={() => updatePassenger('infant', false)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: passengers.infant > 0 ? "#fff" : "#f5f5f5",
                  cursor: passengers.infant > 0 ? "pointer" : "not-allowed",
                  fontSize: "18px",
                }}
              >-</button>
              <span style={{ fontSize: "16px", fontWeight: "600", minWidth: "20px", textAlign: "center" }}>
                {passengers.infant}
              </span>
              <button
                onClick={() => updatePassenger('infant', true)}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >+</button>
            </div>
          </div>
        </div>

        {/* Class */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "15px" }}>{t.class}</h4>
          <div style={{ display: "grid", gap: "10px" }}>
            {classOptions.map(option => (
              <div
                key={option.id}
                onClick={() => setSelectedClass(option.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  border: selectedClass === option.id ? "2px solid #4f7cff" : "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: selectedClass === option.id ? "#e8f4ff" : "#fff",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedClass !== option.id) {
                    e.currentTarget.style.borderColor = "#4f7cff";
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedClass !== option.id) {
                    e.currentTarget.style.borderColor = "#ddd";
                    e.currentTarget.style.backgroundColor = "var(--bg-card)";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "30px",
                    height: "30px",
                    backgroundColor: selectedClass === option.id ? "#4f7cff" : "#ddd",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}>
                    {option.icon}
                  </div>
                  <span style={{ fontWeight: "500" }}>{option.label}</span>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: "600" }}>{option.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApply}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "var(--primary-hover)";
            e.target.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "var(--primary)";
            e.target.style.transform = "scale(1)";
          }}
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
};

// Date Selector Component
const DateSelector = ({ onClose, onSelect, initialDates }) => {
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDeparture, setSelectedDeparture] = useState(initialDates?.departure || null);
  const [selectedReturn, setSelectedReturn] = useState(initialDates?.return || null);

  const months = Array.from({ length: 12 }, (_, i) =>
    (t.detMonthName || "Tháng {n}").replace("{n}", i + 1)
  );

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    // Thêm ngày trống đầu tháng (điều chỉnh cho thứ 2 là đầu tuần)
    let firstDayOfWeek = firstDay.getDay();
    // Chuyển đổi: 0 (CN) -> 6, 1 (T2) -> 0, 2 (T3) -> 1, ...
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    // Thêm ngày trong tháng
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateSelect = (date) => {
    if (!selectedDeparture || (selectedDeparture && selectedReturn)) {
      setSelectedDeparture(date);
      setSelectedReturn(null);
    } else if (date > selectedDeparture) {
      setSelectedReturn(date);
    } else {
      setSelectedDeparture(date);
      setSelectedReturn(null);
    }
  };

  const handleApply = () => {
    if (selectedDeparture) {
      onSelect({
        departure: selectedDeparture,
        return: selectedReturn
      });
      onClose();
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    const days = (t.detWeekdayShort || "T2,T3,T4,T5,T6,T7,CN").split(",");
    const monthAbbr = t.detMonthShort || "thg";
    return `${days[date.getDay() === 0 ? 6 : date.getDay() - 1]}, ${date.getDate()} ${monthAbbr} ${date.getMonth() + 1}`;
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
    }} onClick={onClose}>
      <div style={{
        width: "700px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{t.detSelectFlightDate || "Chọn ngày bay"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <FiX size={24} />
          </button>
        </div>

        {/* Selected Dates Display */}
        <div style={{
          display: "flex",
          gap: "20px",
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "var(--bg-hover)",
          borderRadius: "8px",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t.detOutboundLeg || "Chiều đi"}</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: selectedDeparture ? "#333" : "#999" }}>
              {selectedDeparture ? formatDate(selectedDeparture) : (t.detSelectDepartDate || "Chọn ngày đi")}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t.detInboundLeg || "Chiều về"}</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: selectedReturn ? "#333" : "#999" }}>
              {selectedReturn ? formatDate(selectedReturn) : (t.detSelectReturnDateOpt || "Chọn ngày về (nếu có)")}
            </div>
          </div>
        </div>

        {/* Month Navigation */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
            style={{
              padding: "8px",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              background: "var(--bg-card)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
            }}
          >
            <IoIosArrowBack />
          </button>
          <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
            style={{
              padding: "8px",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              background: "var(--bg-card)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
            }}
          >
            <IoIosArrowForward />
          </button>
        </div>

        {/* Calendar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "5px",
          marginBottom: "20px",
        }}>
          {(t.detWeekdayShort || "T2,T3,T4,T5,T6,T7,CN").split(",").map(day => (
            <div key={day} style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)", padding: "8px" }}>
              {day}
            </div>
          ))}
          {days.map((date, index) => (
            <div
              key={index}
              onClick={() => date && handleDateSelect(date)}
              style={{
                padding: "10px",
                textAlign: "center",
                backgroundColor: date ? (
                  (selectedDeparture && date.toDateString() === selectedDeparture.toDateString()) ||
                  (selectedReturn && date.toDateString() === selectedReturn.toDateString())
                ) ? "#4f7cff" : (
                  (selectedDeparture && selectedReturn && date > selectedDeparture && date < selectedReturn) ? "#e8f4ff" : "#fff"
                ) : "transparent",
                color: date ? (
                  (selectedDeparture && date.toDateString() === selectedDeparture.toDateString()) ||
                  (selectedReturn && date.toDateString() === selectedReturn.toDateString())
                ) ? "#fff" : "#333" : "transparent",
                borderRadius: "8px",
                cursor: date ? "pointer" : "default",
                border: date && date.toDateString() === new Date().toDateString() ? "1px solid #4f7cff" : "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (date && !(
                  (selectedDeparture && date.toDateString() === selectedDeparture.toDateString()) ||
                  (selectedReturn && date.toDateString() === selectedReturn.toDateString())
                )) {
                  e.currentTarget.style.backgroundColor = "var(--bg-tag)";
                }
              }}
              onMouseLeave={(e) => {
                if (date && !(
                  (selectedDeparture && date.toDateString() === selectedDeparture.toDateString()) ||
                  (selectedReturn && date.toDateString() === selectedReturn.toDateString())
                )) {
                  if (selectedDeparture && selectedReturn && date > selectedDeparture && date < selectedReturn) {
                    e.currentTarget.style.backgroundColor = "#e8f4ff";
                  } else {
                    e.currentTarget.style.backgroundColor = "var(--bg-card)";
                  }
                }
              }}
            >
              {date?.getDate()}
            </div>
          ))}
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApply}
          disabled={!selectedDeparture}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: selectedDeparture ? "#4f7cff" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: selectedDeparture ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (selectedDeparture) {
              e.target.style.backgroundColor = "var(--primary-hover)";
              e.target.style.transform = "scale(1.02)";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedDeparture) {
              e.target.style.backgroundColor = "var(--primary)";
              e.target.style.transform = "scale(1)";
            }
          }}
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
};

// Main Component
const AirlineTicketsDetail = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("oneWay");
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [showPassengerSelector, setShowPassengerSelector] = useState(false);
  const [showBookingDetail, setShowBookingDetail] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectorType, setSelectorType] = useState(null);
  const [priceWeekOffset, setPriceWeekOffset] = useState(0);

  // State cho điểm đi và đến
  const [fromCity, setFromCity] = useState({
    name: "TP. Hồ Chí Minh",
    code: "SGN",
    airport: "Tân Sơn Nhất",
    district: "Mọi sân bay"
  });

  const [toCity, setToCity] = useState({
    name: "Hà Nội",
    code: "HAN",
    airport: "Nội Bài",
    district: "Mọi sân bay"
  });

  // State cho ngày bay
  const [flightDates, setFlightDates] = useState({
    departure: new Date(2024, 2, 11), // 11/03/2024
    return: new Date(2024, 2, 13)      // 13/03/2024
  });

  // State cho hành khách và hạng vé
  const [passengerInfo, setPassengerInfo] = useState({
    passengers: {
      adult: 1,
      child: 0,
      infant: 0
    },
    selectedClass: "economy"
  });

  const classLabels = {
    economy: t.economy,
    premium: t.premium,
    business: t.business,
    first: t.first
  };

  // Format date function
  const formatDate = (date) => {
    const days = (t.detWeekdayShort || "T2,T3,T4,T5,T6,T7,CN").split(",");
    const monthAbbr = t.detMonthShort || "thg";
    return `${days[date.getDay() === 0 ? 6 : date.getDay() - 1]}, ${date.getDate()} ${monthAbbr} ${date.getMonth() + 1}`;
  };

  const handleCitySelect = (city) => {
    if (selectorType === "from") {
      setFromCity(city);
    } else {
      setToCity(city);
    }
    setShowCitySelector(false);
  };

  const handleDateSelect = (dates) => {
    setFlightDates(dates);
    // Tìm và chọn ngày tương ứng trong bảng giá
    if (dates.departure) {
      const departureDate = dates.departure;
      // Tìm index của ngày trong priceDates dựa trên ngày tháng
      const foundIndex = priceDates.findIndex(item => {
        const itemDate = item.fullDate;
        return itemDate.getDate() === departureDate.getDate() && 
               itemDate.getMonth() === departureDate.getMonth();
      });
      if (foundIndex !== -1) {
        setSelectedDate(foundIndex);
      }
    }
  };

  const handlePassengerSelect = (info) => {
    setPassengerInfo(info);
  };

  const handleFlightSelect = (flight) => {
    setSelectedFlight(flight);
    setShowBookingDetail(true);
  };

  const handleContinueBooking = () => {
    // Xử lý tiếp tục đặt vé
    console.log("Tiếp tục với chuyến bay:", selectedFlight);
    setShowBookingDetail(false);
  };

  const getTotalPassengers = () => {
    const { adult, child, infant } = passengerInfo.passengers;
    return adult + child + infant;
  };

  const tabs = [
    { id: "oneWay", label: t.oneWay },
    { id: "roundTrip", label: `${t.roundTrip} (${t.underMaintenance})`, isMaintenance: true },
    { id: "multiCity", label: t.multiCity },
  ];

  const flightOptions = [
    { id: 1, label: t.directFlightRoute, count: 120 },
    { id: 2, label: t.detHasCheckedBaggage || "Có hành lý ký gửi", count: 85 },
    { id: 3, label: t.detLowCostMeals || "Ăn các hãng hàng không giá rẻ", count: 45 },
  ];

  const airlines = [
    { name: "Vietjet Airlines", count: 71, price: "2.914.000₫", logo: "VJ" },
    { name: "VietJet Air", count: 33, price: "2.566.000₫", logo: "VJ" },
    { name: "Vietnam Airlines", count: 45, price: "3.120.000₫", logo: "VN" },
    { name: "Bamboo Airways", count: 28, price: "3.050.000₫", logo: "QH" },
    { name: "Japan Airlines", count: 25, price: "5.120.000₫", logo: "JL" },
    { name: "ANA", count: 20, price: "5.350.000₫", logo: "NH" },
    { name: "EVA Air", count: 15, price: "4.890.000₫", logo: "BR" },
    { name: "British Airways", count: 18, price: "6.120.000₫", logo: "BA" },
  ];

  const alliances = [
    { name: "SkyTeam", price: "2.914.000₫" },
    { name: "Star Alliance", price: "3.120.000₫" },
    { name: "OneWorld", price: "3.250.000₫" },
  ];

  const generatePriceDates = (offset) => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (offset * 14));
    
    const prices = [];
    const basePrice = 2500000;
    
    for (let i = 0; i < 14; i++) {
      const startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() + i);
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 2);
      
      const formatDate = (date) => {
        return `${date.getDate()}/${date.getMonth() + 1}`;
      };
      
      const priceVariance = ((i * 137 + Math.abs(offset) * 97) % 50) * 10000 - 250000;
      const randomPrice = basePrice + priceVariance;
      const formattedPrice = randomPrice.toLocaleString('vi-VN') + '₫';
      
      prices.push({
        date: `${formatDate(startDate)}–${formatDate(endDate)}`,
        fullDate: startDate,
        price: formattedPrice,
        rawPrice: randomPrice
      });
    }
    
    return prices;
  };

  const [priceDates, setPriceDates] = useState(generatePriceDates(0));

  const handlePrevWeek = () => {
    const newOffset = priceWeekOffset - 1;
    setPriceWeekOffset(newOffset);
    const newPriceDates = generatePriceDates(newOffset);
    setPriceDates(newPriceDates);
    
    // Reset selected date khi chuyển tuần
    setSelectedDate(null);
  };

  const handleNextWeek = () => {
    const newOffset = priceWeekOffset + 1;
    setPriceWeekOffset(newOffset);
    const newPriceDates = generatePriceDates(newOffset);
    setPriceDates(newPriceDates);
    
    // Reset selected date khi chuyển tuần
    setSelectedDate(null);
  };

  const getWeekRange = () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (priceWeekOffset * 14));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13);
    
    const formatDate = (date) => {
      return `${(t.detMonthShortCap || "Thg {n}").replace("{n}", date.getMonth() + 1)}, ${date.getDate()}`;
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const flights = [
    {
      departure: "05:20",
      departureAirport: `${fromCity.code} T1`,
      arrival: "07:30",
      arrivalAirport: `${toCity.code} T1`,
      duration: "2g 10p",
      type: t.directFlightRoute,
      price: "2.566.000₫",
      airline: "VietJet Air",
      luggage: "20kg",
      meals: true,
      wifi: false,
    },
    {
      departure: "05:30",
      departureAirport: `${fromCity.code} T1`,
      arrival: "07:40",
      arrivalAirport: `${toCity.code} T1`,
      duration: "2g 10p",
      type: t.directFlightRoute,
      price: "2.566.000₫",
      airline: "VietJet Air",
      luggage: "20kg",
      meals: true,
      wifi: false,
    },
    {
      departure: "05:40",
      departureAirport: `${fromCity.code} T1`,
      arrival: "07:50",
      arrivalAirport: `${toCity.code} T1`,
      duration: "2g 10p",
      type: t.directFlightRoute,
      price: "2.566.000₫",
      airline: "VietJet Air",
      luggage: "20kg",
      meals: true,
      wifi: false,
    },
    {
      departure: "08:00",
      departureAirport: `${fromCity.code} T2`,
      arrival: "10:30",
      arrivalAirport: `NRT T1`,
      duration: "4g 30p",
      type: t.directFlightRoute,
      price: "5.890.000₫",
      airline: "Japan Airlines",
      luggage: "30kg",
      meals: true,
      wifi: true,
    },
    {
      departure: "09:15",
      departureAirport: `${fromCity.code} T1`,
      arrival: "12:45",
      arrivalAirport: `TPE T2`,
      duration: "3g 30p",
      type: t.directFlightRoute,
      price: "4.250.000₫",
      airline: "EVA Air",
      luggage: "25kg",
      meals: true,
      wifi: true,
    },
  ];

  return (
    <div style={{
      marginTop: "var(--header-height)",
      padding: "20px 30px",
      backgroundColor: "var(--bg-hover)",
      minHeight: "calc(100vh - var(--header-height))",
    }}>
      {/* Header Tabs */}
      <div style={{
        display: "flex",
        gap: "20px",
        marginBottom: "20px",
        borderBottom: "2px solid #e0e0e0",
        paddingBottom: "10px",
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.isMaintenance) {
                const now = Date.now();
                if (!window._lastMaintenanceToast || now - window._lastMaintenanceToast > 3000) {
                  window._lastMaintenanceToast = now;
                  showToast(t.roundTripMaintenanceMsg, "warning");
                }
                return;
              }
              setActiveTab(tab.id);
            }}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "none",
              fontSize: "16px",
              fontWeight: activeTab === tab.id ? "600" : "400",
              color: activeTab === tab.id ? "#4f7cff" : tab.isMaintenance ? "#94a3b8" : "#666",
              borderBottom: activeTab === tab.id ? "3px solid #4f7cff" : "none",
              cursor: tab.isMaintenance ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: tab.isMaintenance ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id && !tab.isMaintenance) {
                e.currentTarget.style.color = "#4f7cff";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id && !tab.isMaintenance) {
                e.currentTarget.style.color = "#666";
              }
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <button 
            style={{ 
              padding: "8px 16px", 
              border: "1px solid var(--border-input)", 
              borderRadius: "20px", 
              background: "var(--bg-card)", 
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
              e.currentTarget.style.borderColor = "#999";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
              e.currentTarget.style.borderColor = "#ddd";
            }}
          >
            {t.directFlightRoute}
          </button>
        </div>
      </div>

      {/* Search Summary - Clickable with hover effects */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "30px",
        marginBottom: "20px",
        padding: "15px 20px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        {/* From City */}
        <div 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px", 
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: "8px",
            transition: "all 0.2s",
            position: "relative",
          }}
          onClick={() => {
            setSelectorType("from");
            setShowCitySelector(true);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <MdFlightTakeoff style={{ color: "var(--primary)", fontSize: "20px" }} />
          <div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "500" }}>{fromCity.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{fromCity.airport} ({fromCity.code})</div>
          </div>
        </div>
        
        {/* Arrow Icon */}
        <GiCommercialAirplane style={{ color: "#ccc", fontSize: "24px", transform: "rotate(90deg)" }} />
        
        {/* To City */}
        <div 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px", 
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: "8px",
            transition: "all 0.2s",
          }}
          onClick={() => {
            setSelectorType("to");
            setShowCitySelector(true);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <MdFlightLand style={{ color: "var(--primary)", fontSize: "20px" }} />
          <div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "500" }}>{toCity.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{toCity.airport} ({toCity.code})</div>
          </div>
        </div>

        {/* Dates */}
        <div 
          style={{ 
            display: "flex", 
            gap: "15px", 
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onClick={() => setShowDateSelector(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <FiCalendar style={{ color: "var(--primary)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "500" }}>{formatDate(flightDates.departure)}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{formatDate(flightDates.return)}</div>
          </div>
        </div>

        {/* Passengers and Class */}
        <div 
          style={{ 
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderLeft: "1px solid #ddd", 
            paddingLeft: "15px",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onClick={() => setShowPassengerSelector(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <FaUserFriends style={{ color: "var(--primary)" }} />
          <div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "500" }}>
              {getTotalPassengers()} {t.detPersonUnit || "người"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {classLabels[passengerInfo.selectedClass]}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCitySelector && (
        <CitySelector
          type={selectorType}
          onSelect={handleCitySelect}
          onClose={() => setShowCitySelector(false)}
        />
      )}

      {showDateSelector && (
        <DateSelector
          onSelect={handleDateSelect}
          onClose={() => setShowDateSelector(false)}
          initialDates={flightDates}
        />
      )}

      {showPassengerSelector && (
        <PassengerClassSelector
          onSelect={handlePassengerSelect}
          onClose={() => setShowPassengerSelector(false)}
          initialPassengers={passengerInfo.passengers}
          initialClass={passengerInfo.selectedClass}
        />
      )}

      {showBookingDetail && (
        <FlightBookingDetail
          flightData={selectedFlight}
          onClose={() => setShowBookingDetail(false)}
          onContinue={handleContinueBooking} passengerCounts={passengerInfo.passengers}
        />
      )}

      {/* Price Calendar */}
      <div style={{
        marginBottom: "20px",
        padding: "20px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "15px" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{t.detPriceTable || "Bảng giá"}</h3>
            <span style={{ fontSize: "14px", color: "var(--primary)", background: "#e8f4ff", padding: "4px 8px", borderRadius: "4px" }}>
              {getWeekRange()}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={handlePrevWeek}
              style={{ 
                padding: "5px 10px", 
                border: "1px solid var(--border-input)", 
                borderRadius: "5px", 
                background: "var(--bg-card)", 
                cursor: "pointer",
                opacity: priceWeekOffset > 0 ? 1 : 0.5,
                transition: "all 0.2s",
              }}
              disabled={priceWeekOffset <= 0}
              onMouseEnter={(e) => {
                if (priceWeekOffset > 0) {
                  e.currentTarget.style.backgroundColor = "var(--bg-tag)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-card)";
              }}
            >
              <IoIosArrowBack />
            </button>
            <button 
              onClick={handleNextWeek}
              style={{ 
                padding: "5px 10px", 
                border: "1px solid var(--border-input)", 
                borderRadius: "5px", 
                background: "var(--bg-card)", 
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-tag)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-card)";
              }}
            >
              <IoIosArrowForward />
            </button>
          </div>
        </div>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)", 
          gap: "10px",
          marginBottom: "10px",
        }}>
          {(t.detWeekdayShort || "T2,T3,T4,T5,T6,T7,CN").split(",").map(day => (
            <div key={day} style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              {day}
            </div>
          ))}
        </div>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)", 
          gap: "10px",
        }}>
          {priceDates.map((item, index) => (
            <div
              key={index}
              style={{
                padding: "10px",
                backgroundColor: selectedDate === index ? "#e8f4ff" : "#f9f9f9",
                borderRadius: "8px",
                textAlign: "center",
                cursor: "pointer",
                border: selectedDate === index ? "2px solid #4f7cff" : "1px solid #eee",
                transition: "all 0.2s",
              }}
              onClick={() => setSelectedDate(index)}
              onMouseEnter={(e) => {
                if (selectedDate !== index) {
                  e.currentTarget.style.backgroundColor = "var(--bg-tag)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDate !== index) {
                  e.currentTarget.style.backgroundColor = "#f9f9f9";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-main)" }}>
                {item.date.split('–')[0]}
              </div>
              <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: "600" }}>{item.price}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          fontSize: "13px",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}>
          <FiInfo style={{ marginRight: "5px", verticalAlign: "middle" }} />
          {t.detRoundTripPriceNote || "Giá hiển thị là giá khứ hồi cho 1 người lớn, đã bao gồm thuế và phí"}
        </div>
      </div>

      {/* Main Content with Filters */}
      <div style={{ display: "flex", gap: "20px" }}>
        {/* Left Filters */}
        <div style={{ width: "280px" }}>
          {/* Recommended Section */}
          <div style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
            padding: "15px",
            marginBottom: "15px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            <h4 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "600" }}>{t.detRecommended || "Được đề xuất"}</h4>
            {flightOptions.map((option, index) => (
              <div key={index} style={{ marginBottom: "10px" }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  cursor: "pointer",
                  padding: "5px",
                  borderRadius: "4px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <input type="checkbox" style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{option.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)" }}>({option.count})</span>
                </label>
              </div>
            ))}
          </div>

          {/* Airlines */}
          <div style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
            padding: "15px",
            marginBottom: "15px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            <h4 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "600" }}>{t.detAirlines || "Hãng hàng không"}</h4>
            {airlines.map((airline, index) => (
              <div key={index} style={{ marginBottom: "12px" }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  cursor: "pointer",
                  padding: "5px",
                  borderRadius: "4px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <input type="checkbox" style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                    <div style={{
                      width: "30px",
                      height: "30px",
                      backgroundColor: "var(--primary)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}>
                      {airline.logo}
                    </div>
                    <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{airline.name}</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--primary)" }}>{airline.price}</span>
                </label>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "46px" }}>{(t.detFlightsCount || "{n} chuyến").replace("{n}", airline.count)}</div>
              </div>
            ))}
          </div>

          {/* Alliances */}
          <div style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
            padding: "15px",
            marginBottom: "15px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            <h4 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "600" }}>{t.detAlliances || "Liên minh"}</h4>
            {alliances.map((alliance, index) => (
              <div key={index} style={{ marginBottom: "10px" }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  cursor: "pointer",
                  padding: "5px",
                  borderRadius: "4px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <input type="checkbox" style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{alliance.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: "500", color: "var(--primary)" }}>{alliance.price}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Right Content - Flight List */}
        <div style={{ flex: 1 }}>
          {/* Sort Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            padding: "15px",
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
            marginBottom: "15px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            <button style={{ 
              padding: "6px 12px", 
              border: "1px solid #4f7cff", 
              borderRadius: "20px", 
              background: "#e8f4ff", 
              color: "var(--primary)", 
              fontSize: "13px", 
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#e8f4ff";
              e.currentTarget.style.color = "#4f7cff";
            }}
            >
              {t.detPreferDirect || "Ưu tiên bay thẳng"}
            </button>
            <button style={{ 
              padding: "6px 12px", 
              border: "1px solid var(--border-input)", 
              borderRadius: "20px", 
              background: "var(--bg-card)", 
              fontSize: "13px", 
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
              e.currentTarget.style.borderColor = "#999";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
              e.currentTarget.style.borderColor = "#ddd";
            }}
            >
              {t.detSuggested || "Đề xuất"}
            </button>
            <button style={{ 
              padding: "6px 12px", 
              border: "1px solid var(--border-input)", 
              borderRadius: "20px", 
              background: "var(--bg-card)", 
              fontSize: "13px", 
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
              e.currentTarget.style.borderColor = "#999";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
              e.currentTarget.style.borderColor = "#ddd";
            }}
            >
              {t.detCheapest || "Rẻ nhất"}
            </button>
            <div style={{ 
              marginLeft: "auto", 
              display: "flex", 
              alignItems: "center", 
              gap: "5px", 
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: "20px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{t.detSortBy || "Sắp xếp theo"}</span>
              <FiChevronDown />
            </div>
            <button style={{ 
              padding: "6px 12px", 
              border: "1px solid var(--border-input)", 
              borderRadius: "20px", 
              background: "var(--bg-card)", 
              fontSize: "13px", 
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tag)";
              e.currentTarget.style.borderColor = "#999";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-card)";
              e.currentTarget.style.borderColor = "#ddd";
            }}
            >
              {t.detPriceAlert || "Tạo thông báo giá"}
            </button>
          </div>

          {/* Flight Cards */}
          {flights.map((flight, index) => {
            const airlineInitials = (flight.airline || "VN")
              .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const airlineColors = {
              "VJ": "#e3001b", "VN": "#005baa", "BB": "#f7941d",
              "QH": "#00843d", "VU": "#7b2d8b", "VB": "#ff6600",
            };
            const logoColor = airlineColors[airlineInitials] || "#4f7cff";

            return (
              <div
                key={index}
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1.5px solid var(--border-light)",
                  borderRadius: "16px",
                  padding: "18px 22px",
                  marginBottom: "15px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(79,124,255,0.14)";
                  e.currentTarget.style.borderColor = "#4f7cff55";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                  e.currentTarget.style.borderColor = "var(--border-light)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Airline logo circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `linear-gradient(135deg,${logoColor}22,${logoColor}44)`,
                    border: `2px solid ${logoColor}55`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: logoColor, lineHeight: 1 }}>
                      {airlineInitials}
                    </span>
                    <span style={{ fontSize: 8, color: logoColor + "bb", fontWeight: 600, marginTop: 2 }}>
                      AIRLINE
                    </span>
                  </div>

                  {/* Provider name */}
                  <div style={{ minWidth: 100, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                      {flight.airline}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {t.commercialFlight}
                    </div>
                  </div>

                  {/* Separator */}
                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Time + route block */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Departure */}
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                        {flight.departure}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                        {flight.departureAirport}
                      </div>
                    </div>

                    {/* Route line */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 80 }}>
                      <div style={{
                        fontSize: 11, color: "#4f7cff", fontWeight: 700,
                        background: "#e8f0ff", padding: "2px 10px", borderRadius: 20,
                      }}>
                        ⏱ {flight.duration}
                      </div>
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#4f7cff44,#4f7cff)" }} />
                        <span style={{ fontSize: 14, color: "#4f7cff" }}>✈</span>
                        <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#4f7cff,#4f7cff44)" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{flight.type}</div>
                    </div>

                    {/* Arrival */}
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                        {flight.arrival}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                        {flight.arrivalAirport}
                      </div>
                    </div>
                  </div>

                  {/* Separator */}
                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Amenities */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    <FaSuitcase style={{ color: "#4f7cff", fontSize: 16 }} title={t.checkedBaggage || "Hành lý kí gửi"} />
                    <FaUtensils style={{ color: flight.meals ? "#4f7cff" : "#ccc", fontSize: 16 }} title={t.meal} />
                    <FaWifi style={{ color: flight.wifi ? "#4f7cff" : "#ccc", fontSize: 16 }} title="Wifi" />
                  </div>

                  {/* Separator */}
                  <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                  {/* Price + CTA */}
                  <div style={{ textAlign: "center", minWidth: 130, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.pricePerPerson}</div>
                    <div style={{
                      fontSize: 22, fontWeight: 900,
                      background: "linear-gradient(135deg,#f97316,#ef4444)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      lineHeight: 1,
                      marginBottom: 8,
                    }}>
                      {flight.price}
                    </div>
                    <button
                      onClick={() => handleFlightSelect(flight)}
                      style={{
                        background: "linear-gradient(135deg,#4f7cff,#6a3de8)",
                        color: "#fff", border: "none",
                        padding: "8px 22px", borderRadius: 10,
                        fontWeight: 700, fontSize: 14, cursor: "pointer",
                        width: "100%",
                        boxShadow: "0 4px 12px rgba(79,124,255,0.35)",
                        transition: "all 0.2s",
                      }}
                    >
                      {t.detChoose || "Chọn"} {activeTab === "roundTrip" ? t.roundTrip : t.oneWay}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AirlineTicketsDetail;