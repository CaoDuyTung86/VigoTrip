import React, { useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import {
  MdFlight,
  MdHotel,
  MdRestaurant,
  MdAttractions,
  MdLocalOffer,
  MdFavorite,
  MdFavoriteBorder,
  MdArrowBack,
  MdShare,
  MdCalendarToday,
  MdPeople,
  MdCreditCard,
  MdCheckCircle,
  MdInfo
} from "react-icons/md";
import { FaStar, FaStarHalfAlt } from "react-icons/fa";
import { TbTrain, TbBus } from "react-icons/tb";
import { GiCommercialAirplane } from "react-icons/gi";

const OrderByPackage = () => {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookingStep, setBookingStep] = useState("browse");
  const [travelers, setTravelers] = useState(2);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [favoriteTours, setFavoriteTours] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favoriteTours")) || [];
    } catch { return []; }
  });
  const [customerInfo, setCustomerInfo] = useState({
    lastName: "", firstName: "", email: "", phoneDigits: "",
    dob: "", nationality: "Việt Nam"
  });
  const [customerErrors, setCustomerErrors] = useState({});


  const packages = [

    {
      id: 1,
      type: "flight",
      icon: <MdFlight />,
      title: "Hành trình khám phá miền Bắc",
      description: "Khám phá Hà Nội - Hạ Long - Sapa trong 5 ngày 4 đêm",
      shortDesc: "Hà Nội - Hạ Long - Sapa",
      price: 5990000,
      originalPrice: 7990000,
      discount: 25,
      rating: 4.8,
      reviewCount: 128,
      image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      includes: [
        "Vé máy bay khứ hồi",
        "Khách sạn 4 sao (4 đêm)",
        "Xe đưa đón sân bay",
        "Bữa sáng hàng ngày",
        "Vé tham quan Hạ Long",
        "Hướng dẫn viên tiếng Việt"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Nội Bài - Nhận phòng khách sạn - Tự do khám phá Hà Nội",
        "Ngày 2: Tham quan Hồ Gươm, Văn Miếu - Di chuyển Hạ Long",
        "Ngày 3: Du thuyền tham quan vịnh Hạ Long - Kayak - Lặn ngắm san hô",
        "Ngày 4: Di chuyển Sapa - Bản Cát Cát - Núi Hàm Rồng",
        "Ngày 5: Chợ phiên Sapa - Di chuyển về Hà Nội - Bay về"
      ],
      airline: "Vietnam Airlines",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Hà Nội",
      duration: "5 ngày 4 đêm",
      availableDates: ["15/06/2026", "20/06/2026", "25/06/2026", "30/06/2026"],
      hotel: "Khách sạn Deawoo Hà Nội",
      meals: ["4 bữa sáng", "2 bữa trưa", "1 bữa tối"],
      transport: "Máy bay + Xe du lịch"
    },
    {
      id: 2,
      type: "flight",
      icon: <MdFlight />,
      title: "Kỳ nghỉ biển Đà Nẵng - Hội An",
      description: "Tận hưởng kỳ nghỉ tại Đà Nẵng và khám phá phố cổ Hội An",
      shortDesc: "Đà Nẵng - Hội An - Bà Nà",
      price: 4590000,
      originalPrice: 5890000,
      discount: 22,
      rating: 4.7,
      reviewCount: 256,
      image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      includes: [
        "Vé máy bay khứ hồi",
        "Resort 5 sao (3 đêm)",
        "Xe đưa đón sân bay",
        "Buffet sáng",
        "Vé Bà Nà Hills (Cáp treo)",
        "Vé tham quan Hội An"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Đà Nẵng - Check-in resort - Tắm biển",
        "Ngày 2: Bà Nà Hills - Cầu Vàng - Vườn hoa Le Jardin",
        "Ngày 3: Tham quan Hội An - Chợ đêm - Thả hoa đăng",
        "Ngày 4: Tự do khám phá Đà Nẵng - Bay về"
      ],
      airline: "Bamboo Airways",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Đà Nẵng",
      duration: "4 ngày 3 đêm",
      availableDates: ["10/06/2026", "15/06/2026", "20/06/2026", "25/06/2026"],
      hotel: "Resort Furama Đà Nẵng",
      meals: ["3 bữa sáng", "2 bữa trưa", "2 bữa tối"],
      transport: "Máy bay + Xe du lịch"
    },
    {
      id: 3,
      type: "flight",
      icon: <MdFlight />,
      title: "Tour du lịch Phú Quốc - Thiên đường biển đảo",
      description: "Khám phá hòn đảo ngọc Phú Quốc với những bãi biển tuyệt đẹp",
      shortDesc: "Phú Quốc - Grand World - Hòn Thơm",
      price: 3990000,
      originalPrice: 5490000,
      discount: 27,
      rating: 4.9,
      reviewCount: 189,
      image: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      includes: [
        "Vé máy bay khứ hồi",
        "Resort 4 sao (3 đêm)",
        "Xe đưa đón sân bay",
        "Buffet sáng",
        "Vé Grand World",
        "Tour 3 đảo (Cáp treo Hòn Thơm)",
        "Bảo hiểm du lịch"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Phú Quốc - Nhận phòng - Tắm biển",
        "Ngày 2: Tour 3 đảo: Hòn Mây Rút - Hòn Mây Rút In - Hòn Gầm Ghì",
        "Ngày 3: Grand World - Cáp treo Hòn Thơm - Aquatopia",
        "Ngày 4: Chợ đêm Phú Quốc - Mua sắm đặc sản - Bay về"
      ],
      airline: "Vietjet Air",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Phú Quốc",
      duration: "4 ngày 3 đêm",
      availableDates: ["05/06/2026", "12/06/2026", "19/06/2026", "26/06/2026"],
      hotel: "Novotel Phú Quốc Resort",
      meals: ["3 bữa sáng", "3 bữa trưa"],
      transport: "Máy bay + Xe du lịch + Cano"
    },

    {
      id: 4,
      type: "train",
      icon: <TbTrain />,
      title: "Hành trình xuyên Việt bằng tàu hỏa",
      description: "Trải nghiệm hành trình xuyên Việt từ Bắc vào Nam trên những chuyến tàu",
      shortDesc: "Hà Nội - Huế - Đà Nẵng - Sài Gòn",
      price: 3890000,
      originalPrice: 4890000,
      discount: 20,
      rating: 4.5,
      reviewCount: 87,
      image: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      includes: [
        "Vé tàu giường nằm (khứ hồi)",
        "Khách sạn 3 sao (3 đêm)",
        "Xe đưa đón ga tàu",
        "Bữa sáng",
        "Vé tham quan các điểm dừng",
        "Hướng dẫn viên"
      ],
      schedule: [
        "Ngày 1: Lên tàu tại ga Hà Nội - Bắt đầu hành trình",
        "Ngày 2: Đến ga Huế - Tham quan Đại Nội, lăng tẩm",
        "Ngày 3: Di chuyển Đà Nẵng - Bà Nà Hills - Cầu Vàng",
        "Ngày 4: Tiếp tục hành trình vào Sài Gòn - Kết thúc tour"
      ],
      trainCompany: "Đường sắt Việt Nam",
      departureCity: "Hà Nội",
      destinationCity: "TP. Hồ Chí Minh",
      duration: "4 ngày 3 đêm",
      availableDates: ["01/06/2026", "05/06/2026", "10/06/2026", "15/06/2026"],
      seatClass: "Giường nằm khoang 4",
      meals: ["3 bữa sáng", "2 bữa trưa", "2 bữa tối"],
      transport: "Tàu hỏa + Xe du lịch"
    },
    {
      id: 5,
      type: "train",
      icon: <TbTrain />,
      title: "Tour Huế - Đà Nẵng bằng tàu hỏa",
      description: "Khám phá cố đô Huế và thành phố Đà Nẵng với trải nghiệm tàu hỏa ven biển",
      shortDesc: "Huế - Đà Nẵng - Hội An",
      price: 2790000,
      originalPrice: 3590000,
      discount: 22,
      rating: 4.6,
      reviewCount: 124,
      image: "/tour_hue_danang.png",
      includes: [
        "Vé tàu Huế - Đà Nẵng",
        "Khách sạn 4 sao (3 đêm)",
        "Xe đưa đón",
        "Ăn sáng",
        "Vé tham quan",
        "Hướng dẫn viên"
      ],
      schedule: [
        "Ngày 1: Ga Huế - Nhận phòng - Tham quan Đại Nội",
        "Ngày 2: Lăng Minh Mạng, Tự Đức - Chùa Thiên Mụ",
        "Ngày 3: Di chuyển Đà Nẵng bằng tàu - Bán đảo Sơn Trà",
        "Ngày 4: Hội An - Phố cổ - Kết thúc tour"
      ],
      trainCompany: "Đường sắt Việt Nam",
      departureCity: "Huế",
      destinationCity: "Đà Nẵng",
      duration: "4 ngày 3 đêm",
      availableDates: ["08/06/2026", "12/06/2026", "18/06/2026", "22/06/2026"],
      seatClass: "Ghế ngồi mềm điều hòa",
      meals: ["3 bữa sáng", "1 bữa trưa"],
      transport: "Tàu hỏa + Xe du lịch"
    },


    {
      id: 6,
      type: "bus",
      icon: <TbBus />,
      title: "Tour săn mây Tà Xùa",
      description: "Chinh phục đỉnh Tà Xùa - thiên đường săn mây của Tây Bắc",
      shortDesc: "Hà Nội - Tà Xùa - Mộc Châu",
      price: 1890000,
      originalPrice: 2490000,
      discount: 24,
      rating: 4.8,
      reviewCount: 156,
      image: "/tour_san_may.png",
      includes: [
        "Xe giường nằm limousine khứ hồi",
        "Homestay (2 đêm)",
        "Các bữa ăn theo chương trình",
        "Vé tham quan",
        "Hướng dẫn viên",
        "Bảo hiểm du lịch"
      ],
      schedule: [
        "Ngày 1: Hà Nội - Mộc Châu - Thung lũng mận Nà Ka",
        "Ngày 2: Di chuyển Tà Xùa - Săn mây đỉnh Sống Lưng Khủng Long",
        "Ngày 3: Ngắm bình minh trên mây - Hà Nội"
      ],
      busCompany: "Xe khách Sao Việt",
      departureCity: "Hà Nội",
      destinationCity: "Tà Xùa",
      duration: "3 ngày 2 đêm",
      availableDates: ["03/06/2026", "07/06/2026", "11/06/2026", "15/06/2026"],
      busType: "Limousine giường nằm",
      meals: ["2 bữa sáng", "3 bữa chính"],
      transport: "Xe limousine + Xe ôm"
    },
    {
      id: 7,
      type: "bus",
      icon: <TbBus />,
      title: "Du lịch Đà Lạt - Thành phố ngàn hoa",
      description: "Khám phá Đà Lạt mộng mơ với xe khách chất lượng cao",
      shortDesc: "Sài Gòn - Đà Lạt",
      price: 2290000,
      originalPrice: 2990000,
      discount: 23,
      rating: 4.7,
      reviewCount: 203,
      image: "/dalat_city.png",
      includes: [
        "Xe giường nằm khứ hồi",
        "Khách sạn trung tâm (3 đêm)",
        "Các bữa ăn sáng",
        "Vé tham quan các điểm",
        "Xe đưa đón tham quan"
      ],
      schedule: [
        "Ngày 1: Sài Gòn - Đà Lạt - Quảng trường Lâm Viên",
        "Ngày 2: Thiền viện Trúc Lâm - Thác Datanla - Ga Đà Lạt",
        "Ngày 3: Làng Cù Lần - Vườn dâu tây - Chợ đêm",
        "Ngày 4: Mua sắm đặc sản - Về Sài Gòn"
      ],
      busCompany: "Phương Trang",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Đà Lạt",
      duration: "4 ngày 3 đêm",
      availableDates: ["02/06/2026", "06/06/2026", "10/06/2026", "14/06/2026"],
      busType: "Giường nằm VIP 34 chỗ",
      meals: ["3 bữa sáng"],
      transport: "Xe khách + Xe du lịch"
    }
  ];

  const extraServices = [
    { id: 1, name: "Bảo hiểm du lịch cao cấp", price: 199000, icon: <MdLocalOffer /> },
    { id: 2, name: "Tour guide riêng", price: 1500000, icon: <MdPeople /> },
    { id: 3, name: "Vé VinWonders", price: 850000, icon: <MdAttractions /> },
    { id: 4, name: "Nâng cấp khách sạn 5 sao", price: 2000000, icon: <MdHotel /> },
    { id: 5, name: "Buffet tối cao cấp", price: 599000, icon: <MdRestaurant /> },
  ];


  const filteredPackages = selectedCategory === "all"
    ? packages
    : packages.filter(pkg => pkg.type === selectedCategory);

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setBookingStep("details");
    window.scrollTo(0, 0);
  };

  const handleBookNow = () => {
    setBookingStep("booking");
  };

  const handleBookingSubmit = () => {
    setBookingStep("customerInfo");
  };

  const handleCustomerInfoSubmit = () => {
    const errors = {};
    if (!customerInfo.lastName.trim()) errors.lastName = "Vui lòng nhập họ";
    if (!customerInfo.firstName.trim()) errors.firstName = "Vui lòng nhập tên";
    if (!customerInfo.email.trim()) errors.email = "Vui lòng nhập email";
    if (!customerInfo.phoneDigits.trim()) errors.phoneDigits = "Vui lòng nhập số điện thoại";
    setCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBookingStep("payment");
  };

  const handleVNPayPayment = async () => {
    try {
      const bookingId = Date.now();
      const res = await axios.post(
        "/api/payment/create",
        { bookingId, language: "vn" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch {
      alert("Lỗi tạo link VNPay, vui lòng thử lại.");
    }
  };

  const toggleFavorite = (pkgId) => {
    setFavoriteTours(prev => {
      const updated = prev.includes(pkgId)
        ? prev.filter(id => id !== pkgId)
        : [...prev, pkgId];
      localStorage.setItem("favoriteTours", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev =>
      prev.includes(extraId)
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const calculateTotal = () => {
    if (!selectedPackage) return 0;
    const extrasTotal = selectedExtras.reduce((sum, id) => {
      const extra = extraServices.find(e => e.id === id);
      return sum + (extra?.price || 0);
    }, 0);
    return selectedPackage.price * travelers + extrasTotal;
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FaStar key={`full-${i}`} style={{ color: "#FFD700" }} />);
    }
    if (hasHalf) {
      stars.push(<FaStarHalfAlt key="half" style={{ color: "#FFD700" }} />);
    }
    while (stars.length < 5) {
      stars.push(<FaStar key={`empty-${stars.length}`} style={{ color: "#E0E0E0" }} />);
    }
    return stars;
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      <Header setIsSidebarOpen={setIsSidebarOpen} />

      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "30px 20px" }}>


            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                Đặt theo gói
              </h1>
              <p style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
                Lựa chọn gói du lịch trọn gói với nhiều ưu đãi hấp dẫn
              </p>
            </div>

            {/* Category Filter - only show on browse */}
            {bookingStep === "browse" && <div style={{
              display: "flex",
              gap: "12px",
              marginBottom: "30px",
              flexWrap: "wrap"
            }}>
              <button
                onClick={() => setSelectedCategory("all")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "all" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "all" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <MdFlight /> {t.all}
              </button>
              <button
                onClick={() => setSelectedCategory("flight")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "flight" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "flight" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <GiCommercialAirplane /> {t.flight}
              </button>
              <button
                onClick={() => setSelectedCategory("train")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "train" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "train" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <TbTrain /> {t.train}
              </button>
              <button
                onClick={() => setSelectedCategory("bus")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "bus" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "bus" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <TbBus /> {t.bus}
              </button>
            </div>}

            {/* Favorites Tab */}
            {bookingStep === "browse" && favoriteTours.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <button
                  onClick={() => setSelectedCategory(selectedCategory === "favorites" ? "all" : "favorites")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "50px",
                    border: selectedCategory === "favorites" ? "2px solid #ef4444" : "1px solid #fca5a5",
                    background: selectedCategory === "favorites" ? "#fef2f2" : "white",
                    color: selectedCategory === "favorites" ? "#ef4444" : "#ef4444",
                    fontWeight: "700",
                    fontSize: "15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "all 0.2s"
                  }}
                >
                  <MdFavorite /> {t.favoriteTours} ({favoriteTours.length})
                </button>
              </div>
            )}

            {/* Favorite Tours Grid */}
            {bookingStep === "browse" && selectedCategory === "favorites" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px",
                marginBottom: "24px"
              }}>
                {packages.filter(pkg => favoriteTours.includes(pkg.id)).map((pkg) => (
                  <div
                    key={pkg.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      position: "relative",
                      border: "2px solid #fca5a5"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                    }}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {pkg.discount && (
                      <div style={{
                        position: "absolute", top: "16px", left: "16px",
                        background: "#ef4444", color: "white",
                        padding: "4px 12px", borderRadius: "20px",
                        fontWeight: "700", fontSize: "14px", zIndex: 1
                      }}>-{pkg.discount}%</div>
                    )}
                    <button
                      style={{
                        position: "absolute", top: "16px", right: "16px",
                        background: "white", border: "none",
                        width: "36px", height: "36px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", zIndex: 1
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pkg.id); }}
                    >
                      <MdFavorite style={{ color: "#ef4444" }} />
                    </button>
                    <div style={{
                      height: "200px",
                      backgroundImage: `url(${pkg.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute", bottom: "12px", left: "12px",
                        background: "rgba(0,0,0,0.6)", color: "white",
                        padding: "4px 12px", borderRadius: "20px", fontSize: "13px",
                        display: "flex", alignItems: "center", gap: "6px"
                      }}>
                        {pkg.icon}
                        <span>{pkg.type === "flight" ? t.flight : pkg.type === "train" ? t.train : t.bus}</span>
                      </div>
                    </div>
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                        {renderStars(pkg.rating)}
                        <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "4px" }}>
                          ({pkg.reviewCount} đánh giá)
                        </span>
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>{pkg.title}</h3>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>{pkg.shortDesc}</p>
                      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCalendarToday /> {pkg.duration}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdPeople /> {pkg.departureCity}
                        </div>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "baseline", justifyContent: "space-between",
                        borderTop: "1px solid var(--border-light)", paddingTop: "16px"
                      }}>
                        <div>
                          <span style={{ fontSize: "14px", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "8px" }}>
                            {pkg.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "22px", fontWeight: "700", color: "#2563eb" }}>
                            {pkg.price.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <button style={{
                          padding: "8px 16px", background: "#2563eb", color: "white",
                          border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer"
                        }}>Chọn gói</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {bookingStep === "browse" && selectedCategory !== "favorites" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px"
              }}>
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                    }}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {/* Discount Badge */}
                    {pkg.discount && (
                      <div style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        background: "#ef4444",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontWeight: "700",
                        fontSize: "14px",
                        zIndex: 1
                      }}>
                        -{pkg.discount}%
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        background: "white",
                        border: "none",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        zIndex: 1
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pkg.id); }}
                    >
                      {favoriteTours.includes(pkg.id)
                        ? <MdFavorite style={{ color: "#ef4444" }} />
                        : <MdFavoriteBorder style={{ color: "var(--text-muted)" }} />}
                    </button>

                    {/* Image */}
                    <div style={{
                      height: "200px",
                      backgroundImage: `url(${pkg.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "12px",
                        left: "12px",
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {pkg.icon}
                        <span>{pkg.type === "flight" ? t.flight : pkg.type === "train" ? t.train : t.bus}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                        {renderStars(pkg.rating)}
                        <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "4px" }}>
                          ({pkg.reviewCount} đánh giá)
                        </span>
                      </div>

                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                        {pkg.title}
                      </h3>

                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                        {pkg.shortDesc}
                      </p>

                      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCalendarToday /> {pkg.duration}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdPeople /> {pkg.departureCity}
                        </div>
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        borderTop: "1px solid var(--border-light)",
                        paddingTop: "16px"
                      }}>
                        <div>
                          <span style={{ fontSize: "14px", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "8px" }}>
                            {pkg.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "22px", fontWeight: "700", color: "#2563eb" }}>
                            {pkg.price.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <button
                          style={{
                            padding: "8px 16px",
                            background: "#2563eb",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: "600",
                            fontSize: "14px",
                            cursor: "pointer"
                          }}
                        >
                          Chọn gói
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Package Details */}
            {bookingStep === "details" && selectedPackage && (
              <div>
                {/* Back button */}
                <button
                  onClick={() => { setBookingStep("browse"); setSelectedPackage(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 20px", marginBottom: "20px",
                    background: "var(--bg-card)", border: "1px solid var(--border-light)",
                    borderRadius: "10px", cursor: "pointer",
                    fontWeight: "600", fontSize: "15px", color: "var(--text-secondary)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
                >
                  <MdArrowBack size={20} /> Quay lại danh sách
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
                  <div>
                    {/* Main Image */}
                    <div style={{
                      height: "400px",
                      borderRadius: "20px",
                      backgroundImage: `url(${selectedPackage.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      marginBottom: "24px",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "20px",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "30px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}>
                        {selectedPackage.icon}
                        <span style={{ fontSize: "14px" }}>
                          {selectedPackage.type === "flight" ? t.flight :
                            selectedPackage.type === "train" ? t.train : t.bus}
                        </span>
                      </div>
                    </div>

                    {/* Title and Rating */}
                    <div style={{ marginBottom: "24px" }}>
                      <h2 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                        {selectedPackage.title}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {renderStars(selectedPackage.rating)}
                        </div>
                        <span style={{ color: "var(--text-muted)" }}>{selectedPackage.rating}/5</span>
                        <span style={{ color: "#94a3b8" }}>•</span>
                        <span style={{ color: "var(--text-muted)" }}>{selectedPackage.reviewCount} đánh giá</span>
                      </div>
                      <p style={{ fontSize: "16px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                        {selectedPackage.description}
                      </p>
                    </div>

                    {/* Schedule */}
                    <div style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      marginBottom: "24px"
                    }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                        Lịch trình chi tiết
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {selectedPackage.schedule.map((item, index) => (
                          <div key={index} style={{ display: "flex", gap: "12px" }}>
                            <div style={{
                              width: "28px",
                              height: "28px",
                              background: "#2563eb",
                              color: "white",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "14px",
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ fontSize: "15px", color: "var(--text-main)", lineHeight: "1.5" }}>
                              {item}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* What's Included */}
                    <div style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px"
                    }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                        Bao gồm
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        {selectedPackage.includes.map((item, index) => (
                          <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <MdCheckCircle style={{ color: "#10b981", flexShrink: 0 }} />
                            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Booking Sidebar */}
                  <div>
                    <div style={{
                      background: "var(--bg-card)",
                      borderRadius: "16px",
                      padding: "24px",
                      position: "sticky",
                      top: "90px"
                    }}>
                      {/* Price */}
                      <div style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>Giá từ</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                          <span style={{ fontSize: "32px", fontWeight: "700", color: "#2563eb" }}>
                            {selectedPackage.price.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "16px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                            {selectedPackage.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <div style={{
                          background: "#fee2e2",
                          color: "#ef4444",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "13px",
                          fontWeight: "600",
                          display: "inline-block",
                          marginTop: "8px"
                        }}>
                          Tiết kiệm {selectedPackage.discount}%
                        </div>
                      </div>

                      {/* Quick Info */}
                      <div style={{
                        background: "var(--bg-hover)",
                        borderRadius: "12px",
                        padding: "16px",
                        marginBottom: "24px"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>Điểm khởi hành</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{selectedPackage.departureCity}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>Điểm đến</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{selectedPackage.destinationCity}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>Thời gian</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{selectedPackage.duration}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>Phương tiện</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{selectedPackage.transport}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <button
                        onClick={handleBookNow}
                        style={{
                          width: "100%",
                          padding: "16px",
                          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          color: "white",
                          border: "none",
                          borderRadius: "12px",
                          fontWeight: "700",
                          fontSize: "16px",
                          cursor: "pointer",
                          marginBottom: "12px"
                        }}
                      >
                        Đặt ngay
                      </button>

                      <button
                        style={{
                          width: "100%",
                          padding: "14px",
                          background: "var(--bg-card)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "12px",
                          fontWeight: "600",
                          fontSize: "15px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}
                      >
                        <MdShare /> Chia sẻ gói này
                      </button>

                      {/* Info Note */}
                      <div style={{
                        marginTop: "20px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        textAlign: "center"
                      }}>
                        <MdInfo style={{ verticalAlign: "middle", marginRight: "4px" }} />
                        Giá có thể thay đổi theo ngày khởi hành và số lượng khách
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Form */}
            {bookingStep === "booking" && selectedPackage && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <div style={{
                  background: "var(--bg-card)",
                  borderRadius: "20px",
                  padding: "32px"
                }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thông tin đặt gói
                  </h2>

                  {/* Travelers */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                      Số lượng khách
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button
                        onClick={() => setTravelers(Math.max(1, travelers - 1))}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-card)",
                          fontSize: "18px",
                          cursor: "pointer"
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={travelers}
                        onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: "80px",
                          padding: "8px",
                          textAlign: "center",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      />
                      <button
                        onClick={() => setTravelers(Math.min(10, travelers + 1))}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-card)",
                          fontSize: "18px",
                          cursor: "pointer"
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                        Ngày khởi hành
                      </label>
                      <select
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      >
                        <option value="">Chọn ngày</option>
                        {selectedPackage.availableDates.map((date) => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                        Ngày kết thúc
                      </label>
                      <select
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      >
                        <option value="">Chọn ngày</option>
                        {selectedPackage.availableDates.map((date) => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Extras */}
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                      Dịch vụ bổ sung
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {extraServices.map((extra) => (
                        <label
                          key={extra.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px",
                            border: "1px solid var(--border-light)",
                            borderRadius: "8px",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input
                              type="checkbox"
                              checked={selectedExtras.includes(extra.id)}
                              onChange={() => toggleExtra(extra.id)}
                            />
                            <span style={{ color: "#2563eb" }}>{extra.icon}</span>
                            <span style={{ fontSize: "14px", fontWeight: "500" }}>{extra.name}</span>
                          </div>
                          <span style={{ fontWeight: "600", color: "#2563eb" }}>
                            {extra.price.toLocaleString("vi-VN")}đ
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                      Mã khuyến mãi
                    </label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Nhập mã giảm giá"
                        style={{
                          flex: 1,
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      />
                      <button
                        style={{
                          padding: "12px 24px",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{
                    background: "var(--bg-hover)",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "24px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span>Giá gói cơ bản ({travelers} khách)</span>
                      <span style={{ fontWeight: "600" }}>{(selectedPackage.price * travelers).toLocaleString("vi-VN")}đ</span>
                    </div>
                    {selectedExtras.map(id => {
                      const extra = extraServices.find(e => e.id === id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-muted)" }}>
                          <span>+ {extra.name}</span>
                          <span>{extra.price.toLocaleString("vi-VN")}đ</span>
                        </div>
                      );
                    })}
                    <div style={{
                      borderTop: "1px solid var(--border-light)",
                      marginTop: "12px",
                      paddingTop: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "700",
                      fontSize: "18px",
                      color: "#2563eb"
                    }}>
                      <span>Tổng cộng</span>
                      <span>{calculateTotal().toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setBookingStep("details")}
                      style={{
                        flex: 1,
                        padding: "14px",
                        background: "var(--bg-card)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Quay lại
                    </button>
                    <button
                      onClick={handleBookingSubmit}
                      style={{
                        flex: 2,
                        padding: "14px",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Tiến hành thanh toán
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info Form */}
            {bookingStep === "customerInfo" && selectedPackage && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "32px" }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thông tin khách hàng
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>Nhập thông tin cá nhân. Các ô có dấu * là bắt buộc.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[{ label: "Họ *", key: "lastName" }, { label: "Tên & tên đệm *", key: "firstName" }].map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>{f.label}</label>
                        <input value={customerInfo[f.key]}
                          onChange={e => setCustomerInfo(p => ({ ...p, [f.key]: e.target.value }))}
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: customerErrors[f.key] ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                        {customerErrors[f.key] && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors[f.key]}</div>}
                      </div>
                    ))}
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Ngày sinh</label>
                      <input type="date" value={customerInfo.dob}
                        onChange={e => setCustomerInfo(p => ({ ...p, dob: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Quốc tịch</label>
                      <select value={customerInfo.nationality}
                        onChange={e => setCustomerInfo(p => ({ ...p, nationality: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }}>
                        {["Việt Nam", "Nhật Bản", "Hàn Quốc", "Anh", "Mỹ", "Úc", "Khác"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Số điện thoại *</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input readOnly value="+84" style={{ width: "64px", padding: "12px 8px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--bg-hover)", textAlign: "center", color: "var(--text-main)" }} />
                        <input value={customerInfo.phoneDigits}
                          onChange={e => setCustomerInfo(p => ({ ...p, phoneDigits: e.target.value.replace(/\D/g, "") }))}
                          placeholder="912345678"
                          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: customerErrors.phoneDigits ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", background: "var(--bg-input)", color: "var(--text-main)" }} />
                      </div>
                      {customerErrors.phoneDigits && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors.phoneDigits}</div>}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Email *</label>
                      <input type="email" value={customerInfo.email}
                        onChange={e => setCustomerInfo(p => ({ ...p, email: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: customerErrors.email ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                      {customerErrors.email && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors.email}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                    <button onClick={() => setBookingStep("booking")}
                      style={{ flex: 1, padding: "14px", background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
                      Quay lại
                    </button>
                    <button onClick={handleCustomerInfoSubmit}
                      style={{ flex: 2, padding: "14px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>
                      Tiến hành thanh toán
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment - VNPay */}
            {bookingStep === "payment" && selectedPackage && (
              <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "32px" }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thanh toán
                  </h2>

                  {/* Booking Summary */}
                  <div style={{ border: "1px solid var(--border-main)", borderRadius: "12px", padding: "16px", marginBottom: "16px", background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: "700", marginBottom: "8px", color: "#2563eb" }}>📦 Gói du lịch</div>
                    <div style={{ fontWeight: "700", fontSize: "16px" }}>{selectedPackage.title}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>{selectedPackage.duration} · {selectedPackage.departureCity} → {selectedPackage.destinationCity}</div>
                  </div>

                  <div style={{ border: "1px solid var(--border-main)", borderRadius: "12px", padding: "16px", marginBottom: "16px", background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: "700", marginBottom: "8px", color: "#2563eb" }}>👤 Khách hàng</div>
                    <div style={{ fontSize: "14px" }}>
                      <b>{customerInfo.lastName} {customerInfo.firstName}</b>
                      <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>{customerInfo.email} · +84 {customerInfo.phoneDigits}</div>
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{ background: "var(--bg-hover)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span>Giá gói ({travelers} khách)</span>
                      <span style={{ fontWeight: "600" }}>{(selectedPackage.price * travelers).toLocaleString("vi-VN")}đ</span>
                    </div>
                    {selectedExtras.map(id => {
                      const extra = extraServices.find(e => e.id === id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-muted)" }}>
                          <span>+ {extra.name}</span><span>{extra.price.toLocaleString("vi-VN")}đ</span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: "1px solid var(--border-light)", marginTop: "12px", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "18px", color: "#2563eb" }}>
                      <span>Tổng cộng</span>
                      <span>{calculateTotal().toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={() => setBookingStep("customerInfo")}
                      style={{ flex: 1, padding: "14px", background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
                      Quay lại
                    </button>
                    <button onClick={handleVNPayPayment}
                      style={{ flex: 2, padding: "14px", background: "#005baa", color: "white", border: "none", borderRadius: "8px", fontWeight: "800", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <MdCreditCard /> Thanh toán qua VNPay
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderByPackage;