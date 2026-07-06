import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import { useSavedPassengers } from "../context/SavedPassengersContext";
import PassengerInfoForm from "../components/PassengerInfoForm";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar"; 
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useLocation } from "react-router-dom";
import { MdOutlineCreditCard } from "react-icons/md";
import { TbTrain } from "react-icons/tb";
import { FaRegCalendarAlt } from "react-icons/fa";
import { IoMdSearch } from "react-icons/io";
import { FiChevronDown } from "react-icons/fi";
import { CgSandClock } from "react-icons/cg";
import { CiCreditCard1 } from "react-icons/ci";
import { MdOutlineDone } from "react-icons/md";
import { FaChair } from "react-icons/fa";
import { FaUser } from "react-icons/fa";
import { FaBell } from "react-icons/fa";
import { FaTicketAlt } from "react-icons/fa";

const toLatinUpper = (str) => {
  const map = {
    à:'a',á:'a',â:'a',ã:'a',ả:'a',ạ:'a',ă:'a',ằ:'a',ắ:'a',ẵ:'a',ẳ:'a',ặ:'a',
    ầ:'a',ấ:'a',ẫ:'a',ẩ:'a',ậ:'a',
    è:'e',é:'e',ê:'e',ề:'e',ế:'e',ễ:'e',ể:'e',ẹ:'e',ẻ:'e',ẽ:'e',ệ:'e',
    ì:'i',í:'i',ị:'i',ỉ:'i',ĩ:'i',
    ò:'o',ó:'o',ô:'o',ồ:'o',ố:'o',ỗ:'o',ổ:'o',ọ:'o',ỏ:'o',õ:'o',ộ:'o',
    ơ:'o',ờ:'o',ớ:'o',ỡ:'o',ở:'o',ợ:'o',
    ù:'u',ú:'u',ư:'u',ừ:'u',ứ:'u',ữ:'u',ử:'u',ụ:'u',ủ:'u',ũ:'u',ự:'u',
    ỳ:'y',ý:'y',ỵ:'y',ỷ:'y',ỹ:'y',
    đ:'d',
  };
  return str.split('').map(c => map[c.toLowerCase()] ? (map[c.toLowerCase()]).toUpperCase() : c.toUpperCase()).join('');
};


const formatDob = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0,2) + '/' + digits.slice(2);
  return digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
};




const getSeatPrice = (base, type) => {
  let price = Number(base || 0);
  if (type === "VIP") price *= 2;
  else if (type === "BUSINESS") price += 100000;
  else if (type === "SLEEPER") price += 50000;
  return price;
};

const TrainTickets = () => {
  const { t } = useLanguage();
  const { token, isAuthenticated, user } = useAuth();
  const { isConnected, sendMessage, subscribe } = useWebSocket();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const stations = [
    { code: "HAN", name: "Hà Nội", fullName: "Ga Hà Nội" },
    { code: "SGN", name: "TP. HCM", fullName: "Ga Sài Gòn" },
    { code: "DAD", name: "Đà Nẵng", fullName: "Ga Đà Nẵng" },
    { code: "HUE", name: "Huế", fullName: "Ga Huế" },
    { code: "HPH", name: "Hải Phòng", fullName: "Ga Hải Phòng" },
    { code: "NTR", name: "Nha Trang", fullName: "Ga Nha Trang" },
    { code: "VIN", name: "Vinh", fullName: "Ga Vinh" },
    { code: "QNH", name: "Quảng Ninh", fullName: "Ga Hạ Long" },
    { code: "BMT", name: "Buôn Ma Thuột", fullName: "Ga Buôn Ma Thuột" },
    { code: "TNH", name: "Thanh Hóa", fullName: "Ga Thanh Hóa" },
  ];
  const [from, setFrom] = useState("HAN");
  const [to, setTo] = useState("SGN");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [date, setDate] = useState("");
  const [passengerCounts, setPassengerCounts] = useState({ adult: 1, child: 0, infant: 0 });
  const [showPassengersDropdown, setShowPassengersDropdown] = useState(false);
  const passengers = passengerCounts.adult + passengerCounts.child;
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [step, setStep] = useState("search"); 

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarData, setCalendarData] = useState([]);

  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [passengerInfoList, setPassengerInfoList] = useState([]);
  const [globalContact, setGlobalContact] = useState({ promoOptIn: true, remember: false });
  const { savedPassengers, addPassenger } = useSavedPassengers();

  useEffect(() => {
    if (selectedTrip && isConnected) {
      const subscription = subscribe("/topic/seat-status", (update) => {
        if (update.tripId === selectedTrip.id) {
          setSeats((prevSeats) =>
            prevSeats.map((s) =>
              s.id === update.seatId 
                ? { 
                    ...s, 
                    booked: update.status === "BOOKED",
                    tempLockedBy: update.status === "SELECTED" ? update.userId : null 
                  } 
                : s
            )
          );
        }
      });
      return () => {
        if (subscription) subscription.unsubscribe();
      };
    }
  }, [selectedTrip, isConnected, subscribe]);

  useEffect(() => {
    const newList = [];
    for (let i = 0; i < passengerCounts.adult; i++) newList.push({ type: "ADULT", data: {} });
    for (let i = 0; i < passengerCounts.child; i++) newList.push({ type: "CHILD", data: {} });
    for (let i = 0; i < passengerCounts.infant; i++) newList.push({ type: "INFANT", data: {} });
    setPassengerInfoList(prev => newList.map((item, idx) => prev[idx] ? { ...item, data: prev[idx].data } : item));
  }, [passengerCounts]);

  const handlePassengerChange = (index, type, data) => {
    setPassengerInfoList(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], data };
      return copy;
    });
  };

  const [submitLoading, setSubmitLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [promoCode, setPromoCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [selectedSeatClass, setSelectedSeatClass] = useState("");

  const API_BASE = "/api";
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qFrom = params.get("from");
    const qTo = params.get("to");
    const qDate = params.get("date");
    const qPassengers = params.get("passengers");
    const mode = params.get("mode");

    if (qFrom) setFrom(qFrom);
    if (qTo) setTo(qTo);
    if (qDate) setDate(qDate);
    if (qPassengers) {
      const n = Number(qPassengers);
      if (!Number.isNaN(n) && n > 0) setPassengerCounts({ adult: n, child: 0, infant: 0 });
    }

    if (qFrom && qTo && qPassengers && mode === "calendar") {
      
      setTimeout(() => {
        loadCalendar();
      }, 0);
    }
  
  }, []);

  

  

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
  
    setCalendarOpen(false);
    
    const errs = {};
    if (!from || !from.trim()) errs.from = "Vui lòng nhập điểm đi";
    if (!to || !to.trim()) errs.to = "Vui lòng nhập điểm đến";
    if (!date) errs.date = "Vui lòng chọn ngày đi";
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      setError("");
      return;
    }
    setFormErrors({});
    setError("");
    setLoading(true);
    setSelectedTrip(null);
    setSeats([]);
    setSelectedSeatIds([]);
    setSelectedServiceIds([]);
    setBookingResult(null);

    try {
      const params = new URLSearchParams({
        from,
        to,
        date,
        type: "TRAIN",
        passengers: String(passengers || 1),
      });

      const res = await fetch(`${API_BASE}/trips/search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setTrips(data);
      setStep("chooseTrip");
    } catch (err) {
      console.error(err);
      setError("Không tìm được chuyến tàu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  
  const handleSearchWithDate = async (selectedDate) => {
    setDate(selectedDate);
    setCalendarOpen(false);
    setFormErrors({});
    setError("");
    setLoading(true);
    setSelectedTrip(null);
    setSeats([]);
    setSelectedSeatIds([]);
    setSelectedServiceIds([]);
    setBookingResult(null);

    try {
      const params = new URLSearchParams({
        from,
        to,
        date: selectedDate,
        type: "TRAIN",
        passengers: String(passengers || 1),
      });

      const res = await fetch(`${API_BASE}/trips/search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setTrips(data);
      setStep("chooseTrip");
    } catch (err) {
      console.error(err);
      setError("Không tìm được chuyến tàu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    if (!from || !to) {
      setError("Vui lòng nhập đầy đủ điểm đi và điểm đến để xem lịch giá.");
      return;
    }

    setError("");
    setCalendarLoading(true);
    setCalendarOpen(true);

    try {
      const base = date || todayISO;
      const start = base < todayISO ? todayISO : base;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      const end = endDate.toISOString().split("T")[0];

      const params = new URLSearchParams({
        from,
        to,
        start,
        end,
        type: "TRAIN",
        passengers: String(passengers || 1),
      });

      const res = await fetch(`${API_BASE}/trips/calendar?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setCalendarData(data || []);
    } catch (err) {
      console.error(err);
      setError("Không tải được lịch giá. Vui lòng thử lại.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadServices = async () => {
    setServicesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/additional-services`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Không tải được danh sách dịch vụ bổ sung.");
    } finally {
      setServicesLoading(false);
    }
  };

  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip);
    setSeats([]);
    setSelectedSeatIds([]);
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/trips/${trip.id}/seats`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setSeats(data);
     
      setStep("seatClass");
    } catch (err) {
      console.error(err);
      setError("Không tải được danh sách ghế. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seat) => {
    if (seat.booked || (seat.tempLockedBy && seat.tempLockedBy !== user?.email)) return;

    setSelectedSeatIds((prev) => {
      const exists = prev.includes(seat.id);
      
      const maxSeats = passengers || 1;
      if (!exists && prev.length >= maxSeats) {
        return prev;
      }

      const newStatus = exists ? "AVAILABLE" : "SELECTED";
      
      sendMessage("/app/seat-selection", {
        tripId: selectedTrip.id,
        seatId: seat.id,
        status: newStatus,
        userId: user?.email
      });

      if (exists) {
        return prev.filter((id) => id !== seat.id);
      }

      return [...prev, seat.id];
    });
  };

  const categories = useMemo(() => {
    const byName = (prefix) => services.filter((s) => (s.serviceName || "").startsWith(prefix));
    return {
      seat: byName("Chọn chỗ"),
      baggage: byName("Hành lý"),
      meal: byName("Suất ăn"),
      insurance: services.filter((s) => (s.serviceName || "").includes("Bảo hiểm")),
      taxi: services.filter((s) => (s.serviceName || "").includes("Taxi")),
    };
  }, [services]);

  const setSingleServiceInCategory = (serviceId, categoryServices) => {
    const categoryIds = categoryServices.map((s) => s.id);
    setSelectedServiceIds((prev) => {
      const filtered = prev.filter((id) => !categoryIds.includes(id));
      if (!serviceId) return filtered;
      return [...filtered, serviceId];
    });
  };

  const toggleService = (serviceId) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) return prev.filter((id) => id !== serviceId);
      return [...prev, serviceId];
    });
  };

  const validatePassenger = () => {
    for (const [idx, pi] of passengerInfoList.entries()) {
        const d = pi.data || {};
        const isAdult = pi.type === 'ADULT';
        if (!d.fullName || d.fullName.trim() === '') return `Vui lòng nhập họ tên cho ${isAdult ? 'người lớn' : pi.type === 'CHILD' ? 'trẻ em' : 'em bé'} ${idx + 1}.`;
        if (!d.dateOfBirth || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.dateOfBirth)) return `Ngày sinh hành khách ${idx + 1} không hợp lệ. Vui lòng nhập định dạng DD/MM/YYYY.`;
        if (!d.gender) return `Vui lòng chọn giới tính cho hành khách ${idx + 1}.`;
        
        if (isAdult) {
            if (!d.email || !/^\S+@\S+\.\S+$/.test(d.email)) return `Email của người lớn không hợp lệ.`;
            if (!d.phone || !/^\d{9,10}$/.test(d.phone.replace(/\D/g, ''))) return `SĐT người lớn không hợp lệ.`;
            if (!d.idNumber) return `Vui lòng nhập CCCD/Hộ chiếu cho người lớn.`;
        }
    }
    return null;
  };

  const goToExtras = async () => {
    if (!selectedSeatIds.length) {
      setError("Vui lòng chọn ghế trước khi tiếp tục.");
      return;
    }
    setError("");
    setStep("passenger");
  };

  const goToExtrasFromPassenger = async () => {
    const msg = validatePassenger();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    await loadServices();
    setStep("extras");
  };

  const goToReview = () => {
    setError("");
    setStep("review");
  };

  const calculateTotalBeforeDiscount = () => {
    if (!selectedTrip) return 0;
    const seatsTotal = seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s.seatType), 0);
    const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum,s)=>sum+(s.price||0),0);
    return seatsTotal + extraTotal;
  };

  const handleApplyVoucher = async () => {
    if (!promoCode) return;
    try {
      const orderAmount = calculateTotalBeforeDiscount();
      const res = await axios.post("/api/voucher/validate", { code: promoCode, orderAmount });
      if (res.data.valid) {
        setAppliedVoucher(promoCode);
        setVoucherDiscount(res.data.discountAmount);
        alert(res.data.message);
      } else {
        setAppliedVoucher("");
        setVoucherDiscount(0);
        alert("Lỗi: " + res.data.message);
      }
    } catch (err) {
      alert("Có lỗi xảy ra khi áp mã giảm giá.");
    }
  };

  const submitBooking = async () => {
    if (!isAuthenticated || !token) {
      setError("Vui lòng đăng nhập trước khi đặt vé.");
      return;
    }

    if (!selectedTrip) {
      setError("Vui lòng chọn chuyến bay.");
      return;
    }

    if (!selectedSeatIds.length) {
      setError("Vui lòng chọn ghế.");
      return;
    }

    setError("");
    setSubmitLoading(true);

    const names = passengerInfoList.map(p => p.data.fullName).filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          seatIds: selectedSeatIds,
          passengerNames: names,
          additionalServiceIds: selectedServiceIds,
          voucherCode: appliedVoucher,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data?.message || "Đặt vé thất bại. Vui lòng thử lại.";
        setError(message);
        setSubmitLoading(false);
        return;
      }

      setBookingResult(data);
      if (globalContact.remember) {
        passengerInfoList.forEach(pi => {
           if (pi.type === 'ADULT' && pi.data.fullName) {
               addPassenger({ ...pi.data, passengerType: 'ADULT' }).catch(() => {});
           }
        });
      }
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối đến máy chủ để đặt vé.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const seatsByRow = useMemo(() => {
    const parse = (seatNumber) => {
      const match = String(seatNumber || "").match(/^(\d+)([A-Za-z])$/);
      if (!match) return null;
      return { row: Number(match[1]), col: match[2].toUpperCase() };
    };

    const items = seats
      .map((s) => {
        const parsed = parse(s.seatNumber);
        if (!parsed) return null;
        return { ...s, row: parsed.row, col: parsed.col };
      })
      .filter(Boolean);

    const cols = Array.from(new Set(items.map((i) => i.col))).sort();
    const rows = Array.from(new Set(items.map((i) => i.row))).sort((a, b) => a - b);

    const map = new Map();
    for (const item of items) {
      map.set(`${item.row}${item.col}`, item);
    }

    return { cols, rows, map };
  }, [seats]);

  const selectedSeatNumbers = useMemo(() => {
    const byId = new Map(seats.map((s) => [s.id, s.seatNumber]));
    return selectedSeatIds.map((id) => byId.get(id)).filter(Boolean);
  }, [seats, selectedSeatIds]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
     
      <Header setIsSidebarOpen={setIsSidebarOpen} />
      
      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <div
          className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <div className="page-content-wrap" style={{ maxWidth: "1200px" }}>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "var(--text-main)",
                marginBottom: "30px",
              }}
            >
              Vé tàu hỏa
            </h1>

            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "12px",
                padding: "24px",
                boxShadow: "var(--shadow-md)",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr auto", gap: 12, alignItems: "start" }}>

               
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><TbTrain /> {t.from}</label>
                  <div
                    onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: formErrors.from ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{from}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {stations.find(a => a.code === from)?.name || t.selectTrainStation}
                    </div>
                  </div>
                  {formErrors.from && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.from}</div>}
                  {showFromDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
                      {stations.filter(a => a.code !== to).map(a => (
                        <div key={a.code} onClick={() => { setFrom(a.code); setShowFromDropdown(false); setFormErrors(p => ({...p, from: undefined})); }}
                          style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: from === a.code ? "#eff6ff" : "#fff" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f5f5ff"}
                          onMouseLeave={e => e.currentTarget.style.background = from === a.code ? "#eff6ff" : "#fff"}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.code} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>– {a.name}</span></div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.fullName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                
                <button type="button"
                  onClick={() => { const t2 = from; setFrom(to); setTo(t2); }}
                  style={{ marginTop: 28, width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--border-main)",
                    background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "var(--primary)", flexShrink: 0, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#4f7cff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "#e0e7ff"; }}
                  title={t.swapDestinations}
                >⇄</button>

                
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><TbTrain /> {t.to}</label>
                  <div
                    onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: formErrors.to ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{to}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {stations.find(a => a.code === to)?.name || t.selectTrainStation}
                    </div>
                  </div>
                  {formErrors.to && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.to}</div>}
                  {showToDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
                      {stations.filter(a => a.code !== from).map(a => (
                        <div key={a.code} onClick={() => { setTo(a.code); setShowToDropdown(false); setFormErrors(p => ({...p, to: undefined})); }}
                          style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: to === a.code ? "#eff6ff" : "#fff" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f5f5ff"}
                          onMouseLeave={e => e.currentTarget.style.background = to === a.code ? "#eff6ff" : "#fff"}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.code} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>– {a.name}</span></div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.fullName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

               
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaRegCalendarAlt /> {t.departureDate}</label>
                  <input type="date" value={date}
                    onChange={(e) => { setDate(e.target.value); setFormErrors(p => ({...p, date: undefined})); }}
                    min={todayISO}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, boxSizing: "border-box",
                      border: formErrors.date ? "2px solid #e53935" : "2px solid #e0e7ff", background: "var(--bg-input)" }}
                  />
                  {formErrors.date && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.date}</div>}
                </div>

                
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaUser /> {t.passengers}</label>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <div
                      onClick={() => setShowPassengersDropdown(!showPassengersDropdown)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border-main)",
                        background: "var(--bg-card)", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}
                    >
                      <span>{passengerCounts.adult} {t.adult || 'Người lớn'}, {passengerCounts.child} {t.child || 'Trẻ em'}, {passengerCounts.infant} {t.infant || 'Em bé'}</span>
                      <FiChevronDown />
                    </div>
                    {showPassengersDropdown && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 16, marginTop: 4 }}>
                         {['adult', 'child', 'infant'].map(type => (
                           <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                             <div>
                               <div style={{ fontWeight: 600 }}>{type === 'adult' ? t.adult || 'Người lớn' : type === 'child' ? t.child || 'Trẻ em' : t.infant || 'Em bé'}</div>
                               <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{type === 'adult' ? '>12 tuổi' : type === 'child' ? '2-11 tuổi' : '<2 tuổi'}</div>
                             </div>
                             <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                               <button type="button" disabled={passengerCounts[type] <= (type === 'adult' ? 1 : 0)} onClick={() => setPassengerCounts(p => ({...p, [type]: p[type] - 1}))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                               <span style={{ fontWeight: 600, width: 16, textAlign: "center" }}>{passengerCounts[type]}</span>
                               <button type="button" disabled={passengerCounts.adult + passengerCounts.child + passengerCounts.infant >= 5} onClick={() => setPassengerCounts(p => ({...p, [type]: p[type] + 1}))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                             </div>
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={handleSearch} disabled={loading}
                    style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none",
                      background: loading ? "#aaa" : "linear-gradient(135deg,blue,blue)",
                      color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, marginBottom: 8 }}
                  >
                    {loading ? <><CgSandClock /> ${t.searching}</> : <><IoMdSearch /> {t.searchTrain}</>}
                  </button>
                  <button type="button" onClick={loadCalendar} disabled={calendarLoading}
                    style={{ width: "100%", padding: "10px", borderRadius: 10, border: "2px solid var(--border-main)",
                      background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 600, cursor: calendarLoading ? "not-allowed" : "pointer", fontSize: 13 }}
                  >
                    {calendarLoading ? <><CgSandClock /> {t.loadingCalendar}</> : <><FaRegCalendarAlt /> {t.viewCheapCalendar}</>}
                  </button>
                </div>
              </div>

              {calendarOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700 }}>{t.calendar30Days}</div>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: 18,
                        color: "var(--text-secondary)",
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {calendarData.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        disabled={!d.available}
                        onClick={() => {
                          if (!d.available) return;
                          handleSearchWithDate(d.date);
                        }}
                        style={{
                          width: 150,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--border-light)",
                          background: d.available ? "#fff" : "#f5f5f5",
                          cursor: d.available ? "pointer" : "not-allowed",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{d.date}</div>
                        <div style={{ marginTop: 6, color: d.available ? "#ff6b00" : "#999", fontWeight: 700 }}>
                          {d.minPrice != null ? `${Number(d.minPrice).toLocaleString("vi-VN")} đ` : "—"}
                        </div>
                      </button>
                    ))}
                  </div>

                  {!calendarLoading && calendarData.every((d) => !d.available) && (
                    <p style={{ marginTop: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      Hiện chưa có chuyến bay phù hợp trong khoảng ngày này. Bạn có thể bỏ chọn "tìm vé rẻ nhất"
                      và dùng tìm kiếm thường, hoặc đổi điểm đi/điểm đến/ngày khác.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p style={{ marginTop: 16, color: "red" }}>
                  {error}
                </p>
              )}
            </div>

            {step === "chooseTrip" && trips.length > 0 && (
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: "var(--shadow-md)",
                  marginBottom: 24,
                }}
              >
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  Danh sách chuyến bay
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {trips.map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => handleSelectTrip(trip)}
                      style={{
                        textAlign: "left",
                        padding: 16,
                        borderRadius: 10,
                        border: "1px solid var(--border-light)",
                        backgroundColor:
                          selectedTrip && selectedTrip.id === trip.id ? "#fff7ec" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {trip.origin} → {trip.destination}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            Khởi hành: {trip.departureTime}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#ff6b00" }}>
                            {trip.price?.toLocaleString("vi-VN")} đ
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            Còn {trip.availableSeats}/{trip.totalSeats} chỗ
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {trip.providerName} · {trip.vehicleType}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            
            {["seatClass", "passenger", "extras", "review"].includes(step) && (
              <div style={{ marginBottom: 20, background: "var(--bg-card)", borderRadius: 12, padding: "16px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                
                  <div style={{ position: "absolute", top: 20, left: "10%", right: "10%", height: 3, background: "#e0e7ff", zIndex: 0 }} />
                  {[
                    { key: "seatClass", icon:  <FaChair />, label: t.step1Title },
                    { key: "passenger", icon: <FaUser />, label: t.step2Title },
                    { key: "extras", icon: <FaBell />, label: t.step3Title },
                    { key: "review", icon: <CiCreditCard1 />, label: t.step4Title },
                  ].map((s) => {
                    const orderMap = { seatClass: 0, passenger: 1, extras: 2, review: 3 };
                    const current = orderMap[step];
                    const isDone = orderMap[s.key] < current;
                    const isActive = s.key === step;
                    return (
                      <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, flex: 1 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: isDone ? "#22c55e" : isActive ? "#4f7cff" : "#e0e7ff",
                          color: isDone || isActive ? "#fff" : "#888",
                          fontWeight: 700, fontSize: 18, transition: "all .3s",
                        }}>{isDone ? "✓" : s.icon}</div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? "#4f7cff" : "#888" }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          
            {selectedTrip && step === "seatClass" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t.step1}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>{t.selectSeatInstruction}</p>

                  {loading && <p style={{ color: "var(--text-muted)" }}>Đang tải sơ đồ ghế...</p>}

                
                  {!loading && (() => {
                    const classTypes = [...new Set(seats.map(s => s.seatType || "ECONOMY"))];
                    return (
                      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setSelectedSeatClass("")} style={{
                          padding: "8px 18px", borderRadius: 20, border: `2px solid ${!selectedSeatClass ? "#4f7cff" : "#ddd"}`,
                          background: !selectedSeatClass ? "#4f7cff" : "#fff", color: !selectedSeatClass ? "#fff" : "#333",
                          fontWeight: 600, cursor: "pointer",
                        }}>Tất cả</button>
                        {classTypes.map(cls => (
                          <button key={cls} type="button" onClick={() => setSelectedSeatClass(cls)} style={{
                            padding: "8px 18px", borderRadius: 20,
                            border: `2px solid ${selectedSeatClass === cls ? "#4f7cff" : "#ddd"}`,
                            background: selectedSeatClass === cls ? "#4f7cff" : "#fff",
                            color: selectedSeatClass === cls ? "#fff" : "#333",
                            fontWeight: 600, cursor: "pointer",
                          }}>{cls === "ECONOMY" ? "🟢 Phổ thông" : cls === "BUSINESS" ? "🔵 Thương gia" : cls}</button>
                        ))}
                      </div>
                    );
                  })()}

                
                  {!loading && seats.length > 0 && (() => {
                    const filteredSeats = selectedSeatClass
                      ? seats.filter(s => (s.seatType || "ECONOMY") === selectedSeatClass)
                      : seats;

                    const parse = (sn) => { const m = String(sn||"").match(/^(\d+)([A-Za-z])$/); return m ? { row: +m[1], col: m[2].toUpperCase() } : null; };
                    const items = filteredSeats.map(s => { const p = parse(s.seatNumber); return p ? {...s, ...p} : null; }).filter(Boolean);
                    const cols = [...new Set(items.map(i => i.col))].sort();
                    const rows = [...new Set(items.map(i => i.row))].sort((a,b) => a-b);
                    const smap = new Map(items.map(i => [`${i.row}${i.col}`, i]));

                   
                    const half = Math.ceil(cols.length / 2);
                    const leftCols = cols.slice(0, half);
                    const rightCols = cols.slice(half);

                    return (
                      <div style={{ 
                        overflowX: "auto", background: "var(--bg-main)", padding: "20px 30px", 
                        borderRadius: "12px", border: "4px solid #4f7cff", borderLeft: "20px solid #4f7cff",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.1)", position: "relative",
                        minWidth: "fit-content", margin: "0 auto"
                      }}>
                        <div style={{ textAlign: "left", marginBottom: 20, color: "var(--primary)", fontSize: "18px", fontWeight: "bold" }}>🚂 Đầu Tàu & Toa Xe</div>
                      
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, paddingLeft: 48 }}>
                          {leftCols.map(c => <div key={c} style={{ width: 44, textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 12 }}>{c}</div>)}
                          <div style={{ width: 32 }} />
                          {rightCols.map(c => <div key={c} style={{ width: 44, textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 12 }}>{c}</div>)}
                        </div>
                        {rows.map(row => (
                          <div key={row} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                            <div style={{ width: 36, textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 12 }}>{row}</div>
                            {leftCols.map(col => {
                              const s = smap.get(`${row}${col}`);
                              if (!s) return <div key={col} style={{ width: 44, height: 38 }} />;
                              const sel = selectedSeatIds.includes(s.id);
                              const isLockedByOthers = s.tempLockedBy && s.tempLockedBy !== user?.email;
                              return (
                                <button key={s.id} type="button" onClick={() => toggleSeat(s)} disabled={s.booked || isLockedByOthers}
                                  title={`${s.seatNumber} ${s.seatType || "ECONOMY"} ${s.booked ? "(Đã đặt)" : isLockedByOthers ? "(Đang được người khác chọn)" : ""}`}
                                  style={{ 
        width: 44, height: s.seatType === "BUSINESS" || s.seatType === "VIP" ? 48 : 40, 
        borderRadius: "8px 8px 4px 4px", border: "1px solid rgba(0,0,0,0.1)", 
        cursor: (s.booked || isLockedByOthers) ? "not-allowed" : "pointer",
        background: s.booked ? "#e0e0e0" : isLockedByOthers ? "#fecaca" : sel ? "#f59e0b" : (["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? "#bfdbfe" : "#bbf7d0"),
        color: (s.booked || isLockedByOthers) ? "#aaa" : sel ? "#fff" : "#333", fontWeight: 700, fontSize: 12,
        borderBottom: s.booked ? "6px solid #ccc" : isLockedByOthers ? "6px solid #f87171" : sel ? "6px solid #d97706" : (["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? "6px solid #60a5fa" : "6px solid #4ade80"),
        transition: "all 0.2s"
    }}>
                                  {s.booked ? "✗" : isLockedByOthers ? "🔒" : s.seatNumber}
                                </button>
                              );
                            })}
                            <div style={{ width: 32, textAlign: "center", color: "#ccc", fontSize: 10 }}>&nbsp;&nbsp;&nbsp;</div>
                            {rightCols.map(col => {
                              const s = smap.get(`${row}${col}`);
                              if (!s) return <div key={col} style={{ width: 44, height: 38 }} />;
                              const sel = selectedSeatIds.includes(s.id);
                              const isLockedByOthers = s.tempLockedBy && s.tempLockedBy !== user?.email;
                              return (
                                <button key={s.id} type="button" onClick={() => toggleSeat(s)} disabled={s.booked || isLockedByOthers}
                                  title={`${s.seatNumber} ${s.seatType || "ECONOMY"} ${s.booked ? "(Đã đặt)" : isLockedByOthers ? "(Đang được người khác chọn)" : ""}`}
                                  style={{ 
        width: 44, height: s.seatType === "BUSINESS" || s.seatType === "VIP" ? 48 : 40, 
        borderRadius: "8px 8px 4px 4px", border: "1px solid rgba(0,0,0,0.1)", 
        cursor: (s.booked || isLockedByOthers) ? "not-allowed" : "pointer",
        background: s.booked ? "#e0e0e0" : isLockedByOthers ? "#fecaca" : sel ? "#f59e0b" : (["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? "#bfdbfe" : "#bbf7d0"),
        color: (s.booked || isLockedByOthers) ? "#aaa" : sel ? "#fff" : "#333", fontWeight: 700, fontSize: 12,
        borderBottom: s.booked ? "6px solid #ccc" : isLockedByOthers ? "6px solid #f87171" : sel ? "6px solid #d97706" : (["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? "6px solid #60a5fa" : "6px solid #4ade80"),
        transition: "all 0.2s"
    }}>
                                  {s.booked ? "✗" : isLockedByOthers ? "🔒" : s.seatNumber}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                       
                        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                          <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#dcfce7", borderRadius: 3, marginRight: 4 }} />{t.seatClassEco}</span>
                          <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#dbeafe", borderRadius: 3, marginRight: 4 }} />{t.seatClassBiz}</span>
                          <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#f59e0b", borderRadius: 3, marginRight: 4 }} />{t.seatClassSelected}</span>
                          <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#fecaca", borderRadius: 3, marginRight: 4 }} />Có người đang chọn</span>
                          <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#e0e0e0", borderRadius: 3, marginRight: 4 }} />{t.seatClassBooked}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {!loading && seats.length === 0 && <p style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu ghế cho chuyến này.</p>}

                  {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("chooseTrip")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtras} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>

               
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-md)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>{t.bookingSummary}</div>
                  <div style={{ fontSize: 13, color: "#444", lineHeight: 1.8 }}>
                    <div>&nbsp;&nbsp;&nbsp; <b>{selectedTrip.origin}</b> → <b>{selectedTrip.destination}</b></div>
                    <div style={{ color: "var(--text-muted)" }}>{selectedTrip.departureTime}</div>
                    <div style={{ color: "var(--text-muted)" }}>{selectedTrip.providerName}</div>
                    <div style={{ marginTop: 8, fontWeight: 700, color: "#ff6b00", fontSize: 15 }}>{Number(selectedTrip.price||0).toLocaleString("vi-VN")} đ / ghế</div>
                    <div style={{ marginTop: 8, color: selectedSeatIds.length >= (passengers||1) ? "#22c55e" : "#888" }}>Ghế đã chọn: {selectedSeatIds.length}/{passengers||1}</div>
                  </div>
                </div>
              </div>
            )}

        
            {selectedTrip && step === "passenger" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t.step2}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.passengerInstruction}</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {passengerInfoList.map((pi, idx) => (
                      <PassengerInfoForm
                         key={idx}
                         type={pi.type}
                         index={idx}
                         data={pi.data}
                         onChange={handlePassengerChange}
                         savedPassengers={savedPassengers}
                         onSelectSaved={(i, t, p) => handlePassengerChange(i, t, {
                            ...p, 
                            fullName: p.fullName || "", 
                            phone: p.phone || "",
                            email: p.email || "",
                            idNumber: p.idNumber || "",
                            dateOfBirth: p.dateOfBirth || "",
                            gender: p.gender || "",
                            nationality: p.nationality || "Việt Nam"
                         })}
                      />
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                    <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={globalContact.promoOptIn} onChange={e => setGlobalContact(p => ({...p, promoOptIn: e.target.checked}))} />
                      {t.receivePromo}
                    </label>
                    <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={globalContact.remember} onChange={e => setGlobalContact(p => ({...p, remember: e.target.checked}))} />
                      {t.rememberInfo}
                    </label>
                  </div>

                  {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("seatClass")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtrasFromPassenger} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>

             
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-md)", height: "fit-content" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>Thông tin đặt chỗ</div>
                  <div style={{ fontSize: 13, color: "#444", lineHeight: 1.9 }}>
                    <div>&nbsp;&nbsp;&nbsp; <b>{selectedTrip.origin}</b> → <b>{selectedTrip.destination}</b></div>
                    <div style={{ color: "var(--text-muted)" }}>{selectedTrip.departureTime}</div>
                    <div style={{ marginTop: 6 }}>Ghế: <b>{selectedSeatIds.length === 0 ? "Chưa chọn" : seats.filter(s => selectedSeatIds.includes(s.id)).map(s => s.seatNumber).join(", ")}</b></div>
                    <div style={{ marginTop: 8, fontWeight: 700, color: "#ff6b00", fontSize: 15 }}>{Number(selectedTrip.price||0).toLocaleString("vi-VN")} đ / ghế</div>
                  </div>
                </div>
              </div>
            )}

         
            {selectedTrip && step === "extras" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t.step3}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.extrasInstruction}</p>

                  {servicesLoading && <p style={{ color: "var(--text-muted)" }}>Đang tải dịch vụ...</p>}

                  {!servicesLoading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
             
                      <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, background: "var(--bg-input)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 24 }}>🧳</span>
                          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{t.baggage}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Chọn gói hành lý phù hợp</div></div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
                            border: `2px solid ${!selectedServiceIds.some(id => categories.baggage.map(s=>s.id).includes(id)) ? "#4f7cff" : "#ddd"}`,
                            background: !selectedServiceIds.some(id => categories.baggage.map(s=>s.id).includes(id)) ? "#eff6ff" : "#fff",
                            cursor: "pointer" }}>
                            <input type="radio" name="baggage" style={{ display: "none" }}
                              checked={!selectedServiceIds.some(id => categories.baggage.map(s=>s.id).includes(id))}
                              onChange={() => setSingleServiceInCategory(null, categories.baggage)} />
                            Không mua thêm
                          </label>
                          {categories.baggage.map(s => (
                            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
                              border: `2px solid ${selectedServiceIds.includes(s.id) ? "#4f7cff" : "#ddd"}`,
                              background: selectedServiceIds.includes(s.id) ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                              <input type="radio" name="baggage" style={{ display: "none" }} checked={selectedServiceIds.includes(s.id)} onChange={() => setSingleServiceInCategory(s.id, categories.baggage)} />
                              <span style={{ fontWeight: 600 }}>{s.serviceName}</span>
                              <span style={{ marginLeft: 6, color: "var(--primary)", fontWeight: 700 }}>{Number(s.price||0).toLocaleString("vi-VN")} đ</span>
                            </label>
                          ))}
                        </div>
                      </div>

                  
                      <div style={{ border: "1px solid #fef3c7", borderRadius: 12, padding: "20px", background: "var(--bg-input)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>🍱</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#b45309" }}>{t.meal}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Suất ăn nóng hổi, chuẩn vị nhà hàng</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 30,
                      border: `2px solid ${!selectedServiceIds.some(id => categories.meal.map(s=>s.id).includes(id)) ? "#f59e0b" : "#ddd"}`,
                      background: !selectedServiceIds.some(id => categories.meal.map(s=>s.id).includes(id)) ? "#fffbeb" : "#fff",
                      cursor: "pointer", fontWeight: 700, color: !selectedServiceIds.some(id => categories.meal.map(s=>s.id).includes(id)) ? "#d97706" : "#555" }}>
                      <input type="radio" name="meal" style={{ display: "none" }}
                        checked={!selectedServiceIds.some(id => categories.meal.map(s=>s.id).includes(id))}
                        onChange={() => setSingleServiceInCategory(null, categories.meal)} />
                      ✖ Không chọn suất ăn
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {categories.meal.map((s, index) => {
                       const images = [
                         "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=400&auto=format&fit=crop", 
                         "https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=400&auto=format&fit=crop", 
                         "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=400&auto=format&fit=crop", 
                         "https://images.unsplash.com/photo-1555126634-323283e090fa?q=80&w=400&auto=format&fit=crop"  
                       ];
                       const img = images[index % images.length];
                       const isSelected = selectedServiceIds.includes(s.id);
                       return (
                         <div key={s.id} onClick={() => setSingleServiceInCategory(s.id, categories.meal)} 
                           style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${isSelected ? "#f59e0b" : "#eee"}`, 
                           background: isSelected ? "#fffbeb" : "#fff", cursor: "pointer", position: "relative", transition: "all 0.2s",
                           boxShadow: isSelected ? "0 4px 12px rgba(245, 158, 11, 0.2)" : "0 2px 8px rgba(0,0,0,0.05)" }}>
                           <div style={{ height: 120, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                           <div style={{ padding: 12 }}>
                             <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", lineHeight: 1.4, minHeight: 40 }}>{s.serviceName}</div>
                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                               <span style={{ color: "#d97706", fontWeight: 800, fontSize: 14 }}>{Number(s.price||0).toLocaleString("vi-VN")} VND</span>
                               <div style={{ width: 24, height: 24, borderRadius: "50%", background: isSelected ? "#f59e0b" : "#f3f4f6", 
                                 display: "flex", alignItems: "center", justifyContent: "center", color: isSelected ? "#fff" : "#9ca3af", fontWeight: "bold" }}>
                                 {isSelected ? "✓" : "+"}
                               </div>
                             </div>
                           </div>
                         </div>
                       );
                    })}
                  </div>
                </div>

                      {[{cat: categories.insurance, icon: "🛡️", title: "Bảo hiểm du lịch", sub: "Bảo vệ chuyến đi của bạn", color: "#f0fdf4", border: "#bbf7d0"},
                        {cat: categories.taxi, icon: "🚕", title: "Xe đón sân bay", sub: "Tiện lợi với dịch vụ xe riêng", color: "#fef9c3", border: "#fde68a"}]
                      .map(({cat, icon, title, sub, color, border, highlighted}) => (
                        cat.length > 0 && (
                          <div key={title} style={{ border: highlighted ? `2px solid ${border}` : `1px solid ${border}`, borderRadius: 12, padding: 16, background: highlighted ? "#f0fdf4" : "#f9fafb", position: "relative", overflow: "hidden" }}>
                            {highlighted && <div style={{ position: "absolute", top: 12, right: -25, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 24px", transform: "rotate(45deg)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>NÊN MUA</div>}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                              <span style={{ fontSize: 32, background: "var(--bg-card)", borderRadius: "50%", padding: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>{icon}</span>
                              <div><div style={{ fontWeight: 800, fontSize: 16, color: highlighted ? "#15803d" : "#333", marginBottom: 4 }}>{title}</div><div style={{ fontSize: 13, color: highlighted ? "#166534" : "#666", lineHeight: 1.5 }}>{sub}</div></div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {cat.map(s => (
                              <label key={s.id} onClick={() => toggleService(s.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", borderRadius: 10, background: selectedServiceIds.includes(s.id) ? color : "#fff",
                                border: `2px solid ${selectedServiceIds.includes(s.id) ? border : "#e5e7eb"}`,
                                cursor: "pointer", transition: "all 0.2s", boxShadow: selectedServiceIds.includes(s.id) ? "0 4px 10px rgba(34,197,94,0.15)" : "none" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selectedServiceIds.includes(s.id) ? border : "#ccc"}`,
                                    background: selectedServiceIds.includes(s.id) ? border : "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
                                    {selectedServiceIds.includes(s.id) ? "✓" : ""}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 14 }}>{s.serviceName}</div>
                                  </div>
                                </div>
                                <span style={{ fontWeight: 800, fontSize: 15, color: selectedServiceIds.includes(s.id) ? border : "#666" }}>
                                  {Number(s.price||0) === 0 ? "Miễn phí" : `${Number(s.price||0).toLocaleString("vi-VN")} đ`}
                                </span>
                              </label>
                            ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("passenger")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToReview} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.reviewAndPay} →</button>
                  </div>
                </div>

        
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-md)", height: "fit-content" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>{t.totalCost}</div>
                  <div style={{ fontSize: 13, lineHeight: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Giá vé ({selectedSeatIds.length} ghế)</span><b>{seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s.seatType), 0).toLocaleString("vi-VN")} đ</b></div>
                    {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>+ {s.serviceName}</span><span>{Number(s.price||0).toLocaleString("vi-VN")} đ</span></div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "#ff6b00" }}>
                      <span>Tổng cộng</span>
                      <span>{Number(seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s.seatType), 0) + services.filter(s=>selectedServiceIds.includes(s.id)).reduce((sum,s)=>sum+(s.price||0),0)).toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

       
            {selectedTrip && step === "review" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t.step4}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.reviewInstruction}</p>

         
                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--primary)" }}>&nbsp;&nbsp;&nbsp; Chuyến bay</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedTrip.origin} → {selectedTrip.destination}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{selectedTrip.departureTime} · {selectedTrip.providerName}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#ff6b00", fontSize: 16 }}>{Number(selectedTrip.price||0).toLocaleString("vi-VN")} đ</div>
                    </div>
                  </div>

             
                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--primary)" }}>👤 Hành khách</div>
                    {passengerInfoList.map((pi, idx) => (
                      <div key={idx} style={{ fontSize: 13, marginBottom: 8, paddingBottom: 8, borderBottom: idx < passengerInfoList.length - 1 ? "1px dashed #ccc" : "none" }}>
                        <b>{pi.data.fullName || `Hành khách ${idx+1}`}</b> ({pi.type === 'ADULT' ? 'Người lớn' : pi.type === 'CHILD' ? 'Trẻ em' : 'Em bé'})
                        {pi.type === 'ADULT' && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{pi.data.email} · {pi.data.phone ? `+84 ${pi.data.phone}` : ''}</div>}
                        <div style={{ marginTop: 2 }}>Ngày sinh: {pi.data.dateOfBirth} | Giới tính: {pi.data.gender === 'Male' ? 'Nam' : pi.data.gender === 'Female' ? 'Nữ' : 'Khác'}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 4 }}>Ghế: <b>{seats.filter(s=>selectedSeatIds.includes(s.id)).map(s=>s.seatNumber).join(", ") || "Chưa chọn"}</b></div>
                  </div>

              
                  {selectedServiceIds.length > 0 && (
                    <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--primary)" }}>🛎 Dịch vụ bổ sung</div>
                      {services.filter(s=>selectedServiceIds.includes(s.id)).map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                          <span>{s.serviceName}</span><b>{Number(s.price||0).toLocaleString("vi-VN")} đ</b>
                        </div>
                      ))}
                    </div>
                  )}

                 
                  <div style={{ position: "relative", border: "2px dashed #ff4500", borderRadius: 12, padding: "20px", marginBottom: 14, background: "linear-gradient(to right, #fff5f0, #fff)" }}>
                      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", background: "var(--bg-card)", borderRight: "2px dashed #ff4500" }}></div>
                      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", background: "var(--bg-card)", borderLeft: "2px dashed #ff4500" }}></div>
                      <div style={{ fontWeight: 800, color: "#ff4500", fontSize: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 22 }}>🎟️</span> {t.promoCodeLabel}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Nhập mã ưu đãi..."
                          style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: "1px solid #fca5a5", fontSize: 15, fontWeight: "bold", color: "#b91c1c", textTransform: "uppercase" }} />
                        <button type="button" onClick={handleApplyVoucher} disabled={!promoCode} style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: promoCode ? "#ff4500" : "#fca5a5", color: "#fff", fontWeight: 800, cursor: promoCode ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                          {t.applyPromo}
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#991b1b", marginTop: 10 }}>
                        <span style={{ fontStyle: "italic" }}>💡 Mẹo: Nhận mã tại trang Ưu Đãi để được giảm tới 50%</span>
                      </div>
                    </div>

                  {error && <p style={{ color: "red", marginTop: 4 }}>{error}</p>}

                  {bookingResult ? (
                    <div style={{ padding: 20, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", marginTop: 8 }}>
                      <div style={{ fontWeight: 800, color: "#16a34a", fontSize: 16, marginBottom: 8 }}><MdOutlineDone /> {t.successBooking}</div>
                      <div style={{ fontSize: 14, color: "#166534", lineHeight: 1.9 }}>
                        <div>Mã booking: <b>#{bookingResult.id}</b></div>
                        <div>{t.totalCost}: <b>{Number(bookingResult.totalPrice||0).toLocaleString("vi-VN")} đ</b></div>
                        <div>Ghế: {Array.isArray(bookingResult.seatNumbers) ? bookingResult.seatNumbers.join(", ") : ""}</div>
                      </div>
                      <button type="button"
                        onClick={async () => {
                          try {
                            const res = await axios.post("/api/payment/create", { bookingId: bookingResult.id, language: "vn" }, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data && res.data.paymentUrl) window.location.href = res.data.paymentUrl;
                          } catch { alert("Lỗi tạo link VNPay, vui lòng thử lại."); }
                        }}
                        style={{ marginTop: 14, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#005baa", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <MdOutlineCreditCard /> {t.paymentVNPAY}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <button type="button" onClick={() => setStep("extras")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                      <button type="button" onClick={submitBooking} disabled={submitLoading}
                        style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#ff6b00", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                        {submitLoading ? "Đang xử lý..." : <><FaTicketAlt /> Đặt vé ngay</>}
                      </button>
                    </div>
                  )}
                </div>

              
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-md)", height: "fit-content" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>{t.paymentDetails}</div>
                  <div style={{ fontSize: 13, lineHeight: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Giá vé ({selectedSeatIds.length} ghế)</span><b>{seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s.seatType), 0).toLocaleString("vi-VN")} đ</b></div>
                    {services.filter(s=>selectedServiceIds.includes(s.id)).map(s => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>+ {s.serviceName}</span><span>{Number(s.price||0).toLocaleString("vi-VN")} đ</span></div>
                    ))}
                    {appliedVoucher && <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", marginTop: 4 }}><span>Mã: {appliedVoucher}</span><span>-{voucherDiscount.toLocaleString("vi-VN")} đ</span></div>}
                    <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, color: "#ff6b00" }}>
                      <span>Tổng cộng</span>
                      <span>{Math.max(0, seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s.seatType), 0) + services.filter(s=>selectedServiceIds.includes(s.id)).reduce((sum,s)=>sum+(s.price||0),0) - voucherDiscount).toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainTickets;