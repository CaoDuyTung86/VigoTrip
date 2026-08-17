import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { FiInfo, FiChevronDown, FiChevronUp, FiClock, FiCalendar, FiGift } from "react-icons/fi";
import { FaSuitcase, FaUtensils, FaWifi, FaUserFriends, FaChair, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { MdFlightTakeoff, MdFlightLand } from "react-icons/md";
import { GiCommercialAirplane } from "react-icons/gi";
import { IoIosArrowForward } from "react-icons/io";

const FlightBookingDetail = ({ flightData, onClose, onContinue }) => {
  const { t } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("economy");
  const [selectedPayment, setSelectedPayment] = useState("momo");

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
      name: t.fbClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.fbOnePiece || "1 kiện",
        checked: t.fbNoneYet || "Chưa có"
      },
      flexibility: t.fbNonRefundable || "Không hoàn",
      price: "2.031.000₫",
      originalPrice: "2.053.000₫",
      benefits: [(t.fbMilesAtLeast || "Dặm: ít nhất {n}").replace("{n}", "38"), t.fbComboGoodPrice || "Combo chuyến bay: ✓ Giá tốt"]
    },
    {
      id: "economyPlus",
      name: t.fbClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.fbOnePiece || "1 kiện",
        checked: t.fbNoneYet || "Chưa có"
      },
      flexibility: "TripFlex · EasyCancel Plus",
      benefits: [t.fbFourBenefits || "4 quyền lợi", t.fbFreeCancelFee || "Phí hủy: Miễn phí"],
      price: "2.053.000₫",
      originalPrice: "2.694.000₫"
    },
    {
      id: "economyLuggage",
      name: t.fbClassEconomy || "Hạng Phổ Thông",
      luggage: {
        carryOn: t.fbOnePiece || "1 kiện",
        checked: "30 kg"
      },
      flexibility: t.fbNonRefundable || "Không hoàn",
      price: "2.694.000₫",
      originalPrice: "2.722.000₫",
      benefits: [(t.fbMilesAtLeast || "Dặm: ít nhất {n}").replace("{n}", "68")]
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
      name: t.fbAnyMethod || "Bất Kỳ",
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
              {t.fbOutboundLeg || "Chiều đi"} · <span style={{ color: "var(--primary)" }}>{data.departureDate}</span>
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
              {t.fbInboundLeg || "Chiều về"} · <span style={{ color: "var(--primary)" }}>{data.returnDate}</span>
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
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px" }}>{t.fbRecommended || "Được đề xuất"}</h3>
          
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
                    <span>{t.fbCarryOnLabel || "Hành lý xách tay"}: {option.luggage.carryOn}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <FaSuitcase style={{ color: "var(--primary)" }} />
                    <span>{t.fbCheckedLabel || "Hành lý ký gửi"}: {option.luggage.checked}</span>
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
            {t.fbPricePerPassengerTitle || "Giá khởi trình bình đối với 1 hành khách"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>{(t.fbAdultTicketCount || "Vé người lớn {n} ×").replace("{n}", priceBreakdown.adult.count)}</span>
              <span>{priceBreakdown.adult.price}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginLeft: "20px", color: "var(--text-secondary)" }}>
              <span>{t.fbBasePrice || "Giá"}</span>
              <span>{priceBreakdown.adult.base}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginLeft: "20px", color: "var(--text-secondary)" }}>
              <span>{t.fbTaxAndFees || "Thuế & phí"}</span>
              <span>{priceBreakdown.adult.tax}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#4caf50" }}>
              <span>{t.fbMomoDiscount || "Giảm giá MoMo"}</span>
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
              <span>{t.fbTotalFare || "Tổng giá khởi hồi"}</span>
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
            <span style={{ fontSize: "14px", fontWeight: "600" }}>{t.fbOtherBenefits || "Quyền lợi khác"}</span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
            <div>• {t.fbAirlineMiles38 || "Dặm của hãng hàng không: ít nhất 38"}</div>
            <div>• {t.fbComboBenefits || "Combo chuyến bay: ✓ Giá tốt ✓ Cam kết bảo toàn hành trình"}</div>
          </div>
          <div style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}>
            * {t.fbBenefitsNote || "Có hiệu lực trước giờ khởi hành của chuyến bay đầu tiên. Không được chuyển sang chuyến bay đã đổi."}
          </div>
        </div>

        {/* Payment Methods */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "15px" }}>
            {t.fbSelectPaymentMethod || "Chọn Hình Thức Thanh Toán"}
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
            🏨 {t.fbHotelPromo || "Được giảm giá đến 25% cho phòng khách sạn khi đặt vé máy bay, thêm quyền lợi miễn phí hủy phòng nếu chuyến bay bị đổi lịch"} 🚗
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
            {t.fbCloseBtn || "Đóng"}
          </button>
          <button
            onClick={onContinue}
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
            {t.fbContinueBtn || "Tiếp tục"} · {selectedClassData.price}
          </button>
        </div>

        {/* Small note */}
        <div style={{
          marginTop: "15px",
          fontSize: "12px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}>
          {t.fbSignupNote || "Đăng ký tại đây · Khởi tốt"}
        </div>
      </div>
    </div>
  );
};

export default FlightBookingDetail;