import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import { useSavedPassengers } from "../context/SavedPassengersContext";
import PassengerInfoForm from "../components/PassengerInfoForm";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import {
  canSelectSeats,
  getSeatUserId,
  isSeatLockedByOthers,
  LOGIN_REQUIRED_SEAT_MSG,
  SEAT_CONFLICT_MSG,
  WS_NOT_CONNECTED_MSG,
} from "../utils/seatBookingHelpers";
import { useLocation } from "react-router-dom";
import { TbBus } from "react-icons/tb";
import { FaRegCalendarAlt, FaChair, FaUser, FaConciergeBell, FaCreditCard, FaTicketAlt, FaShieldAlt, FaTaxi } from "react-icons/fa";
import { MdOutlineDone } from "react-icons/md";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { CgSandClock } from "react-icons/cg";
import { IoMdSearch } from "react-icons/io";

const formatFormattedDateTime = (isoString) => {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.replace("T", " ");
    const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${timeStr} - ${dateStr}`;
  } catch {
    return isoString.replace("T", " ");
  }
};

const getSeatPrice = (base, seat) => {
  if (typeof seat === "object" && seat !== null && seat.price && Number(seat.price) > 0) {
    return Number(seat.price);
  }
  const type = typeof seat === "string" ? seat : seat?.seatType;
  const basePrice = Number(base || 0);
  if (["SLEEPER", "BUSINESS", "VIP"].includes(type)) {
    return basePrice + 50000;
  }
  return basePrice;
};

const PROVIDER_LOGOS = {
  "Phương Trang (FUTA)": {
    code: "FUTA",
    color: "#ef4444",
    bg: "#fef2f2",
  },
  "Thành Bưởi": {
    code: "TB",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  "Hoàng Long": {
    code: "HL",
    color: "#f59e0b",
    bg: "#fef3c7",
  },
};

const BusTickets = () => {
  const { t, currentLanguage } = useLanguage();
  const { token, isAuthenticated, user } = useAuth();
  const { isConnected, subscribe, lockSeats, unlockSeats } = useWebSocket();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const busStationTranslations = {
    vi: {
      HAN: { name: "Hà Nội", fullName: "Bến xe Mỹ Đình / Giáp Bát" },
      SGN: { name: "TP. HCM", fullName: "Bến xe Miền Đông / Miền Tây" },
      DAD: { name: "Đà Nẵng", fullName: "Bến xe Đà Nẵng" },
      HUE: { name: "Huế", fullName: "Bến xe Phía Nam Huế" },
      HPH: { name: "Hải Phòng", fullName: "Bến xe Niệm Nghĩa" },
      NTR: { name: "Nha Trang", fullName: "Bến xe Phía Nam Nha Trang" },
      DLT: { name: "Đà Lạt", fullName: "Bến xe Đà Lạt" },
      SAP: { name: "Sapa", fullName: "Bến xe Sapa" },
      QNH: { name: "Quảng Ninh", fullName: "Bến xe Bãi Cháy" },
      VIN: { name: "Vinh", fullName: "Bến xe Vinh" },
    },
    en: {
      HAN: { name: "Hanoi", fullName: "My Dinh / Giap Bat Bus Station" },
      SGN: { name: "Ho Chi Minh City", fullName: "Mien Dong / Mien Tay Bus Station" },
      DAD: { name: "Da Nang", fullName: "Da Nang Central Bus Station" },
      HUE: { name: "Hue", fullName: "Hue Southern Bus Station" },
      HPH: { name: "Hai Phong", fullName: "Niem Nghia Bus Station" },
      NTR: { name: "Nha Trang", fullName: "Nha Trang Southern Bus Station" },
      DLT: { name: "Da Lat", fullName: "Da Lat Interprovincial Bus Station" },
      SAP: { name: "Sapa", fullName: "Sapa Bus Station" },
      QNH: { name: "Quang Ninh", fullName: "Bai Chay Bus Station" },
      VIN: { name: "Vinh", fullName: "Vinh Bus Station" },
    },
    ja: {
      HAN: { name: "ハノイ", fullName: "ミーディン / ザップバット バスターミナル" },
      SGN: { name: "ホーチミン", fullName: "ミエンドン / ミエンタイ バスターミナル" },
      DAD: { name: "ダナン", fullName: "ダナン バスターミナル" },
      HUE: { name: "フエ", fullName: "フエ南部バスターミナル" },
      HPH: { name: "ハイフォン", fullName: "ニエムギア バスターミナル" },
      NTR: { name: "ニャチャン", fullName: "ニャチャン南部バスターミナル" },
      DLT: { name: "ダラット", fullName: "ダラット バスターミナル" },
      SAP: { name: "サパ", fullName: "サパ バスターミナル" },
      QNH: { name: "クアンニン", fullName: "バイチャイ バスターミナル" },
      VIN: { name: "ヴィン", fullName: "ヴィン バスターミナル" },
    },
    zh: {
      HAN: { name: "河內", fullName: "美亭 / 甲八 巴士總站" },
      SGN: { name: "胡志明市", fullName: "東部 / 西部 巴士總站" },
      DAD: { name: "峴港", fullName: "峴港巴士總站" },
      HUE: { name: "順化", fullName: "順化南區巴士站" },
      HPH: { name: "海防", fullName: "念義巴士站" },
      NTR: { name: "芽莊", fullName: "芽莊南區巴士站" },
      DLT: { name: "大叻", fullName: "大叻巴士總站" },
      SAP: { name: "沙壩", fullName: "沙壩巴士站" },
      QNH: { name: "廣寧", fullName: "白齋巴士站" },
      VIN: { name: "榮市", fullName: "榮市巴士站" },
    }
  };

  const stations = useMemo(() => {
    const lang = currentLanguage?.code || "vi";
    const dict = busStationTranslations[lang] || busStationTranslations.vi;
    const baseCodes = ["HAN", "SGN", "DAD", "HUE", "HPH", "NTR", "DLT", "SAP", "QNH", "VIN"];
    return baseCodes.map(code => ({
      code,
      name: dict[code]?.name || code,
      fullName: dict[code]?.fullName || code
    }));
  }, [currentLanguage]);
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
  const [lockDeadline, setLockDeadline] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarData, setCalendarData] = useState([]);

  // Sort & Filter States
  const [sortBy, setSortBy] = useState("price_asc");
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [filterProviders, setFilterProviders] = useState([]);
  const [timeRange, setTimeRange] = useState([0, 24]);
  const [maxPriceFilter, setMaxPriceFilter] = useState(null);

  const allProviders = useMemo(() => {
    return Array.from(new Set(trips.map(t => t.providerName).filter(Boolean)));
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    const now = new Date();

    return trips.filter(trip => {
      if (filterAvailableOnly && (trip.availableSeats || 0) <= 0) return false;
      if (filterProviders.length > 0 && !filterProviders.includes(trip.providerName)) return false;
      if (maxPriceFilter && trip.price > maxPriceFilter) return false;

      // Filter trips starting within 30 minutes or already departed
      if (trip.departureTime) {
        let depDate = null;
        if (trip.departureTime.includes("T")) {
          depDate = new Date(trip.departureTime);
        } else if (date) {
          depDate = new Date(`${date}T${trip.departureTime}`);
        }

        if (depDate && !isNaN(depDate.getTime())) {
          const diffMs = depDate.getTime() - now.getTime();
          if (diffMs < 30 * 60 * 1000) return false;
        }
      }

      let depHour = 0;
      if (trip.departureTime) {
        const timeStr = trip.departureTime.includes("T") ? trip.departureTime.split("T")[1] : trip.departureTime;
        depHour = parseInt(timeStr.split(":")[0], 10);
      }
      if (isNaN(depHour)) depHour = 0;
      if (depHour < timeRange[0] || depHour > timeRange[1]) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);

      const getMins = (str) => {
        if (!str) return 0;
        const s = str.includes("T") ? str.split("T")[1] : str;
        const [h, m] = s.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      if (sortBy === "time_asc") return getMins(a.departureTime) - getMins(b.departureTime);
      if (sortBy === "time_desc") return getMins(b.departureTime) - getMins(a.departureTime);

      const getDuration = (t) => {
        const parseT = (s) => !s ? null : s.includes("T") ? new Date(s) : new Date(`2000-01-01T${s}`);
        const dep = parseT(t.departureTime);
        const arr = parseT(t.arrivalTime);
        if (!dep || !arr) return 0;
        let diff = (arr - dep) / 60000;
        if (diff < 0) diff += 1440;
        return diff;
      };
      if (sortBy === "duration_asc") return getDuration(a) - getDuration(b);

      return 0;
    });
  }, [trips, sortBy, filterAvailableOnly, filterProviders, timeRange, maxPriceFilter]);

  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [passengerInfoList, setPassengerInfoList] = useState([]);
  const [globalContact, setGlobalContact] = useState({ promoOptIn: true, remember: false });
  const { savedPassengers, addPassenger } = useSavedPassengers();

  useEffect(() => {
    if (selectedTrip && isConnected) {
      const subscription = subscribe("/topic/seat-status", (update) => {
        if (update.status === "LOCK_FAILED") return;
        if (update.tripId === selectedTrip.id) {
          const currentUserId = getSeatUserId(user);
          const isLockedByOther = (update.status === "SELECTED" || update.status === "BOOKED") && update.userId !== currentUserId;
          
          if (isLockedByOther) {
            setSelectedSeatIds((prev) => {
              if (prev.includes(update.seatId)) {
                setError("Ghế bạn đang chọn vừa được người khác giữ. Vui lòng chọn ghế khác.");
                return prev.filter((id) => id !== update.seatId);
              }
              return prev;
            });
          }

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
  }, [selectedTrip, isConnected, subscribe, user]);

  // Effect quản lý đếm ngược thời gian giữ ghế (10 phút)
  useEffect(() => {
    if (!lockDeadline) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((lockDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);

        // Hết thời gian: Giải phóng ghế
        unlockSeats({
          tripId: selectedTrip?.id,
          seatIds: selectedSeatIds,
          userId: getSeatUserId(user),
        });

        // Reset states
        setSelectedSeatIds([]);
        setLockDeadline(null);
        setError("Hết thời gian giữ ghế (10 phút). Vui lòng chọn ghế và thực hiện lại.");
        setStep("seatClass");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockDeadline, selectedSeatIds, selectedTrip, user, unlockSeats]);

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
  const [showInsuranceInfo, setShowInsuranceInfo] = useState(false);
  const [showAllMeals, setShowAllMeals] = useState(false);

  // Tính giảm giá hạng thành viên từ promotion của user
  const membershipDiscount = useMemo(() => {
    if (!user?.promotion?.discountRate) return 0;
    const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
    const basePrice = Number(selectedTrip?.price || 0);
    const seatsTotal = selSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s.seatType), 0);
    const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);
    return Math.round((seatsTotal + extraTotal) * (user.promotion.discountRate / 100));
  }, [user, seats, selectedSeatIds, selectedTrip, services, selectedServiceIds]);

  const API_BASE = "/api";
  const todayISO = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);

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

    const qMaxPrice = params.get("maxPrice");
    const qProvider = params.get("providerName");
    const qTimeSlot = params.get("timeSlot");

    if (qMaxPrice && !isNaN(qMaxPrice)) setMaxPriceFilter(Number(qMaxPrice));
    if (qProvider) setFilterProviders([qProvider]);
    if (qTimeSlot) {
      if (qTimeSlot === "MORNING") setTimeRange([5, 12]);
      else if (qTimeSlot === "AFTERNOON") setTimeRange([12, 18]);
      else if (qTimeSlot === "EVENING") setTimeRange([18, 24]);
      else if (qTimeSlot === "EARLY_MORNING") setTimeRange([0, 5]);
    }

    if (qFrom && qTo && qPassengers && mode === "calendar") {
      setTimeout(() => {
        loadCalendar();
      }, 0);
    } else if (qFrom && qTo && qDate) {
      setTimeout(() => {
        performSearch(qFrom, qTo, qDate, qPassengers ? Number(qPassengers) : 1);
      }, 50);
    }
  }, []);

  const performSearch = async (searchFrom, searchTo, searchDate, searchPassengers) => {
    setCalendarOpen(false);

    const errs = {};
    if (!searchFrom || !searchFrom.trim()) errs.from = "Vui lòng nhập điểm đi";
    if (!searchTo || !searchTo.trim()) errs.to = "Vui lòng nhập điểm đến";
    if (!searchDate) errs.date = "Vui lòng chọn ngày đi";
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
      const passengersCount = searchPassengers 
        ? String(searchPassengers) 
        : String((passengerCounts.adult + passengerCounts.child + passengerCounts.infant) || 1);

      const params = new URLSearchParams({
        from: searchFrom,
        to: searchTo,
        date: searchDate,
        type: "BUS",
        passengers: passengersCount,
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
      setError("Không tìm được chuyến xe. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    await performSearch(from, to, date, null);
  };


  const handleSearchWithDate = async (selectedDate) => {
    setDate(selectedDate);
    await performSearch(from, to, selectedDate, null);
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
        type: "BUS",
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
      const loadedServices = Array.isArray(data) ? data : [];

      const defaultMeals = [
        { id: 901, serviceName: "Suất ăn - Combo Bánh chưng chà bông, hạt điều & nước suối", price: 99000, img: "/suat an/Combo Banh chung cha bong, hat dieu va nuoc suoi.jpg" },
        { id: 902, serviceName: "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều", price: 99000, img: "/suat an/Combo Bun xao Singapore va Nuoc suoi va Hat dieu.jpg" },
        { id: 903, serviceName: "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều", price: 99000, img: "/suat an/Combo Com chien Thai va Nuoc suoi va Hat dieu.jpg" },
        { id: 904, serviceName: "Suất ăn - Combo Cơm chiên Dương Châu chay, nước suối & hạt điều", price: 99000, img: "/suat an/Combo Com chien duong chau chay va Nuoc suoi va Hat dieu.jpg" },
        { id: 905, serviceName: "Suất ăn - Combo Cơm thịt bò, hạt điều & nước suối", price: 99000, img: "/suat an/Combo Com thit bo, hat dieu va nuoc suoi.jpg" },
        { id: 906, serviceName: "Suất ăn - Combo Hattrick Bia, khô gà & chả giò", price: 110000, img: "/suat an/Combo Hattrick Bia, Kho ga va Cha gio.jpg" },
        { id: 907, serviceName: "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều", price: 99000, img: "/suat an/Combo Mien xao Tom cua va Nuoc suoi va Hat dieu.jpg" },
        { id: 908, serviceName: "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều", price: 99000, img: "/suat an/Combo My Y va Nuoc suoi va Hat dieu.jpg" },
        { id: 909, serviceName: "Suất ăn - Combo Penalty Soda dâu & hạt Macca", price: 100000, img: "/suat an/Combo Penalty Soda Dau va Hat Macca.jpg" },
        { id: 910, serviceName: "Suất ăn - Combo Xôi khúc giò, hạt điều & nước suối", price: 99000, img: "/suat an/Combo Xoi khuc gio, hat dieu va nuoc suoi.jpg" },
        { id: 911, serviceName: "Suất ăn - Combo Xôi mặn, hạt điều & nước suối", price: 99000, img: "/suat an/Combo Xoi man, hat dieu va nuoc suoi.jpg" },
      ];

      const hasMeal = loadedServices.some(s => (s.serviceName || "").startsWith("Suất ăn"));
      setServices(hasMeal ? loadedServices : [...loadedServices, ...defaultMeals]);
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
      const enrichedData = (data || []).map((s) => {
        const rowMatch = String(s.seatNumber || "").match(/^(\d+)/);
        const rowNum = rowMatch ? parseInt(rowMatch[1], 10) : 0;
        if (!s.seatType || s.seatType === "ECONOMY") {
          return {
            ...s,
            seatType: rowNum <= 4 ? "SLEEPER" : "ECONOMY",
          };
        }
        return s;
      });
      setSeats(enrichedData);

      setStep("seatClass");
    } catch (err) {
      console.error(err);
      setError("Không tải được danh sách ghế. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const maxSeats = passengers || 1;
  const isMaxReached = selectedSeatIds.length >= maxSeats;

  const toggleSeat = (seat) => {
    if (!canSelectSeats(isAuthenticated, user)) {
      setError(LOGIN_REQUIRED_SEAT_MSG);
      return;
    }

    const exists = selectedSeatIds.includes(seat.id);

    if (exists) {
      setError("");
      setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.id));
      return;
    }

    if (seat.booked || isSeatLockedByOthers(seat, user)) return;

    const maxSeats = passengers || 1;

    if (selectedSeatIds.length >= maxSeats) {
      return;
    }

    setError("");
    setSelectedSeatIds((prev) => [...prev, seat.id]);
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
    if (!canSelectSeats(isAuthenticated, user)) {
      setError(LOGIN_REQUIRED_SEAT_MSG);
      return;
    }
    if (!selectedSeatIds.length) {
      setError("Vui lòng chọn ghế trước khi tiếp tục.");
      return;
    }
    if (!isConnected) {
      setError(WS_NOT_CONNECTED_MSG);
      return;
    }

    setError("");
    const userId = getSeatUserId(user);
    const { success, failed, error } = await lockSeats({
      tripId: selectedTrip.id,
      seatIds: selectedSeatIds,
      userId,
    });

    if (!success) {
      if (error === "NOT_CONNECTED") {
        setError(WS_NOT_CONNECTED_MSG);
      } else if (failed?.length) {
        setSelectedSeatIds((prev) => prev.filter((id) => !failed.includes(id)));
        setError(SEAT_CONFLICT_MSG);
      } else {
        setError("Không thể giữ ghế. Vui lòng thử lại.");
      }
      return;
    }

    setLockDeadline(Date.now() + 10 * 60 * 1000);
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
    const seatsTotal = seats.filter(s => selectedSeatIds.includes(s.id)).reduce((sum, s) => sum + getSeatPrice(selectedTrip.price, s), 0);
    const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);
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
    } catch {
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
            addPassenger({ ...pi.data, passengerType: 'ADULT' }).catch(() => { });
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
              {t.bus}
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
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><TbBus /> {t.departurePoint || t.from || "Điểm đi"}</label>
                  <div
                    onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.from ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{from}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {stations.find(a => a.code === from)?.name || t.selectBusStation}
                    </div>
                  </div>
                  {formErrors.from && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.from}</div>}
                  {showFromDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {stations.filter(a => a.code !== to).map(a => (
                        <div key={a.code} onClick={() => { setFrom(a.code); setShowFromDropdown(false); setFormErrors(p => ({ ...p, from: undefined })); }}
                          style={{
                            padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: from === a.code ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-main)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={e => e.currentTarget.style.background = from === a.code ? "var(--bg-hover)" : "transparent"}
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
                  style={{
                    marginTop: 28, width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--border-main)",
                    background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "var(--primary)", flexShrink: 0, transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
                  title={t.swapDestinations}
                >⇄</button>


                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><TbBus /> {t.destinationPoint || t.to || "Điểm đến"}</label>
                  <div
                    onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.to ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{to}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {stations.find(a => a.code === to)?.name || t.selectBusStation}
                    </div>
                  </div>
                  {formErrors.to && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.to}</div>}
                  {showToDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {stations.filter(a => a.code !== from).map(a => (
                        <div key={a.code} onClick={() => { setTo(a.code); setShowToDropdown(false); setFormErrors(p => ({ ...p, to: undefined })); }}
                          style={{
                            padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                            background: to === a.code ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-main)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                          onMouseLeave={e => e.currentTarget.style.background = to === a.code ? "var(--bg-hover)" : "transparent"}
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
                    onChange={(e) => { setDate(e.target.value); setFormErrors(p => ({ ...p, date: undefined })); }}
                    min={todayISO}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, boxSizing: "border-box",
                      border: formErrors.date ? "2px solid #e53935" : "2px solid #e0e7ff", background: "var(--bg-input)", color: "var(--text-main)"
                    }}
                  />
                  {formErrors.date && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.date}</div>}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaUser /> {t.passengers}</label>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <div
                      onClick={() => setShowPassengersDropdown(!showPassengersDropdown)}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border-main)",
                        background: "var(--bg-card)", color: "var(--text-main)", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box"
                      }}
                    >
                      <span>{passengerCounts.adult} {t.adult || 'Người lớn'}, {passengerCounts.child} {t.child || 'Trẻ em'}, {passengerCounts.infant} {t.infant || 'Em bé'}</span>
                      <FiChevronDown />
                    </div>
                    {showPassengersDropdown && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 16, marginTop: 4, border: "1px solid var(--border-main)" }}>
                        {['adult', 'child', 'infant'].map(type => (
                          <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{type === 'adult' ? t.adult || 'Người lớn' : type === 'child' ? t.child || 'Trẻ em' : t.infant || 'Em bé'}</div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{type === 'adult' ? (t.ageAdultHint || '>12 tuổi') : type === 'child' ? (t.ageChildHint || '2-11 tuổi') : (t.ageInfantHint || '<2 tuổi')}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button type="button" disabled={passengerCounts[type] <= (type === 'adult' ? 1 : 0)} onClick={() => setPassengerCounts(p => ({ ...p, [type]: p[type] - 1 }))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                              <span style={{ fontWeight: 600, width: 16, textAlign: "center", color: "var(--text-main)" }}>{passengerCounts[type]}</span>
                              <button type="button" disabled={passengerCounts.adult + passengerCounts.child + passengerCounts.infant >= 5} onClick={() => setPassengerCounts(p => ({ ...p, [type]: p[type] + 1 }))} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={handleSearch} disabled={loading}
                    style={{
                      width: "100%", padding: "11px", borderRadius: 10, border: "none",
                      background: loading ? "#aaa" : "linear-gradient(135deg, #4f7cff, #4f7cff)",
                      color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, marginBottom: 8
                    }}
                  >
                    {loading ? <><CgSandClock /> {t.searching || "Đang tìm..."}</> : <><IoMdSearch /> {t.searchBus || "Tìm chuyến xe"}</>}
                  </button>
                  <button type="button" onClick={loadCalendar} disabled={calendarLoading}
                    style={{
                      width: "100%", padding: "10px", borderRadius: 10, border: "2px solid var(--border-main)",
                      background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 600, cursor: calendarLoading ? "not-allowed" : "pointer", fontSize: 13
                    }}
                  >
                    {calendarLoading ? <><CgSandClock /> {t.loadingCalendar || "Đang tải..."}</> : <><FaRegCalendarAlt /> {t.viewCheapCalendar || "Xem lịch giá rẻ"}</>}
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
                    {calendarData.filter(d => d.available).map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => handleSearchWithDate(d.date)}
                        style={{
                          width: 150,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{d.date}</div>
                        <div style={{ marginTop: 6, color: "#ff6b00", fontWeight: 700 }}>
                          {d.minPrice != null ? `${Number(d.minPrice).toLocaleString("vi-VN")} đ` : "—"}
                        </div>
                      </button>
                    ))}
                  </div>

                  {!calendarLoading && calendarData.filter(d => d.available).length === 0 && (
                    <p style={{ marginTop: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {t.noCheapFlights || "Hiện chưa có chuyến đi phù hợp trong khoảng ngày này. Bạn có thể bỏ chọn \"tìm vé rẻ nhất\" và dùng tìm kiếm thường, hoặc đổi điểm đi/điểm đến/ngày khác."}
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

            {step === "chooseTrip" && trips.length > 0 && (() => {
              const minPrice = Math.min(...trips.map(t => t.price || Infinity));
              return (
                <div style={{ marginBottom: 24 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <TbBus style={{ color: "#ef4444" }} /> {t.listBusTitle || "Danh sách chuyến xe khách"}
                      </h2>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        {(t.showingTrips || "Hiển thị {filtered}/{total} chuyến phù hợp")
                          .replace("{filtered}", filteredTrips.length)
                          .replace("{total}", trips.length)}
                      </p>
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600
                    }}>
                      {stations.find(a => a.code === from)?.name || from} → {stations.find(a => a.code === to)?.name || to}
                    </div>
                  </div>

                  {/* ──── Filter & Sort Bar ──── */}
                  <div style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    padding: "16px 20px",
                    marginBottom: 20,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      {/* Sort selection */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.sortByLabel || "Sắp xếp theo:"}</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border-light)",
                            background: "var(--bg-input)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="price_asc">{t.sortPriceAsc || "Giá vé: Thấp đến Cao"}</option>
                          <option value="price_desc">{t.sortPriceDesc || "Giá vé: Cao đến Thấp"}</option>
                          <option value="time_asc">{t.sortTimeAsc || "Giờ đi: Sớm nhất đến Muộn nhất"}</option>
                          <option value="time_desc">{t.sortTimeDesc || "Giờ đi: Muộn nhất đến Sớm nhất"}</option>
                          <option value="duration_asc">{t.sortDurationAsc || "Thời gian chạy: Ngắn nhất"}</option>
                        </select>
                      </div>

                      {/* Seat Availability Filter */}
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={filterAvailableOnly}
                          onChange={(e) => setFilterAvailableOnly(e.target.checked)}
                          style={{ accentColor: "#ef4444", width: 16, height: 16, cursor: "pointer" }}
                        />
                        {t.availableSeatsOnly || "Chỉ chuyến còn ghế trống"}
                      </label>
                    </div>

                    {/* Time Range Filter (Presets Only) */}
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                        🕒 {t.departureTimeRange || "Khung giờ khởi hành:"}
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {[
                          { label: t.timeRangeAll || "Tất cả", range: [0, 24] },
                          { label: t.timeRangeEarlyMorning || "Sáng sớm (0 - 6h)", range: [0, 6] },
                          { label: t.timeRangeMorning || "Sáng (6 - 12h)", range: [6, 12] },
                          { label: t.timeRangeAfternoon || "Chiều (12 - 18h)", range: [12, 18] },
                          { label: t.timeRangeEvening || "Tối (18 - 24h)", range: [18, 24] },
                        ].map(preset => {
                          const isSelected = timeRange[0] === preset.range[0] && timeRange[1] === preset.range[1];
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setTimeRange(preset.range)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 20,
                                border: isSelected
                                  ? "1.5px solid var(--primary)"
                                  : "1px solid var(--border-main)",
                                background: isSelected
                                  ? "var(--primary)"
                                  : "var(--bg-card)",
                                color: isSelected
                                  ? "#ffffff"
                                  : "var(--text-main)",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                boxShadow: isSelected ? "0 2px 8px rgba(79, 124, 255, 0.3)" : "none",
                              }}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Provider Filter Pills */}
                    {allProviders.length > 0 && (
                      <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.busProvider || "Nhà xe:"}</span>
                        {allProviders.map(pName => {
                          const isChecked = filterProviders.includes(pName);
                          return (
                            <button
                              key={pName}
                              type="button"
                              onClick={() => {
                                setFilterProviders(prev =>
                                  isChecked ? prev.filter(x => x !== pName) : [...prev, pName]
                                );
                              }}
                              style={{
                                padding: "5px 12px",
                                borderRadius: 20,
                                border: isChecked ? "1.5px solid #ef4444" : "1px solid var(--border-light)",
                                background: isChecked ? "#fef2f2" : "var(--bg-input)",
                                color: isChecked ? "#ef4444" : "var(--text-primary)",
                                fontSize: 12,
                                fontWeight: isChecked ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                            >
                              {isChecked ? "✓ " : ""}{pName}
                            </button>
                          );
                        })}
                        {filterProviders.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFilterProviders([])}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            {t.clearBusFilter || "Xóa lọc nhà xe"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {filteredTrips.length === 0 ? (
                    <div style={{
                      textAlign: "center", padding: "40px 20px", background: "var(--bg-card)",
                      borderRadius: 16, border: "1px dashed var(--border-light)", color: "var(--text-secondary)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%", background: "var(--bg-input)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 20
                      }}>
                        <FiSearch />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, maxWidth: 480, lineHeight: 1.5 }}>
                        {t.noMatchingBusTrips || "Không có chuyến xe khách nào phù hợp với bộ lọc hiện tại. Hãy thử mở rộng khung giờ hoặc bỏ chọn lọc."}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {filteredTrips.map((trip) => {
                        const isSelected = selectedTrip?.id === trip.id;
                        const isCheapest = trip.price === minPrice;
                        const seatPct = trip.availableSeats / (trip.totalSeats || 1);
                        const seatWarning = trip.availableSeats <= 5;

                        const parseTripTime = (timeStr) => {
                          if (!timeStr) return null;
                          if (timeStr.includes("T")) return new Date(timeStr);
                          return new Date(`2000-01-01T${timeStr}`);
                        };
                        const formatTimeDisplay = (timeStr) => {
                          if (!timeStr) return "--:--";
                          if (timeStr.includes("T")) {
                            const timePart = timeStr.split("T")[1];
                            return timePart ? timePart.slice(0, 5) : "--:--";
                          }
                          return timeStr.slice(0, 5);
                        };

                        const dep = parseTripTime(trip.departureTime);
                        const arr = parseTripTime(trip.arrivalTime);
                        let duration = "";
                        if (dep && arr) {
                          let diff = (arr - dep) / 60000;
                          if (diff < 0) diff += 1440;
                          const hours = Math.floor(diff / 60);
                          const mins = Math.round(diff % 60);
                          const hUnit = t.durationHours || "g";
                          const mUnit = t.durationMins || "ph";
                          duration = `${hours}${hUnit}${mins > 0 ? ` ${mins}${mUnit}` : ""}`;
                        }

                        const pInfo = PROVIDER_LOGOS[trip.providerName];
                        const pColor = pInfo?.color || "#ef4444";
                        const initials = (trip.providerName || "FUTA")
                          .split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();

                        return (
                          <div
                            key={trip.id}
                            onClick={() => handleSelectTrip(trip)}
                            style={{
                              background: isSelected
                                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15))"
                                : "var(--bg-card)",
                              border: isSelected
                                ? "2px solid #f87171"
                                : "1.5px solid var(--border-light)",
                              borderRadius: 16,
                              padding: "18px 22px",
                              cursor: "pointer",
                              transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                              boxShadow: isSelected
                                ? "0 6px 24px rgba(239,68,68,0.18)"
                                : "0 2px 8px rgba(0,0,0,0.05)",
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {isCheapest && (
                              <div style={{
                                position: "absolute", top: 0, right: 0,
                                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                                color: "#fff", fontSize: 11, fontWeight: 700,
                                padding: "4px 12px 4px 16px",
                                borderBottomLeftRadius: 12,
                                letterSpacing: "0.5px",
                              }}>
                                🏷️ {t.cheapest || "RẺ NHẤT"}
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                              {/* Provider Logo Circle / Badge */}
                              <div style={{
                                width: 52, height: 52, borderRadius: 14,
                                background: pInfo?.bg || "#fef2f2",
                                border: `1.5px solid ${pColor}44`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, padding: 4, overflow: "hidden", position: "relative",
                              }}>
                                <div style={{ textAlign: "center" }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: pColor, lineHeight: 1, display: "block" }}>
                                    {pInfo?.code || initials}
                                  </span>
                                  <span style={{ fontSize: 8, color: pColor + "bb", fontWeight: 600, marginTop: 2, display: "block" }}>
                                    {t.busBadge || "XE KHÁCH"}
                                  </span>
                                </div>
                                {pInfo?.logo && (
                                  <img
                                    src={pInfo.logo}
                                    alt={trip.providerName}
                                    style={{
                                      position: "absolute", inset: 0, width: "100%", height: "100%",
                                      objectFit: "contain", padding: 6, background: pInfo?.bg || "#fff",
                                    }}
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                )}
                              </div>

                              {/* Provider name */}
                              <div style={{ minWidth: 110, flexShrink: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                                  {trip.providerName}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                  {trip.vehicleType || t.sleeperBus || "Xe giường nằm"}
                                </div>
                              </div>

                              {/* Separator */}
                              <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                              {/* Time + route block */}
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                                {/* Departure */}
                                <div style={{ textAlign: "center", minWidth: 70 }}>
                                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                                    {formatTimeDisplay(trip.departureTime)}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                                    {trip.origin}
                                  </div>
                                </div>

                                {/* Route line */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 80 }}>
                                  {duration && (
                                    <div style={{
                                      fontSize: 11, color: "#ef4444", fontWeight: 700,
                                      background: "#fef2f2", padding: "2px 10px", borderRadius: 20,
                                    }}>
                                      ⏱ {duration}
                                    </div>
                                  )}
                                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4 }}>
                                    <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#ef444444,#ef4444)" }} />
                                    <TbBus style={{ fontSize: 16, color: "#ef4444" }} />
                                    <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#ef4444,#ef444444)" }} />
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.directRoute || "Chạy thẳng"}</div>
                                </div>

                                {/* Arrival */}
                                <div style={{ textAlign: "center", minWidth: 70 }}>
                                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                                    {formatTimeDisplay(trip.arrivalTime)}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                                    {trip.destination}
                                  </div>
                                </div>
                              </div>

                              {/* Separator */}
                              <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                              {/* Seat availability */}
                              <div style={{ minWidth: 90, textAlign: "center", flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{t.availableSeats || "Chỗ trống"}</div>
                                <div style={{
                                  fontSize: 13, fontWeight: 700,
                                  color: seatWarning ? "#ef4444" : "#22c55e",
                                }}>
                                  {trip.availableSeats}/{trip.totalSeats}
                                </div>
                                <div style={{ marginTop: 5, height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
                                  <div style={{
                                    height: "100%", borderRadius: 4,
                                    width: `${Math.round(seatPct * 100)}%`,
                                    background: seatWarning
                                      ? "linear-gradient(90deg,#ef4444,#f97316)"
                                      : "linear-gradient(90deg,#22c55e,#4ade80)",
                                    transition: "width 0.4s",
                                  }} />
                                </div>
                                {seatWarning && (
                                  <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>
                                    {t.almostSoldOut || "Sắp hết vé!"}
                                  </div>
                                )}
                              </div>

                              {/* Separator */}
                              <div style={{ width: 1, height: 44, background: "var(--border-light)", flexShrink: 0 }} />

                              {/* Price + CTA */}
                              <div style={{ textAlign: "center", minWidth: 130, flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.pricePerPerson || "Giá/người"}</div>
                                <div style={{
                                  fontSize: 20, fontWeight: 900,
                                  color: "#ef4444",
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                  marginBottom: 8,
                                }}>
                                  {trip.price?.toLocaleString("vi-VN")}đ
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); handleSelectTrip(trip); }}
                                  style={{
                                    background: isSelected
                                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                                      : "linear-gradient(135deg,#ef4444,#dc2626)",
                                    color: "#fff", border: "none",
                                    padding: "8px 22px", borderRadius: 10,
                                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                                    width: "100%",
                                    boxShadow: isSelected
                                      ? "0 4px 12px rgba(34,197,94,0.35)"
                                      : "0 4px 12px rgba(239,68,68,0.35)",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {isSelected ? (t.selected || "✓ Đã chọn") : (t.selectTicket || "Chọn vé")}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}


            {["seatClass", "passenger", "extras", "review"].includes(step) && (
              <div style={{ marginBottom: 20, background: "var(--bg-card)", borderRadius: 12, padding: "16px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                {timeLeft !== null && (
                  <div style={{
                    marginBottom: 16,
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: timeLeft < 120 ? "#fef2f2" : "#f0fdf4",
                    border: timeLeft < 120 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontWeight: 700,
                    color: timeLeft < 120 ? "#991b1b" : "#166534",
                    fontSize: 14
                  }}>
                    <span>⏱️ Thời gian giữ ghế còn lại: </span>
                    <span style={{ fontSize: 16, fontFamily: "monospace" }}>
                      {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                      {(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                  <div style={{ position: "absolute", top: 21, left: "12%", right: "12%", height: 3, background: "var(--border-main)", zIndex: 0 }} />
                  {[
                    { key: "seatClass", icon: <FaChair />, label: t.step1Title },
                    { key: "passenger", icon: <FaUser />, label: t.step2Title },
                    { key: "extras", icon: <FaConciergeBell />, label: t.step3Title },
                    { key: "review", icon: <FaCreditCard />, label: t.step4Title },
                  ].map((s) => {
                    const orderMap = { seatClass: 0, passenger: 1, extras: 2, review: 3 };
                    const current = orderMap[step];
                    const isDone = orderMap[s.key] < current;
                    const isActive = s.key === step;
                    return (
                      <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, flex: 1 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: isDone ? "linear-gradient(135deg,#22c55e,#16a34a)" : isActive ? "var(--primary)" : "var(--bg-input)",
                          color: isDone || isActive ? "#fff" : "var(--text-muted)",
                          border: isActive ? "none" : "1px solid var(--border-main)",
                          fontWeight: 700, fontSize: 18, transition: "all .3s",
                          boxShadow: isActive ? "0 4px 12px rgba(239,68,68,0.35)" : "none"
                        }}>{isDone ? "✓" : s.icon}</div>
                        <div style={{ marginTop: 8, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--primary)" : "var(--text-secondary)" }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTrip && step === "seatClass" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--text-main)" }}>Bước 1: Chọn hạng vé & ghế ngồi</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>Chọn hạng sau đó bấm vào ghế hoặc giường mong muốn.</p>
                  {!canSelectSeats(isAuthenticated, user) && (
                    <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 16, padding: "12px 16px", background: "rgba(245,158,11,0.1)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}>
                      {LOGIN_REQUIRED_SEAT_MSG}
                    </p>
                  )}

                  {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.loadingSeatmap}</p>}

                  {!loading && (() => {
                    const classTypes = [...new Set(seats.map(s => s.seatType || "ECONOMY"))];
                    return (
                      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setSelectedSeatClass("")} style={{
                          padding: "9px 20px", borderRadius: 24, border: `2px solid ${!selectedSeatClass ? "#ef4444" : "var(--border-input)"}`,
                          background: !selectedSeatClass ? "#ef4444" : "var(--bg-input)", color: !selectedSeatClass ? "#fff" : "var(--text-secondary)",
                          fontWeight: 700, cursor: "pointer", fontSize: 14, transition: "all 0.2s"
                        }}>Tất cả</button>
                        {classTypes.map(cls => (
                          <button key={cls} type="button" onClick={() => setSelectedSeatClass(cls)} style={{
                            padding: "9px 20px", borderRadius: 24,
                            border: `2px solid ${selectedSeatClass === cls ? "#ef4444" : "var(--border-input)"}`,
                            background: selectedSeatClass === cls ? "#ef4444" : "var(--bg-input)",
                            color: selectedSeatClass === cls ? "#fff" : "var(--text-secondary)",
                            fontWeight: 700, cursor: "pointer", fontSize: 14, transition: "all 0.2s"
                          }}>{cls === "SLEEPER" || cls === "BUSINESS" ? `🌟 Giường nằm VIP` : `💺 Ghế ngồi thường`}</button>
                        ))}
                      </div>
                    );
                  })()}

                  {!loading && seats.length > 0 && (() => {
                    const filteredSeats = selectedSeatClass
                      ? seats.filter(s => (s.seatType || "ECONOMY") === selectedSeatClass)
                      : seats;

                    const parse = (sn) => { const m = String(sn || "").match(/^(\d+)([A-Za-z])$/); return m ? { row: +m[1], col: m[2].toUpperCase() } : null; };
                    const items = filteredSeats.map(s => { const p = parse(s.seatNumber); return p ? { ...s, ...p } : null; }).filter(Boolean);
                    const cols = [...new Set(items.map(i => i.col))].sort();
                    const rows = [...new Set(items.map(i => i.row))].sort((a, b) => a - b);
                    const smap = new Map(items.map(i => [`${i.row}${i.col}`, i]));

                    const half = Math.ceil(cols.length / 2);
                    const leftCols = cols.slice(0, half);
                    const rightCols = cols.slice(half);

                    return (
                      <div style={{
                        overflowX: "auto",
                        background: "var(--bg-input)",
                        padding: "24px 30px",
                        borderRadius: "20px",
                        border: "2px solid var(--border-main)",
                        borderLeft: "8px solid #ef4444",
                        boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)",
                        position: "relative",
                        minWidth: "fit-content",
                        margin: "0 auto"
                      }}>
                        <div style={{ textAlign: "center", marginBottom: 20, color: "#ef4444", fontSize: 16, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>🚌</span> Đầu Xe & Sơ Đồ Giường / Ghế
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 10, marginBottom: 10, paddingLeft: 44, justifyContent: "center" }}>
                            {leftCols.map(c => <div key={c} style={{ width: 44, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>{c}</div>)}
                            <div style={{ width: 36 }} />
                            {rightCols.map(c => <div key={c} style={{ width: 44, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>{c}</div>)}
                          </div>
                        {rows.map(row => (
                          <div key={row} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 34, textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 13 }}>{row}</div>
                            {leftCols.map(col => {
                              const s = smap.get(`${row}${col}`);
                              if (!s) return <div key={col} style={{ width: 44, height: 50 }} />;
                              const sel = selectedSeatIds.includes(s.id);
                              const isLockedByOthers = isSeatLockedByOthers(s, user);
                              const isSleeper = s.seatType === "SLEEPER" || s.seatType === "BUSINESS";
                              return (
                                <button key={s.id} type="button" onClick={() => toggleSeat(s)} disabled={!canSelectSeats(isAuthenticated, user) || s.booked || isLockedByOthers || (!sel && isMaxReached)}
                                  title={`${s.seatNumber} ${s.seatType || "ECONOMY"} ${s.booked ? "(Đã đặt)" : isLockedByOthers ? "(Đang được người khác chọn)" : ""}`}
                                  style={{
                                    width: 44, height: isSleeper ? 56 : 42, borderRadius: isSleeper ? "10px" : "12px", border: "none",
                                    cursor: (s.booked || isLockedByOthers) ? "not-allowed" : "pointer",
                                    background: s.booked ? "#334155" : isLockedByOthers ? "rgba(239,68,68,0.3)" : sel ? "linear-gradient(135deg,#f59e0b,#d97706)" : (isSleeper ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)"),
                                    color: s.booked ? "#64748b" : "#fff", fontWeight: 800, fontSize: 13,
                                    boxShadow: sel ? "0 4px 12px rgba(245, 158, 11, 0.5)" : "0 2px 6px rgba(0,0,0,0.15)",
                                    borderBottom: s.booked ? "4px solid #1e293b" : isLockedByOthers ? "4px solid #ef4444" : sel ? "4px solid #b45309" : (isSleeper ? "4px solid #1d4ed8" : "4px solid #047857"),
                                    transition: "all 0.2s"
                                  }}>
                                  {isSleeper && !s.booked && !sel && !isLockedByOthers && <div style={{ fontSize: 9, lineHeight: 1 }}>🛏️</div>}
                                  <div>{s.booked ? "✗" : isLockedByOthers ? "🔒" : s.seatNumber}</div>
                                </button>
                              );
                            })}
                            <div style={{ width: 36, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>||</div>
                            {rightCols.map(col => {
                              const s = smap.get(`${row}${col}`);
                              if (!s) return <div key={col} style={{ width: 44, height: 50 }} />;
                              const sel = selectedSeatIds.includes(s.id);
                              const isLockedByOthers = isSeatLockedByOthers(s, user);
                              const isSleeper = s.seatType === "SLEEPER" || s.seatType === "BUSINESS";
                              return (
                                <button key={s.id} type="button" onClick={() => toggleSeat(s)} disabled={!canSelectSeats(isAuthenticated, user) || s.booked || isLockedByOthers || (!sel && isMaxReached)}
                                  title={`${s.seatNumber} ${s.seatType || "ECONOMY"} ${s.booked ? "(Đã đặt)" : isLockedByOthers ? "(Đang được người khác chọn)" : ""}`}
                                  style={{
                                    width: 44, height: isSleeper ? 56 : 42, borderRadius: isSleeper ? "10px" : "12px", border: "none",
                                    cursor: (s.booked || isLockedByOthers) ? "not-allowed" : "pointer",
                                    background: s.booked ? "#334155" : isLockedByOthers ? "rgba(239,68,68,0.3)" : sel ? "linear-gradient(135deg,#f59e0b,#d97706)" : (isSleeper ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)"),
                                    color: s.booked ? "#64748b" : "#fff", fontWeight: 800, fontSize: 13,
                                    boxShadow: sel ? "0 4px 12px rgba(245, 158, 11, 0.5)" : "0 2px 6px rgba(0,0,0,0.15)",
                                    borderBottom: s.booked ? "4px solid #1e293b" : isLockedByOthers ? "4px solid #ef4444" : sel ? "4px solid #b45309" : (isSleeper ? "4px solid #1d4ed8" : "4px solid #047857"),
                                    transition: "all 0.2s"
                                  }}>
                                  {isSleeper && !s.booked && !sel && !isLockedByOthers && <div style={{ fontSize: 9, lineHeight: 1 }}>🛏️</div>}
                                  <div>{s.booked ? "✗" : isLockedByOthers ? "🔒" : s.seatNumber}</div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                        </div>

                        <div style={{ display: "flex", gap: 16, marginTop: 20, fontSize: 13, color: "var(--text-secondary)", justifyContent: "center", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#10b981", borderRadius: 4 }} />Ghế thường</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#3b82f6", borderRadius: 4 }} />Giường nằm</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#f59e0b", borderRadius: 4 }} />Đang chọn</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "rgba(239,68,68,0.5)", borderRadius: 4 }} />Người khác đang chọn</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#334155", borderRadius: 4 }} />Đã đặt</span>
                        </div>
                      </div>
                    );
                  })()}

                  {!loading && seats.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.noSeatData}</p>}

                  {error && <p style={{ color: "#ef4444", marginTop: 12, fontSize: 14 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                    <button type="button" onClick={() => setStep("chooseTrip")} style={{
                      padding: "12px 26px", borderRadius: 10, border: "1px solid var(--border-main)",
                      background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer", fontSize: 14
                    }}>← Quay lại</button>
                    <button type="button" onClick={goToExtras} style={{
                      padding: "12px 32px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #ef4444, #f97316)", color: "#fff",
                      fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(239,68,68,0.4)"
                    }}>Tiếp theo →</button>
                  </div>
                </div>

                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>Thông tin đặt chỗ</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>🚌</span> <span>{selectedTrip.origin}</span> <span style={{ color: "#ef4444" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "#ef4444", fontSize: 14, flexShrink: 0 }} />
                      <span>{formatFormattedDateTime(selectedTrip.departureTime)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                      <TbBus style={{ color: "#ef4444", fontSize: 16, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(20,83,45,0.3)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.4)" }}>
                      <div style={{ fontSize: 12, color: "#86efac", fontWeight: 700, marginBottom: 4 }}>🟢 Ghế ngồi thường (ECO)</div>
                      <div style={{ fontWeight: 800, color: "#4ade80", fontSize: 16 }}>{Number(selectedTrip.price || 0).toLocaleString("vi-VN")} đ</div>
                    </div>
                    <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(30,58,138,0.3)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.4)" }}>
                      <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700, marginBottom: 4 }}>🔵 Giường nằm VIP (SLEEPER)</div>
                      <div style={{ fontWeight: 800, color: "#60a5fa", fontSize: 16 }}>{Number(getSeatPrice(selectedTrip.price, "SLEEPER")).toLocaleString("vi-VN")} đ</div>
                    </div>
                    <div style={{ marginTop: 12, color: selectedSeatIds.length >= (passengers || 1) ? "#22c55e" : "var(--text-muted)", fontWeight: 600 }}>Ghế đã chọn: {selectedSeatIds.length}/{passengers || 1}</div>
                  </div>
                </div>
              </div>
            )}

            {selectedTrip && step === "passenger" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-md)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Bước 2: Thông tin hành khách</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Nhập thông tin cá nhân của hành khách. Các ô có dấu * là bắt buộc.</p>

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
                    <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: "var(--text-main)", fontWeight: 500 }}>
                      <input type="checkbox" checked={globalContact.remember} onChange={e => setGlobalContact(p => ({ ...p, remember: e.target.checked }))} style={{ accentColor: "#ef4444", width: 16, height: 16 }} />
                      Lưu thông tin cho lần sau
                    </label>
                  </div>

                  {error && <p style={{ color: "#ef4444", marginTop: 12, fontSize: 14 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                    <button type="button" onClick={() => {
                      const seatsToUnlock = [...selectedSeatIds];
                      unlockSeats({
                        tripId: selectedTrip.id,
                        seatIds: seatsToUnlock,
                        userId: getSeatUserId(user),
                      });
                      setSelectedSeatIds([]);
                      setLockDeadline(null);
                      setStep("seatClass");
                    }} style={{
                      padding: "12px 26px", borderRadius: 10, border: "1px solid var(--border-main)",
                      background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer", fontSize: 14
                    }}>← Quay lại</button>
                    <button type="button" onClick={goToExtrasFromPassenger} style={{
                      padding: "12px 32px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #ef4444, #f97316)", color: "#fff",
                      fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(239,68,68,0.4)"
                    }}>Tiếp theo →</button>
                  </div>
                </div>

                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>Thông tin đặt chỗ</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>🚌</span> <span>{selectedTrip.origin}</span> <span style={{ color: "#ef4444" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "#ef4444", fontSize: 14, flexShrink: 0 }} />
                      <span>{formatFormattedDateTime(selectedTrip.departureTime)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                      <TbBus style={{ color: "#ef4444", fontSize: 16, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--bg-input)", borderRadius: 10, border: "1px solid var(--border-main)" }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Ghế đã chọn:</div>
                      <div style={{ fontWeight: 800, color: "#ef4444", fontSize: 15, marginBottom: 8 }}>
                        {seats.filter(s => selectedSeatIds.includes(s.id)).map(s => s.seatNumber).join(", ")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>TỔNG TIỀN VÉ</div>
                      <div style={{ fontWeight: 900, color: "#f97316", fontSize: 18, whiteSpace: "nowrap" }}>
                        {(() => {
                          const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                          const basePrice = Number(selectedTrip.price || 0);
                          const total = selSeats.reduce((sum, s) => sum + (s.seatType === "SLEEPER" || s.seatType === "BUSINESS" || s.seatType === "VIP" ? basePrice : basePrice), 0);
                          return `${total.toLocaleString("vi-VN")} đ`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {selectedTrip && step === "extras" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step3}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.extrasInstruction}</p>

                  {servicesLoading && <p style={{ color: "var(--text-muted)" }}>Đang tải dịch vụ...</p>}

                  {!servicesLoading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                      {/* Hành lý */}
                      <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, background: "var(--bg-input)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <FaTicketAlt style={{ color: "var(--primary)", fontSize: 22 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>{t.baggage}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Chọn gói hành lý phù hợp</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          <label style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 18px", borderRadius: 10,
                            border: `2px solid ${!selectedServiceIds.some(id => categories.baggage.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                            background: "var(--bg-card)", cursor: "pointer", minWidth: 80, textAlign: "center"
                          }}>
                            <input type="radio" name="baggage" style={{ display: "none" }}
                              checked={!selectedServiceIds.some(id => categories.baggage.map(s => s.id).includes(id))}
                              onChange={() => setSingleServiceInCategory(null, categories.baggage)} />
                            <span style={{ fontSize: 16, color: "var(--text-muted)" }}>✕</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 2 }}>Không mua thêm</span>
                          </label>
                          {categories.baggage.map(s => {
                            const isSel = selectedServiceIds.includes(s.id);
                            return (
                              <label key={s.id} style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 18px", borderRadius: 10,
                                border: `2px solid ${isSel ? "var(--primary)" : "var(--border-main)"}`,
                                background: "var(--bg-card)", cursor: "pointer", minWidth: 80, textAlign: "center"
                              }}>
                                <input type="radio" name="baggage" style={{ display: "none" }} checked={isSel} onChange={() => setSingleServiceInCategory(s.id, categories.baggage)} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{s.serviceName}</span>
                                <span style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}>{Number(s.price || 0).toLocaleString("vi-VN")} đ</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Suất ăn */}
                      <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: "20px", background: "var(--bg-input)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22, color: "#f59e0b" }}>🍱</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)" }}>{t.meal}</div>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Chọn món ăn trên chuyến đi</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{
                            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 30,
                            border: `2px solid ${!selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                            background: "var(--bg-card)", cursor: "pointer", fontWeight: 700, fontSize: 13,
                            color: !selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--text-secondary)"
                          }}>
                            <input type="radio" name="meal" style={{ display: "none" }}
                              checked={!selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id))}
                              onChange={() => setSingleServiceInCategory(null, categories.meal)} />
                            ✕ Không chọn suất ăn
                          </label>
                        </div>

                        {categories.meal.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-secondary)", fontSize: 13 }}>
                            Nhà xe hiện chưa cung cấp suất ăn trực tuyến.<br />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Bạn có thể mua trực tiếp tại trạm dừng chân.</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                              {(showAllMeals ? categories.meal : categories.meal.slice(0, 4)).map((s, index) => {
                                const fallbackImages = [
                                  "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=400&auto=format&fit=crop",
                                  "https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=400&auto=format&fit=crop",
                                  "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=400&auto=format&fit=crop",
                                  "https://images.unsplash.com/photo-1555126634-323283e090fa?q=80&w=400&auto=format&fit=crop"
                                ];
                                const img = s.img || fallbackImages[index % fallbackImages.length];
                                const isSelected = selectedServiceIds.includes(s.id);
                                const cleanName = s.serviceName.replace(/^Suất ăn\s*-\s*/i, '');
                                return (
                                  <div key={s.id} onClick={() => setSingleServiceInCategory(s.id, categories.meal)}
                                    style={{
                                      borderRadius: 12, overflow: "hidden", border: `2px solid ${isSelected ? "var(--primary)" : "var(--border-main)"}`,
                                      background: "var(--bg-card)", cursor: "pointer", position: "relative", transition: "all 0.2s",
                                      boxShadow: isSelected ? "0 4px 12px rgba(56, 139, 253, 0.2)" : "none"
                                    }}>
                                    <div style={{ height: 160, backgroundImage: `url("${encodeURI(img)}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                    <div style={{ padding: "10px 12px", background: "var(--bg-card)" }}>
                                      <div style={{
                                        fontWeight: 700, fontSize: 13, color: "var(--text-main)", lineHeight: 1.3,
                                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", height: 34
                                      }}>
                                        {cleanName}
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                                        <span style={{ color: "#f97316", fontWeight: 800, fontSize: 14 }}>{Number(s.price || 0).toLocaleString("vi-VN")} đ</span>
                                        <div style={{
                                          width: 22, height: 22, borderRadius: "50%", background: isSelected ? "var(--primary)" : "var(--bg-input)",
                                          display: "flex", alignItems: "center", justifyContent: "center", color: isSelected ? "#fff" : "var(--text-muted)", fontWeight: "bold", fontSize: 12
                                        }}>
                                          {isSelected ? "✓" : "+"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {categories.meal.length > 4 && (
                              <div style={{ textAlign: "center", marginTop: 14 }}>
                                <button
                                  type="button"
                                  onClick={() => setShowAllMeals(v => !v)}
                                  style={{
                                    padding: "8px 20px", borderRadius: 20, border: "1px solid var(--border-main)",
                                    background: "var(--bg-card)", color: "var(--primary)", fontWeight: 700, fontSize: 13,
                                    cursor: "pointer", transition: "all 0.2s"
                                  }}
                                >
                                  {showAllMeals ? "▲ Thu gọn bớt" : `▼ Xem thêm ${categories.meal.length - 4} món ăn khác`}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Bảo hiểm & Xe đưa đón */}
                      {[{ cat: categories.insurance, icon: <FaShieldAlt style={{ color: "#22c55e", fontSize: 22 }} />, title: "Bảo hiểm chuyến đi", sub: "Bảo vệ chuyến đi của bạn" },
                      { cat: categories.taxi, icon: <FaTaxi style={{ color: "#f59e0b", fontSize: 22 }} />, title: "Xe trung chuyển", sub: "Đưa đón tận nơi tiện lợi" }]
                        .map(({ cat, icon, title, sub }) => (
                          cat.length > 0 && (
                            <div key={title} style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, background: "var(--bg-input)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {icon}
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>{title}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
                                  </div>
                                </div>
                                {title === "Bảo hiểm chuyến đi" && (
                                  <button
                                    type="button"
                                    onClick={() => setShowInsuranceInfo(v => !v)}
                                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                                  >
                                    {showInsuranceInfo ? "Ẩn" : "So sánh gói"}
                                  </button>
                                )}
                              </div>

                              {title === "Bảo hiểm chuyến đi" && showInsuranceInfo && (
                                <div style={{ marginBottom: 14, padding: 14, background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-main)", fontSize: 13 }}>
                                  <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>📋 So sánh gói bảo hiểm</div>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: "var(--bg-input)" }}>
                                        <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--border-main)", color: "var(--text-main)" }}>Quyền lợi</th>
                                        <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid var(--border-main)", color: "#22c55e" }}>Cơ bản</th>
                                        <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid var(--border-main)", color: "#60a5fa" }}>Cao cấp</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[
                                        ["Tai nạn trên xe", "50 triệu đ", "100 triệu đ"],
                                        ["Hủy chuyến đột xuất", "✕", "Hoàn 100%"],
                                        ["Hành lý thất lạc", "1 triệu đ", "3 triệu đ"],
                                        ["Chi phí y tế", "2 triệu đ", "10 triệu đ"],
                                        ["Trễ chuyến > 3 tiếng", "✕", "100.000đ"],
                                      ].map(([benefit, basic, premium]) => (
                                        <tr key={benefit} style={{ borderBottom: "1px solid var(--border-main)" }}>
                                          <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{benefit}</td>
                                          <td style={{ padding: "6px 8px", textAlign: "center", color: basic === "✕" ? "var(--text-muted)" : "#22c55e" }}>{basic}</td>
                                          <td style={{ padding: "6px 8px", textAlign: "center", color: premium === "✕" ? "var(--text-muted)" : "#60a5fa", fontWeight: 600 }}>{premium}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--bg-input)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 11 }}>
                                    💡 <b>Gợi ý:</b> Gói <b>Cơ bản</b> phù hợp cho hành trình ngắn. Chọn <b>Cao cấp</b> nếu bạn đi xa, mang nhiều hành lý có giá trị.
                                  </div>
                                </div>
                              )}

                              <label style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10,
                                border: `1.5px solid ${!selectedServiceIds.some(id => cat.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                                background: "var(--bg-card)", cursor: "pointer", marginBottom: 8, fontWeight: 600, fontSize: 13,
                                color: !selectedServiceIds.some(id => cat.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--text-secondary)"
                              }}>
                                <input type="radio" name={`cat_${title}`} style={{ display: "none" }}
                                  checked={!selectedServiceIds.some(id => cat.map(s => s.id).includes(id))}
                                  onChange={() => setSingleServiceInCategory(null, cat)} />
                                Không chọn
                              </label>

                              {cat.map(s => {
                                const shortName = s.serviceName.replace(/^(Bảo hiểm chuyến đi|Xe trung chuyển)\s*/i, '');
                                const sel = selectedServiceIds.includes(s.id);
                                return (
                                  <label key={s.id}
                                    onClick={() => setSingleServiceInCategory(s.id, cat)}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "12px 14px", borderRadius: 10, background: "var(--bg-card)",
                                      border: `1.5px solid ${sel ? "var(--primary)" : "var(--border-main)"}`,
                                      cursor: "pointer", marginBottom: 8
                                    }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{shortName || s.serviceName}</div>
                                        {sel && <div style={{ fontSize: 11, color: "var(--primary)" }}>✓ Đã chọn</div>}
                                      </div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: 14, color: "#f97316", flexShrink: 0 }}>
                                      {Number(s.price || 0) === 0 ? "Miễn phí" : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )
                        ))}
                    </div>
                  )}

                  {error && <p style={{ color: "#ef4444", marginTop: 12 }}>{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("passenger")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToReview} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.reviewAndPay} →</button>
                  </div>
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.totalCost}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                    {(() => {
                      const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                      const basePrice = Number(selectedTrip.price || 0);
                      const seatsTotal = selSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s.seatType), 0);
                      const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-main)", gap: 8 }}>
                            <span>Giá vé ({selectedSeatIds.length} ghế)</span>
                            <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{seatsTotal.toLocaleString("vi-VN")} đ</b>
                          </div>
                          {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--text-secondary)", gap: 10, marginTop: 4 }}>
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {s.serviceName}</span>
                              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0) === 0 ? "Miễn phí" : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}</b>
                            </div>
                          ))}
                          {membershipDiscount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 6, fontWeight: 600, gap: 8 }}>
                              <span>🏅 Ưu đãi thành viên ({user.promotion.discountRate}%)</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{membershipDiscount.toLocaleString("vi-VN")} đ</span>
                            </div>
                          )}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>Tổng cộng</span>
                            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>{Math.max(0, seatsTotal + extraTotal - membershipDiscount).toLocaleString("vi-VN")} đ</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}


            {selectedTrip && step === "review" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step4}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.reviewInstruction}</p>


                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>🚌 Chuyến xe</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-main)" }}>{selectedTrip.origin} → {selectedTrip.destination}</div>
                        <div style={{ color: "var(--text-main)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>{selectedTrip.departureTime} · {selectedTrip.providerName}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17, whiteSpace: "nowrap" }}>
                        {(() => {
                          const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                          const basePrice = Number(selectedTrip.price || 0);
                          return selSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s), 0).toLocaleString("vi-VN");
                        })()} đ
                      </div>
                    </div>
                  </div>


                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}><FaUser /> Hành khách</div>
                    {passengerInfoList.map((pi, idx) => (
                      <div key={idx} style={{ fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: idx < passengerInfoList.length - 1 ? "1px dashed var(--border-main)" : "none", color: "var(--text-main)", lineHeight: 1.6 }}>
                        <b style={{ fontSize: 15 }}>{pi.data.fullName || `Hành khách ${idx + 1}`}</b> <span style={{ color: "var(--text-secondary)" }}>({pi.type === 'ADULT' ? 'Người lớn' : pi.type === 'CHILD' ? 'Trẻ em' : 'Em bé'})</span>
                        {pi.type === 'ADULT' && <div style={{ color: "var(--text-main)", marginTop: 2 }}>{pi.data.email} · {pi.data.phone ? `${pi.data.phone}` : ''}</div>}
                        <div style={{ marginTop: 2, color: "var(--text-main)" }}>Ngày sinh: <b>{pi.data.dateOfBirth}</b> | Giới tính: <b>{pi.data.gender === 'Male' ? 'Nam' : pi.data.gender === 'Female' ? 'Nữ' : 'Khác'}</b></div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, color: "var(--text-main)", fontSize: 14 }}>Ghế: <b style={{ fontSize: 15, color: "#f97316" }}>{seats.filter(s => selectedSeatIds.includes(s.id)).map(s => s.seatNumber).join(", ") || "Chưa chọn"}</b></div>
                  </div>


                  {selectedServiceIds.length > 0 && (
                    <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)" }}>🛎 Dịch vụ bổ sung</div>
                      {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6, color: "var(--text-main)", gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{s.serviceName}</span>
                          <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0).toLocaleString("vi-VN")} đ</b>
                        </div>
                      ))}
                    </div>
                  )}


                  <div style={{ border: "1px dashed var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}><FaTicketAlt style={{ color: "var(--primary)" }} /> {t.promoCodeLabel}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Nhập mã ưu đãi..."
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--text-main)", fontSize: 14 }} />
                      <button type="button" onClick={handleApplyVoucher} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.applyPromo}</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{t.promoInstruction}</div>
                  </div>

                  {error && <p style={{ color: "#ef4444", marginTop: 4 }}>{error}</p>}

                  {bookingResult ? (
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(34, 197, 94, 0.1)", border: "1px solid #22c55e", marginTop: 8 }}>
                      <div style={{ fontWeight: 800, color: "#22c55e", fontSize: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MdOutlineDone /> {t.successBooking}</div>
                      <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.9 }}>
                        <div>Mã booking: <b style={{ color: "var(--primary)" }}>#{bookingResult.id}</b></div>
                        <div>{t.totalCost}: <b style={{ color: "#f97316" }}>{Number(bookingResult.totalPrice || 0).toLocaleString("vi-VN")} đ</b></div>
                        <div>Ghế: {Array.isArray(bookingResult.seatNumbers) ? bookingResult.seatNumbers.join(", ") : ""}</div>
                      </div>
                      <button type="button"
                        onClick={async () => {
                          try {
                            const res = await axios.post("/api/payment/create", { bookingId: bookingResult.id, language: "vn" }, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data && res.data.paymentUrl) {
                              window.location.href = res.data.paymentUrl;
                            } else {
                              alert("Máy chủ VNPay Sandbox chưa phản hồi liên kết thanh toán.");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Lỗi kết nối VNPay Sandbox. Vui lòng kiểm tra lại cấu hình cổng thanh toán backend.");
                          }
                        }}
                        style={{ marginTop: 14, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#005baa", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <MdOutlineCreditCard fontSize={20} /> {t.paymentVNPAY}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                      <button type="button" onClick={() => setStep("extras")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                      <button type="button" onClick={submitBooking} disabled={submitLoading}
                        style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {submitLoading ? "Đang xử lý..." : "Đặt vé ngay →"}
                      </button>
                    </div>
                  )}
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.paymentDetails}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                    {(() => {
                      const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                      const basePrice = Number(selectedTrip.price || 0);
                      const seatsTotal = selSeats.reduce((sum, s) => sum + getSeatPrice(basePrice, s), 0);
                      const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-main)", gap: 8 }}>
                            <span>Giá vé ({selectedSeatIds.length} ghế)</span>
                            <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{seatsTotal.toLocaleString("vi-VN")} đ</b>
                          </div>
                          {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--text-main)", gap: 10, marginTop: 4 }}>
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {s.serviceName}</span>
                              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0) === 0 ? "Miễn phí" : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}</b>
                            </div>
                          ))}
                          {membershipDiscount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 6, fontWeight: 600, gap: 8 }}>
                              <span>🏅 Ưu đãi thành viên ({user.promotion.discountRate}%)</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{membershipDiscount.toLocaleString("vi-VN")} đ</span>
                            </div>
                          )}
                          {appliedVoucher && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 4, gap: 8 }}>
                              <span>🎟 Mã: {appliedVoucher}</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{voucherDiscount.toLocaleString("vi-VN")} đ</span>
                            </div>
                          )}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>Tổng cộng</span>
                            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>{Math.max(0, seatsTotal + extraTotal - membershipDiscount - voucherDiscount).toLocaleString("vi-VN")} đ</span>
                          </div>
                        </>
                      );
                    })()}
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

export default BusTickets;
