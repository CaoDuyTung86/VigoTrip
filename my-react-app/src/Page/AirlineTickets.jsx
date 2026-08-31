import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import { useSavedPassengers } from "../context/SavedPassengersContext";
import PassengerInfoForm from "../components/PassengerInfoForm";
import { validatePassengerDob } from "../utils/passengerValidation";
import AirplaneSeatMap from "../components/AirplaneSeatMap";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import SavedVoucherPicker from "../components/SavedVoucherPicker";
import { FiLock, FiInfo } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import useCountdown from "../hooks/useCountdown";
import useSeatLockRekey from "../hooks/useSeatLockRekey";
import HoldCountdownBanner from "../components/HoldCountdownBanner";
import {
  canSelectSeats,
  getSeatUserId,
  isSeatLockedByOthers,
} from "../utils/seatBookingHelpers";
import { getMealImage } from "../utils/mealImages";
import { useLocation } from "react-router-dom";
import { CgSandClock } from "react-icons/cg";
import { IoMdSearch } from "react-icons/io";
import { FiChevronDown, FiClock, FiSearch } from "react-icons/fi";
import { FaPlaneDeparture, FaPlaneArrival, FaRegCalendarAlt, FaUser, FaBell, FaShieldAlt, FaTaxi, FaChair, FaTicketAlt } from "react-icons/fa";
import { RiBuilding4Line } from "react-icons/ri";
import { MdOutlineDone } from "react-icons/md";
import { CiCreditCard1 } from "react-icons/ci";

/**
 * Thời gian giữ chỗ của một đơn PENDING chưa bấm thanh toán.
 * PHẢI khớp BookingCleanupService.PENDING_HOLD_MINUTES ở backend.
 */
const PENDING_HOLD_MS = 5 * 60 * 1000;


const PROVIDER_LOGOS = {
  "Vietnam Airlines": {
    logo: "/logos/vietnamairlines.jpg",
    code: "VN",
    color: "#005baa",
    bg: "#e6f0fa",
  },
  "Vietjet Air": {
    logo: "/logos/VietjetAir.jpg",
    code: "VJ",
    color: "#e3001b",
    bg: "#fde8eb",
  },
  "Bamboo Airways": {
    logo: "/logos/bambooairways.jpg",
    code: "QH",
    color: "#00843d",
    bg: "#e6f3ec",
  },
};

const AirlineTickets = () => {
  const { t, currentLanguage } = useLanguage();
  const { token, isAuthenticated, user, membershipDiscountPercent } = useAuth();
  const { showToast } = useToast();
  const { isConnected, subscribe, lockSeats, unlockSeats } = useWebSocket();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const airportTranslations = {
    vi: {
      HAN: { name: "Hà Nội", fullName: "Hà Nội (HAN) - Nội Bài" },
      SGN: { name: "TP. HCM", fullName: "TP. Hồ Chí Minh (SGN) - Tân Sơn Nhất" },
      DAD: { name: "Đà Nẵng", fullName: "Đà Nẵng (DAD)" },
      VCL: { name: "Chu Lai", fullName: "Chu Lai (VCL) - Quảng Nam" },
      PQC: { name: "Phú Quốc", fullName: "Phú Quốc (PQC)" },
      CXR: { name: "Nha Trang", fullName: "Nha Trang (CXR) - Cam Ranh" },
      DLI: { name: "Đà Lạt", fullName: "Đà Lạt (DLI) - Liên Khương" },
      HPH: { name: "Hải Phòng", fullName: "Hải Phòng (HPH) - Cát Bi" },
      HUI: { name: "Huế", fullName: "Huế (HUI) - Phú Bài" },
      VII: { name: "Vinh", fullName: "Vinh (VII)" },
    },
    en: {
      HAN: { name: "Hanoi", fullName: "Hanoi (HAN) - Noi Bai Intl" },
      SGN: { name: "Ho Chi Minh City", fullName: "Ho Chi Minh City (SGN) - Tan Son Nhat Intl" },
      DAD: { name: "Da Nang", fullName: "Da Nang (DAD) - Da Nang Intl" },
      VCL: { name: "Chu Lai", fullName: "Chu Lai (VCL) - Quang Nam" },
      PQC: { name: "Phu Quoc", fullName: "Phu Quoc (PQC) - Phu Quoc Intl" },
      CXR: { name: "Nha Trang", fullName: "Nha Trang (CXR) - Cam Ranh Intl" },
      DLI: { name: "Da Lat", fullName: "Da Lat (DLI) - Lien Khuong Airport" },
      HPH: { name: "Hai Phong", fullName: "Hai Phong (HPH) - Cat Bi Intl" },
      HUI: { name: "Hue", fullName: "Hue (HUI) - Phu Bai Intl" },
      VII: { name: "Vinh", fullName: "Vinh (VII) - Vinh Airport" },
    },
    ja: {
      HAN: { name: "ハノイ", fullName: "ハノイ (HAN) - ノイバイ国際空港" },
      SGN: { name: "ホーチミン", fullName: "ホーチミン (SGN) - タンソンニャット国際空港" },
      DAD: { name: "ダナン", fullName: "ダナン (DAD) - ダナン国際空港" },
      VCL: { name: "チュライ", fullName: "チュライ (VCL) - クアンナム" },
      PQC: { name: "フーコック", fullName: "フーコック (PQC) - フーコック国際空港" },
      CXR: { name: "ニャチャン", fullName: "ニャチャン (CXR) - カムラン国際空港" },
      DLI: { name: "ダラット", fullName: "ダラット (DLI) - リエンクオン空港" },
      HPH: { name: "ハイフォン", fullName: "ハイフォン (HPH) - カットビ国際空港" },
      HUI: { name: "フエ", fullName: "フエ (HUI) - フーバイ国際空港" },
      VII: { name: "ヴィン", fullName: "ヴィン (VII) - ヴィン空港" },
    },
    zh: {
      HAN: { name: "河內", fullName: "河內 (HAN) - 內排國際機場" },
      SGN: { name: "胡志明市", fullName: "胡志明市 (SGN) - 新山一國際機場" },
      DAD: { name: "峴港", fullName: "峴港 (DAD) - 峴港國際機場" },
      VCL: { name: "朱萊", fullName: "朱萊 (VCL) - 廣南" },
      PQC: { name: "富國島", fullName: "富國島 (PQC) - 富國國際機場" },
      CXR: { name: "芽莊", fullName: "芽莊 (CXR) - 金蘭國際機場" },
      DLI: { name: "大叻", fullName: "大叻 (DLI) - 蓮姜機場" },
      HPH: { name: "海防", fullName: "海防 (HPH) - 吉碑國際機場" },
      HUI: { name: "順化", fullName: "順化 (HUI) - 符牌國際機場" },
      VII: { name: "榮市", fullName: "榮市 (VII) - 榮市機場" },
    }
  };

  const airports = useMemo(() => {
    const lang = currentLanguage?.code || "vi";
    const dict = airportTranslations[lang] || airportTranslations.vi;
    const baseCodes = ["HAN", "SGN", "DAD", "VCL", "PQC", "CXR", "DLI", "HPH", "HUI", "VII"];
    return baseCodes.map(code => ({
      code,
      name: dict[code]?.name || code,
      fullName: dict[code]?.fullName || code
    }));
  }, [currentLanguage]);

  const [from, setFrom] = useState("HAN");
  const [to, setTo] = useState("SGN");
  const [passengerCounts, setPassengerCounts] = useState({ adult: 1, child: 0, infant: 0 });
  const [showPassengersDropdown, setShowPassengersDropdown] = useState(false);
  const passengers = passengerCounts.adult + passengerCounts.child;
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [step, setStep] = useState("search");
  // Vào luồng đặt vé rồi thì số hành khách phải cố định: ghế đang giữ, tiền tạm tính và
  // danh sách form thông tin hành khách đều sinh ra từ con số này. Cho sửa giữa chừng sẽ
  // đẻ thêm/bớt ô điền thông tin trong khi số ghế giữ không đổi, dẫn tới lệch người/ghế.
  const passengerCountLocked = Boolean(selectedTrip) && ["seatClass", "passenger", "extras", "review"].includes(step);
  const [lockDeadline, setLockDeadline] = useState(null);
  const [paymentDeadline, setPaymentDeadline] = useState(null);
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
          // Diff < 30 minutes (30 * 60 * 1000 = 1800000 ms)
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
        if (update.status === "LOCK_FAILED") return; // Bỏ qua tin nhắn lock thất bại
        if (update.tripId === selectedTrip.id) {
          const currentUserId = getSeatUserId(user);
          const isLockedByOther = (update.status === "SELECTED" || update.status === "BOOKED") && update.userId !== currentUserId;
          
          if (isLockedByOther) {
            setSelectedSeatIds((prev) => {
              if (prev.includes(update.seatId)) {
                setError(t.airSeatTakenByOther);
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

  // Giữ ghế bằng lock tạm ở backend (SeatLockService, 10 phút). Hết giờ thì nhả ghế.
  const timeLeft = useCountdown(lockDeadline, () => {
    unlockSeats({
      tripId: selectedTrip?.id,
      seatIds: selectedSeatIds,
      userId: getSeatUserId(user),
    });
    setSelectedSeatIds([]);
    setLockDeadline(null);
    setError(t.airSeatHoldTimeout);
    setStep("seatClass");
  });

  // Sau khi tạo đơn, ghế do đơn PENDING giữ chứ không còn lock tạm nữa
  // (BookingCleanupService.PENDING_HOLD_MINUTES) — đây là thời gian còn lại để bấm
  // sang cổng thanh toán. Bấm rồi thì backend tự gia hạn theo phiên của cổng.
  const paymentTimeLeft = useCountdown(paymentDeadline, () => {
    setPaymentDeadline(null);
    setBookingResult(null);
    setSelectedSeatIds([]);
    setError(t.paymentHoldTimeout);
    setStep("seatClass");
  });

  // Đăng nhập / đăng xuất giữa chừng làm đổi danh tính giữ ghế (khoá thiết bị <-> email).
  // Không chuyển lock theo thì bước tạo đơn sẽ báo "ghế đang được giữ bởi người khác",
  // mà người khác đó chính là phiên khách vãng lai của chính họ vài phút trước.
  useSeatLockRekey({
    ownerId: getSeatUserId(user),
    tripId: selectedTrip?.id,
    seatIds: selectedSeatIds,
    active: !!lockDeadline,
    lockSeats,
    unlockSeats,
    onFailure: () => {
      setSelectedSeatIds([]);
      setLockDeadline(null);
      setError(t.seatRekeyFailed);
      setStep("seatClass");
    },
  });

  useEffect(() => {
    const newList = [];
    for (let i = 0; i < passengerCounts.adult; i++) newList.push({ type: "ADULT", data: {} });
    for (let i = 0; i < passengerCounts.child; i++) newList.push({ type: "CHILD", data: {} });
    for (let i = 0; i < passengerCounts.infant; i++) newList.push({ type: "INFANT", data: {} });
    setPassengerInfoList(prev => newList.map((item, idx) => prev[idx] ? { ...item, data: prev[idx].data } : item));
  }, [passengerCounts]);

  // Đổi số hành khách thì nhả hết ghế đang giữ: số ghế cũ không còn khớp số người,
  // giữ lại sẽ tạo đơn lệch người/ghế. Chỉ xảy ra ở bước tìm/chọn chuyến, từ bước chọn
  // ghế trở đi bộ đếm đã bị khoá (passengerCountLocked).
  const changePassengerCount = (type, delta) => {
    if (selectedSeatIds.length > 0) {
      unlockSeats({
        tripId: selectedTrip?.id,
        seatIds: selectedSeatIds,
        userId: getSeatUserId(user),
      });
      setSelectedSeatIds([]);
      setLockDeadline(null);
    }
    setPassengerCounts(p => ({ ...p, [type]: p[type] + delta }));
  };

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
  // Lỗi thao tác hiển thị bằng toast trượt từ bên phải thay vì một dòng chữ đỏ chèn giữa
  // form: ở các bước dài, dòng đó thường nằm ngoài tầm nhìn nên người dùng bấm tiếp mà
  // không hề biết vừa có lỗi. Giữ nguyên tên setError để 35 chỗ gọi không phải sửa —
  // setError("") lúc dọn dẹp trở thành lệnh rỗng.
  const setError = useCallback((message) => {
    if (message) showToast(message, "error");
  }, [showToast]);
  const [formErrors, setFormErrors] = useState({});
  const [promoCode, setPromoCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [selectedSeatClass, setSelectedSeatClass] = useState("");
  const [showInsuranceInfo, setShowInsuranceInfo] = useState(false);
  const [showAllMeals, setShowAllMeals] = useState(false);

  // Tổng tiền gốc (ghế + dịch vụ) — phải khớp đúng cách backend cộng tiền trong BookingService
  const orderSubtotal = useMemo(() => {
    if (!selectedTrip) return 0;
    const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
    const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
    const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
    const basePrice = Number(selectedTrip.price || 0);
    const seatsTotal = ecoCount * basePrice + bizCount * basePrice * 2.5;
    const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);
    return seatsTotal + extraTotal;
  }, [seats, selectedSeatIds, selectedTrip, services, selectedServiceIds]);

  // Giảm giá theo hạng thành viên — backend trừ khoản này TRƯỚC khi áp voucher,
  // nên giao diện phải trừ theo đúng thứ tự đó thì tổng tiền mới khớp lúc thanh toán.
  const membershipDiscount = useMemo(() => {
    if (!membershipDiscountPercent) return 0;
    return Math.round(orderSubtotal * (membershipDiscountPercent / 100));
  }, [orderSubtotal, membershipDiscountPercent]);

  // Số tiền voucher được tính trên: đã trừ ưu đãi thành viên (giống backend)
  const voucherBaseAmount = Math.max(0, orderSubtotal - membershipDiscount);

  const API_BASE = "/api";
  const todayISO = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);
  const [date, setDate] = useState("");

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
    if (!searchFrom || !searchFrom.trim()) errs.from = t.errFromRequired;
    if (!searchTo || !searchTo.trim()) errs.to = t.errToRequired;
    if (!searchDate) errs.date = t.errDateRequired;
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
        type: "PLANE",
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
      setError(t.airSearchFailed);
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
      setError(t.errFromToForCalendar);
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
        type: "PLANE",
        passengers: String((passengerCounts.adult + passengerCounts.child + passengerCounts.infant) || 1),
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
      setError(t.errCalendarFailed);
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

      // Món ăn mặc định kèm ảnh địa phương trong /suat an/
      // Suất ăn lấy thẳng từ cơ sở dữ liệu (AdditionalServiceSeeder) để id gửi lên khi đặt vé
      // là id có thật; ảnh minh hoạ tra theo tên trong utils/mealImages.js.
      setServices(loadedServices.map(s => ({ ...s, img: s.img || getMealImage(s.serviceName) })));
    } catch (err) {
      console.error(err);
      setError(t.errServicesFailed);
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
      setError(t.errSeatsFailed);
    } finally {
      setLoading(false);
    }
  };

  const maxSeats = passengers || 1;  // em bé dưới 2 tuổi ngồi cùng người lớn, không tính chỗ riêng
  const isMaxReached = selectedSeatIds.length >= maxSeats;

  const toggleSeat = (seat) => {
    if (!canSelectSeats(isAuthenticated, user)) {
      setError(t.loginRequiredSeat);
      return;
    }

    const exists = selectedSeatIds.includes(seat.id);

    if (exists) {
      setError("");
      setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.id));
      return;
    }

    if (seat.booked || isSeatLockedByOthers(seat, user)) return;

    const maxSeats = passengers || 1;  // em bé dưới 2 tuổi ngồi cùng người lớn, không tính chỗ riêng

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
      if (!d.fullName || d.fullName.trim() === '') return t.errPassengerName.replace('{type}', isAdult ? t.adult.toLowerCase() : pi.type === 'CHILD' ? t.child.toLowerCase() : t.infant.toLowerCase()).replace('{index}', idx + 1);
      const dobError = validatePassengerDob(d.dateOfBirth, pi.type, selectedTrip?.departureTime ? new Date(selectedTrip.departureTime) : undefined);
      if (dobError === 'future') return t.errDobFuture.replace('{index}', idx + 1);
      if (dobError === 'ageMismatch') return t.errDobAgeMismatch.replace('{index}', idx + 1).replace('{type}', isAdult ? t.adult.toLowerCase() : pi.type === 'CHILD' ? t.child.toLowerCase() : t.infant.toLowerCase());
      if (dobError) return t.errDobInvalid.replace('{index}', idx + 1);
      if (!d.gender) return t.errGenderRequired.replace('{index}', idx + 1);

      if (isAdult) {
        if (!d.email || !/^\S+@\S+\.\S+$/.test(d.email)) return t.errEmailInvalid;
        if (!d.phone || !/^\d{9,10}$/.test(d.phone.replace(/\D/g, ''))) return t.errPhoneInvalid;
        if (!d.idNumber) return t.errIdNumberRequired;
      }
    }
    return null;
  };

  const goToExtras = async () => {
    if (!canSelectSeats(isAuthenticated, user)) {
      setError(t.loginRequiredSeat);
      return;
    }
    if (!selectedSeatIds.length) {
      setError(t.errSelectSeatFirst);
      return;
    }
    if (selectedSeatIds.length < maxSeats) {
      setError(t.errSeatCountMismatch.replaceAll('{total}', maxSeats).replace('{selected}', selectedSeatIds.length));
      return;
    }
    if (!isConnected) {
      setError(t.wsNotConnected);
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
      // TIMEOUT/DISCONNECTED là lỗi hạ tầng, không phải tranh chấp ghế: giữ nguyên ghế
      // đang chọn để người dùng bấm lại thay vì xoá đi kèm thông báo "ghế đã có người khác
      // chọn". Xem chú thích cùng chỗ trong BusTickets.jsx.
      if (error === "NOT_CONNECTED" || error === "DISCONNECTED") {
        setError(t.wsNotConnected);
      } else if (error === "TIMEOUT") {
        setError(t.seatHoldTimeout);
      } else if (failed?.length) {
        setSelectedSeatIds((prev) => prev.filter((id) => !failed.includes(id)));
        setError(t.seatConflict);
      } else {
        setError(t.errHoldSeatFailed);
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

  const handleApplyVoucher = async (codeOverride, opts = {}) => {
    const code = (codeOverride || promoCode || "").trim().toUpperCase();
    if (!code) return;
    // Bấm "Xác nhận" lại với đúng mã đang áp dụng → chỉ nhắc lại, không báo "giảm thành công" lần nữa
    if (!opts.silent && code === appliedVoucher) {
      showToast(t.promoAlreadyApplied.replace("{code}", code), "info");
      return;
    }
    try {
      const res = await axios.post(
        "/api/voucher/validate",
        { code, orderAmount: voucherBaseAmount, providerId: selectedTrip?.providerId },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (res.data.valid) {
        setPromoCode(code);
        setAppliedVoucher(code);
        setVoucherDiscount(Number(res.data.discountAmount) || 0);
        if (!opts.silent) showToast(res.data.message, "success");
      } else {
        setAppliedVoucher("");
        setVoucherDiscount(0);
        showToast(res.data.message, "error");
      }
    } catch {
      showToast(t.errPromoFailed, "error");
    }
  };

  // Đổi ghế/dịch vụ sau khi đã áp mã → số tiền giảm cũ không còn đúng, tính lại theo tổng mới
  useEffect(() => {
    if (!appliedVoucher) return;
    handleApplyVoucher(appliedVoucher, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherBaseAmount]);

  const submitBooking = async () => {
    if (!isAuthenticated || !token) {
      setError(t.errLoginToBook);
      return;
    }

    if (!selectedTrip) {
      setError(t.errSelectTrip);
      return;
    }

    if (!selectedSeatIds.length) {
      setError(t.errSelectSeat);
      return;
    }

    if (selectedSeatIds.length < maxSeats) {
      setError(t.errSeatCountMismatch.replaceAll('{total}', maxSeats).replace('{selected}', selectedSeatIds.length));
      return;
    }

    setError("");
    setSubmitLoading(true);

    const names = passengerInfoList.filter(p => p.type !== 'INFANT').map(p => p.data.fullName).filter(Boolean);

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
        const message = data?.message || t.errBookingFailed;
        setError(message);
        setSubmitLoading(false);
        return;
      }

      setBookingResult(data);
      // Ghế đã chuyển sang do đơn PENDING giữ -> đồng hồ giữ ghế hết nhiệm vụ,
      // không được để nó đá người dùng ra khỏi màn thanh toán.
      setLockDeadline(null);
      setPaymentDeadline(Date.now() + PENDING_HOLD_MS);
      if (globalContact.remember) {
        passengerInfoList.forEach(pi => {
          if (pi.type === 'ADULT' && pi.data.fullName) {
            addPassenger({ ...pi.data, passengerType: 'ADULT' }).catch(() => { });
          }
        });
      }
    } catch (err) {
      console.error(err);
      setError(t.errServerConnectFailed);
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
              {t.flight}
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
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaPlaneArrival /> {t.departurePoint || t.from || "Điểm đi"}</label>
                  <div
                    onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.from ? "2px solid #e53935" : "2px solid #e0e7ff",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{from}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {airports.find(a => a.code === from)?.name || t.selectAirport || "Chọn sân bay"}
                    </div>
                  </div>
                  {formErrors.from && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.from}</div>}
                  {showFromDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {airports.filter(a => a.code !== to).map(a => (
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
                  onClick={() => { const t = from; setFrom(to); setTo(t); }}
                  style={{
                    marginTop: 28, width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--border-main)",
                    background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "var(--primary)", flexShrink: 0, transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
                  title={t.swapDestinations || "Đổi điểm đi/đến"}
                >⇄</button>


                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaPlaneDeparture /> {t.destinationPoint || t.to || "Điểm đến"}</label>
                  <div
                    onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: formErrors.to ? "2px solid #e53935" : "2px solid var(--border-main)",
                      background: "var(--bg-input)", cursor: "pointer", userSelect: "none"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-main)" }}>{to}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {airports.find(a => a.code === to)?.name || t.selectAirport || "Chọn sân bay"}
                    </div>
                  </div>
                  {formErrors.to && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.to}</div>}
                  {showToDropdown && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12,
                      boxShadow: "var(--shadow-lg)", zIndex: 100, marginTop: 4, overflow: "hidden", border: "1px solid var(--border-main)"
                    }}>
                      {airports.filter(a => a.code !== from).map(a => (
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
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaRegCalendarAlt /> {t.departureDate || "Ngày đi"}</label>
                  <input type="date" value={date}
                    onChange={(e) => { setDate(e.target.value); setFormErrors(p => ({ ...p, date: undefined })); }}
                    min={todayISO}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, boxSizing: "border-box",
                      border: formErrors.date ? "2px solid #e53935" : "2px solid var(--border-main)", background: "var(--bg-input)", color: "var(--text-main)"
                    }}
                  />
                  {formErrors.date && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{formErrors.date}</div>}
                </div>


                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}><FaUser /> {t.passengers || "Hành khách"}</label>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <div
                      onClick={() => { if (!passengerCountLocked) setShowPassengersDropdown(!showPassengersDropdown); }}
                      title={passengerCountLocked ? t.passengerCountLockedHint : undefined}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border-main)",
                        background: "var(--bg-input)", color: "var(--text-main)", fontSize: 15, cursor: passengerCountLocked ? "not-allowed" : "pointer", opacity: passengerCountLocked ? 0.6 : 1, display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box"
                      }}
                    >
                      <span>{passengerCounts.adult} {t.adult || 'Người lớn'}, {passengerCounts.child} {t.child || 'Trẻ em'}, {passengerCounts.infant} {t.infant || 'Em bé'}</span>
                      <FiChevronDown />
                    </div>
                    {showPassengersDropdown && !passengerCountLocked && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 16, marginTop: 4, border: "1px solid var(--border-main)" }}>
                        {['adult', 'child', 'infant'].map(type => (
                          <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{type === 'adult' ? t.adult || 'Người lớn' : type === 'child' ? t.child || 'Trẻ em' : t.infant || 'Em bé'}</div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{type === 'adult' ? (t.ageAdultHint || '>12 tuổi') : type === 'child' ? (t.ageChildHint || '2-11 tuổi') : (t.ageInfantHint || '<2 tuổi')}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button type="button" disabled={passengerCounts[type] <= (type === 'adult' ? 1 : 0)} onClick={() => changePassengerCount(type, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                              <span style={{ fontWeight: 600, width: 16, textAlign: "center", color: "var(--text-main)" }}>{passengerCounts[type]}</span>
                              <button type="button" disabled={passengerCounts.adult + passengerCounts.child + passengerCounts.infant >= 5} onClick={() => changePassengerCount(type, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-input)", background: "var(--bg-card)", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {passengerCountLocked && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                        <FiLock style={{ display: "inline", verticalAlign: "middle", fontSize: 11 }} /> {t.passengerCountLockedHint}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: 10,
                      border: "none",
                      background: loading
                        ? "#555"
                        : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 14,
                      marginBottom: 8,
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    {loading ? (
                      <>
                        <CgSandClock /> {t.searching || "Đang tìm..."}
                      </>
                    ) : (
                      <>
                        <IoMdSearch style={{ fontSize: 17 }} /> {t.searchFlight || "Tìm chuyến bay"}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={loadCalendar}
                    disabled={calendarLoading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: "1px solid var(--border-main)",
                      background: "var(--bg-input)",
                      color: "var(--text-main)",
                      fontWeight: 600,
                      cursor: calendarLoading ? "not-allowed" : "pointer",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    {calendarLoading ? (
                      <>
                        <CgSandClock /> {t.loadingCalendar || "Đang tải..."}
                      </>
                    ) : (
                      <>
                        <FaRegCalendarAlt /> {t.viewCheapCalendar || "Xem lịch giá rẻ"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {calendarOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{t.calendar30Days || "Lịch giá 30 ngày tới"}</div>
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
                          border: "1px solid var(--border-main)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{d.date}</div>
                        <div style={{ marginTop: 6, color: "#f97316", fontWeight: 700 }}>
                          {d.minPrice != null ? `${Number(d.minPrice).toLocaleString("vi-VN")} đ` : "—"}
                        </div>
                      </button>
                    ))}
                  </div>

                  {!calendarLoading && calendarData.filter(d => d.available).length === 0 && (
                    <p style={{ marginTop: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {t.noCheapFlights || "Hiện chưa có chuyến bay phù hợp trong khoảng ngày này. Bạn có thể bỏ chọn \"tìm vé rẻ nhất\" và dùng tìm kiếm thường, hoặc đổi điểm đi/điểm đến/ngày khác."}
                    </p>
                  )}
                </div>
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
                        <FaPlaneDeparture style={{ color: "#4f7cff" }} /> {t.listFlightTitle || "Danh sách chuyến bay"}
                      </h2>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        {(t.showingTrips || "Hiển thị {filtered}/{total} chuyến phù hợp")
                          .replace("{filtered}", filteredTrips.length)
                          .replace("{total}", trips.length)}
                      </p>
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg,#4f7cff,#6a3de8)",
                      color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600
                    }}>
                      {airports.find(a => a.code === from)?.name || from} → {airports.find(a => a.code === to)?.name || to}
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
                          style={{ accentColor: "#4f7cff", width: 16, height: 16, cursor: "pointer" }}
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
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.airlineProvider || "Hãng bay:"}</span>
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
                                border: isChecked ? "1.5px solid #4f7cff" : "1px solid var(--border-light)",
                                background: isChecked ? "#eff6ff" : "var(--bg-input)",
                                color: isChecked ? "#4f7cff" : "var(--text-primary)",
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
                            {t.clearAirlineFilter || "Xóa lọc hãng"}
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
                        {t.noMatchingFlightTrips || "Không có chuyến bay nào phù hợp với bộ lọc hiện tại. Hãy thử mở rộng khung giờ hoặc bỏ lọc hãng."}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {filteredTrips.map((trip) => {
                      const isSelected = selectedTrip?.id === trip.id;
                      const isCheapest = trip.price === minPrice;
                      const seatPct = trip.availableSeats / (trip.totalSeats || 1);
                      const seatWarning = trip.availableSeats <= 5;

                      // Calculate flight duration & time parsing
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

                      return (
                        <div
                          key={trip.id}
                          onClick={() => handleSelectTrip(trip)}
                          style={{
                            background: isSelected
                              ? "var(--bg-accent)"
                              : "var(--bg-card)",
                            border: isSelected
                              ? "2px solid var(--primary)"
                              : "1.5px solid var(--border-main)",
                            borderRadius: 16,
                            padding: "18px 22px",
                            cursor: "pointer",
                            transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                            boxShadow: isSelected
                              ? "0 6px 24px rgba(56,139,253,0.25)"
                              : "var(--shadow-sm)",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {/* Cheapest badge ribbon */}
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
                            {/* Airline logo circle */}
                            {(() => {
                              const pInfo = PROVIDER_LOGOS[trip.providerName];
                              const logoColor = "#4f7cff";
                              const pColor = pInfo?.color || logoColor;
                              return (
                                <div style={{
                                  width: 52, height: 52, borderRadius: 14,
                                  background: pInfo?.bg || `linear-gradient(135deg,${pColor}22,${pColor}44)`,
                                  border: `1.5px solid ${pColor}44`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0, padding: 4, overflow: "hidden", position: "relative",
                                }}>
                                  {pInfo?.logo ? (
                                    <img
                                      src={pInfo.logo}
                                      alt={trip.providerName}
                                      style={{ width: "90%", height: "90%", objectFit: "contain" }}
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  ) : (
                                    <div style={{ textAlign: "center" }}>
                                      <span style={{ fontSize: 15, fontWeight: 800, color: pColor, lineHeight: 1, display: "block" }}>
                                        {pInfo?.code || (trip.providerName || "VN").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: 8, color: pColor + "bb", fontWeight: 600, marginTop: 2, display: "block" }}>
                                        {t.airlineBadge || "MÁY BAY"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Provider name */}
                            <div style={{ minWidth: 100, flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>
                                {trip.providerName}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {trip.vehicleType || t.commercialFlight || "Máy bay"}
                              </div>
                            </div>

                            {/* Separator */}
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Time + route block */}
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                              {/* Departure */}
                              <div style={{ textAlign: "center", minWidth: 70 }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
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
                                    fontSize: 11, color: "var(--primary)", fontWeight: 700,
                                    background: "var(--primary-light)", padding: "2px 10px", borderRadius: 20,
                                  }}>
                                    ⏱ {duration}
                                  </div>
                                )}
                                <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,var(--border-main),var(--primary))" }} />
                                  <span style={{ fontSize: 14, color: "var(--primary)" }}>✈</span>
                                  <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,var(--primary),var(--border-main))" }} />
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.directFlightRoute || "Bay thẳng"}</div>
                              </div>

                              {/* Arrival */}
                              <div style={{ textAlign: "center", minWidth: 70 }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                                  {formatTimeDisplay(trip.arrivalTime)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginTop: 3 }}>
                                  {trip.destination}
                                </div>
                              </div>
                            </div>

                            {/* Separator */}
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Seat availability */}
                            <div style={{ minWidth: 90, textAlign: "center", flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{t.availableSeats || "Chỗ trống"}</div>
                              <div style={{
                                fontSize: 13, fontWeight: 700,
                                color: seatWarning ? "#ef4444" : "#22c55e",
                              }}>
                                {trip.availableSeats}/{trip.totalSeats}
                              </div>
                              {/* Seat bar */}
                              <div style={{ marginTop: 5, height: 4, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden" }}>
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
                            <div style={{ width: 1, height: 44, background: "var(--border-main)", flexShrink: 0 }} />

                            {/* Price + CTA */}
                            <div style={{ textAlign: "center", minWidth: 130, flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.pricePerPerson || "Giá/người"}</div>
                              <div style={{
                                fontSize: 20, fontWeight: 900,
                                color: "#f97316",
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
                                    : "var(--primary)",
                                  color: "#fff", border: "none",
                                  padding: "8px 22px", borderRadius: 10,
                                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                                  width: "100%",
                                  boxShadow: isSelected
                                    ? "0 4px 12px rgba(34,197,94,0.35)"
                                    : "0 4px 12px rgba(56,139,253,0.35)",
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
              <div style={{ marginBottom: 20, background: "var(--bg-card)", borderRadius: 12, padding: "16px 24px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                <HoldCountdownBanner seconds={timeLeft} label={t.seatHoldTimeRemaining} icon={<FiClock style={{ fontSize: 16 }} />} />
                <HoldCountdownBanner seconds={paymentTimeLeft} label={t.paymentHoldTimeRemaining} icon={<FiClock style={{ fontSize: 16 }} />} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>

                  <div style={{ position: "absolute", top: 20, left: "12.5%", right: "12.5%", height: 3, background: "var(--border-main)", zIndex: 0 }} />
                  {[
                    { key: "seatClass", icon: <FaChair />, label: t.step1Title },
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
                          background: isDone ? "#22c55e" : isActive ? "var(--primary)" : "var(--bg-input)",
                          color: isDone || isActive ? "#fff" : "var(--text-muted)",
                          border: isActive ? "none" : "1px solid var(--border-main)",
                          fontWeight: 700, fontSize: 18, transition: "all .3s",
                        }}>{isDone ? "✓" : s.icon}</div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? "var(--primary)" : "var(--text-secondary)" }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {selectedTrip && step === "seatClass" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step1}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>{t.selectSeatInstruction}</p>
                  {!canSelectSeats(isAuthenticated, user) && (
                    <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 12, padding: "10px 12px", background: "rgba(245,158,11,0.1)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)" }}>
                      {t.loginRequiredSeat}
                    </p>
                  )}

                  {loading && <p style={{ color: "var(--text-muted)" }}>{t.loadingSeatMap}</p>}


                  {!loading && seats.length > 0 && (
                    <AirplaneSeatMap
                      seats={seats}
                      selectedSeatIds={selectedSeatIds}
                      onToggleSeat={toggleSeat}
                      isSeatLockedByOthers={isSeatLockedByOthers}
                      user={user}
                      isAuthenticated={isAuthenticated}
                      canSelectSeats={canSelectSeats}
                      isMaxReached={isMaxReached}
                      maxSeats={maxSeats}
                      selectedSeatClass={selectedSeatClass}
                      setSelectedSeatClass={setSelectedSeatClass}
                    />
                  )}

                  {!loading && seats.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t.noSeatData}</p>}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("chooseTrip")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtras} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.bookingSummary}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>✈</span> <span>{selectedTrip.origin}</span> <span style={{ color: "var(--primary)" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "var(--primary)", fontSize: 14, flexShrink: 0 }} />
                      <span>{(() => {
                        const d = new Date(selectedTrip.departureTime);
                        return !Number.isNaN(d.getTime())
                          ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
                          : selectedTrip.departureTime;
                      })()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                      <RiBuilding4Line style={{ color: "var(--primary)", fontSize: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--summary-eco-bg)", borderRadius: 8, border: "1px solid var(--summary-eco-border)" }}>
                      <div style={{ fontSize: 12, color: "var(--summary-eco-title)", fontWeight: 600, marginBottom: 4 }}>🟢 {t.economy} (ECO)</div>
                      <div style={{ fontWeight: 800, color: "var(--summary-eco-price)", fontSize: 15 }}>{Number(selectedTrip.price || 0).toLocaleString("vi-VN")} đ</div>
                    </div>
                    <div style={{ marginTop: 6, padding: "8px 10px", background: "var(--summary-vip-bg)", borderRadius: 8, border: "1px solid var(--summary-vip-border)" }}>
                      <div style={{ fontSize: 12, color: "var(--summary-vip-title)", fontWeight: 600, marginBottom: 4 }}>🔵 {t.business} (BUSINESS)</div>
                      <div style={{ fontWeight: 800, color: "var(--summary-vip-price)", fontSize: 15 }}>{Number((selectedTrip.price || 0) * 2.5).toLocaleString("vi-VN")} đ</div>
                    </div>
                    <div style={{ marginTop: 8, color: selectedSeatIds.length >= (passengers || 1) ? "#22c55e" : "var(--text-muted)" }}>{t.seatsSelectedCount.replace('{selected}', selectedSeatIds.length).replace('{total}', passengers || 1)}</div>
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
                    <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={globalContact.remember} onChange={e => setGlobalContact(p => ({ ...p, remember: e.target.checked }))} />
                      {t.rememberInfo}
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
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
                    }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToExtrasFromPassenger} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.nextStep} →</button>
                  </div>
                </div>


                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.bookingSummary}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span>✈</span> <span>{selectedTrip.origin}</span> <span style={{ color: "var(--primary)" }}>→</span> <span>{selectedTrip.destination}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>
                      <FaRegCalendarAlt style={{ color: "var(--primary)", fontSize: 14, flexShrink: 0 }} />
                      <span>{(() => {
                        const d = new Date(selectedTrip.departureTime);
                        return !Number.isNaN(d.getTime())
                          ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
                          : selectedTrip.departureTime;
                      })()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
                      <RiBuilding4Line style={{ color: "var(--primary)", fontSize: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{selectedTrip.providerName}</span>
                    </div>
                    {(() => {
                      const selectedSeatsObj = seats.filter(s => selectedSeatIds.includes(s.id));
                      const totalPrice = selectedSeatsObj.reduce((sum, s) => {
                        const isBiz = ["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType);
                        const seatPrice = isBiz ? (selectedTrip.price || 0) * 2.5 : (selectedTrip.price || 0);
                        return sum + seatPrice;
                      }, 0);

                      return (
                        <>
                          <div style={{ marginTop: 8, color: "var(--text-main)" }}>
                            {t.seatPrefix} <b>{selectedSeatsObj.length === 0 ? t.notSelected : selectedSeatsObj.map(s => `${s.seatNumber}${["BUSINESS", "VIP", "SLEEPER"].includes(s.seatType) ? ` (${t.business})` : ""}`).join(", ")}</b>
                          </div>
                          <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.ticketTotalLabel}</div>
                            <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17 }}>
                              {totalPrice > 0 ? `${totalPrice.toLocaleString("vi-VN")} đ` : `${Number(selectedTrip.price || 0).toLocaleString("vi-VN")} đ ${t.perSeatUnit}`}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}


            {selectedTrip && step === "extras" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-main)" }}>{t.step3}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{t.extrasInstruction}</p>

                  {servicesLoading && <p style={{ color: "var(--text-muted)" }}>{t.loadingServices}</p>}

                  {!servicesLoading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                      <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, background: "var(--bg-input)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <FaTicketAlt style={{ color: "var(--primary)", fontSize: 22 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>{t.checkedBaggage}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.baggageSub}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          <label style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 18px", borderRadius: 10,
                            border: `2px solid ${!selectedServiceIds.some(id => categories.baggage.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                            background: "var(--bg-card)",
                            cursor: "pointer", minWidth: 80, textAlign: "center"
                          }}>
                            <input type="radio" name="baggage" style={{ display: "none" }}
                              checked={!selectedServiceIds.some(id => categories.baggage.map(s => s.id).includes(id))}
                              onChange={() => setSingleServiceInCategory(null, categories.baggage)} />
                            <span style={{ fontSize: 16, color: "var(--text-muted)" }}>✕</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 2 }}>{t.doNotBuy}</span>
                          </label>
                          {categories.baggage.map(s => {
                            const kg = s.serviceName.replace(/[^\d]+/g, '') + 'kg';
                            const isSel = selectedServiceIds.includes(s.id);
                            return (
                              <label key={s.id} style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 18px", borderRadius: 10,
                                border: `2px solid ${isSel ? "var(--primary)" : "var(--border-main)"}`,
                                background: "var(--bg-card)", cursor: "pointer", minWidth: 80, textAlign: "center"
                              }}>
                                <input type="radio" name="baggage" style={{ display: "none" }} checked={isSel} onChange={() => setSingleServiceInCategory(s.id, categories.baggage)} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{kg}</span>
                                <span style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}>{Number(s.price || 0).toLocaleString("vi-VN")} đ</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>


                      <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: "20px", background: "var(--bg-input)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22, color: "#f59e0b" }}>🍱</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)" }}>{t.meal}</div>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.mealSub}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{
                            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 30,
                            border: `2px solid ${!selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                            background: "var(--bg-card)",
                            cursor: "pointer", fontWeight: 700, fontSize: 13,
                            color: !selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--text-secondary)"
                          }}>
                            <input type="radio" name="meal" style={{ display: "none" }}
                              checked={!selectedServiceIds.some(id => categories.meal.map(s => s.id).includes(id))}
                              onChange={() => setSingleServiceInCategory(null, categories.meal)} />
                            ✕ {t.noMealSelect}
                          </label>
                        </div>

                        {categories.meal.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-secondary)", fontSize: 13 }}>
                            {t.airlineNoMeals}<br />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.buyOnboard}</span>
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
                                  {showAllMeals ? `▲ ${t.showLessMeals}` : `▼ ${t.showMoreMeals.replace('{count}', categories.meal.length - 4)}`}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {[{ cat: categories.insurance, icon: <FaShieldAlt style={{ color: "#22c55e", fontSize: 22 }} />, title: t.travelInsurance, sub: t.insuranceSub, id: "insurance" },
                      { cat: categories.taxi, icon: <FaTaxi style={{ color: "#f59e0b", fontSize: 22 }} />, title: t.airportTaxi, sub: t.taxiSub, id: "taxi" }]
                        .map(({ cat, icon, title, sub, id }) => (
                          cat.length > 0 && (
                            <div key={id} style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, background: "var(--bg-input)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {icon}
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>{title}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
                                  </div>
                                </div>
                                {id === "insurance" && (
                                  <button
                                    type="button"
                                    onClick={() => setShowInsuranceInfo(v => !v)}
                                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                                  >
                                    {showInsuranceInfo ? t.hide : t.comparePlans}
                                  </button>
                                )}
                              </div>

                              {id === "insurance" && showInsuranceInfo && (
                                <div style={{ marginBottom: 14, padding: 14, background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-main)", fontSize: 13 }}>
                                  <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>📋 {t.compareInsurancePlans}</div>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: "var(--bg-input)" }}>
                                        <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--border-main)", color: "var(--text-main)" }}>{t.benefitCol}</th>
                                        <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid var(--border-main)", color: "#22c55e" }}>{t.planBasic}</th>
                                        <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid var(--border-main)", color: "#60a5fa" }}>{t.planPremium}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[
                                        [t.insFlightAccident, `250 ${t.millionVnd}`, `500 ${t.millionVnd}`],
                                        [t.insTripCancellation, "✕", t.insFullRefund],
                                        [t.insLostBaggage, `2 ${t.millionVnd}`, `5 ${t.millionVnd}`],
                                        [t.insMedicalCosts, `10 ${t.millionVnd}`, `50 ${t.millionVnd}`],
                                        [t.insFlightDelay, "✕", t.insDelayComp],
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
                                    <FiInfo style={{ display: "inline", verticalAlign: "middle", fontSize: 12, marginRight: 2 }} /> <b>{t.insuranceTipLabel}</b> {t.insuranceTip}
                                  </div>
                                </div>
                              )}

                              <label style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10,
                                border: `1.5px solid ${!selectedServiceIds.some(id => cat.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--border-main)"}`,
                                background: "var(--bg-card)",
                                cursor: "pointer", marginBottom: 8, fontWeight: 600, fontSize: 13,
                                color: !selectedServiceIds.some(id => cat.map(s => s.id).includes(id)) ? "var(--primary)" : "var(--text-secondary)"
                              }}>
                                <input type="radio" name={`cat_${id}`} style={{ display: "none" }}
                                  checked={!selectedServiceIds.some(id => cat.map(s => s.id).includes(id))}
                                  onChange={() => setSingleServiceInCategory(null, cat)} />
                                {t.doNotSelect}
                              </label>

                              {cat.map(s => {
                                const shortName = s.serviceName.replace(/^(Bảo hiểm du lịch|Taxi đưa đón sân bay)\s*/i, '');
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
                                        {sel && <div style={{ fontSize: 11, color: "var(--primary)" }}>✓ {t.selected}</div>}
                                      </div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: 14, color: "#f97316" }}>
                                      {Number(s.price || 0) === 0 ? t.free : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )
                        ))}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                    <button type="button" onClick={() => setStep("passenger")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                    <button type="button" onClick={goToReview} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.reviewAndPay} →</button>
                  </div>
                </div>

                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.paymentDetails}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                    {(() => {
                      const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                      const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
                      const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
                      const basePrice = Number(selectedTrip.price || 0);
                      const seatsTotal = ecoCount * basePrice + bizCount * basePrice * 2.5;
                      const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-main)", gap: 8 }}>
                            <span>{t.ticketPriceForSeats.replace('{count}', selectedSeatIds.length).replace('{seats}', t.seatUnit)}</span>
                            <b style={{ whiteSpace: "nowrap" }}>{seatsTotal.toLocaleString("vi-VN")} đ</b>
                          </div>
                          {ecoCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {ecoCount}x {t.economy}</span><b style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{(ecoCount * basePrice).toLocaleString("vi-VN")} đ</b></div>}
                          {bizCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {bizCount}x {t.business}</span><b style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{(bizCount * basePrice * 2.5).toLocaleString("vi-VN")} đ</b></div>}

                          {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--text-main)", gap: 10, marginTop: 4 }}>
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {s.serviceName}</span>
                              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0) === 0 ? t.free : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}</b>
                            </div>
                          ))}

                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{t.totalLabel}</span>
                            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>{(seatsTotal + extraTotal).toLocaleString("vi-VN")} đ</span>
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
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>✈ {t.flightLabel}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-main)" }}>{selectedTrip.origin} → {selectedTrip.destination}</div>
                        <div style={{ color: "var(--text-main)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>{selectedTrip.departureTime} · {selectedTrip.providerName}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#f97316", fontSize: 17, whiteSpace: "nowrap" }}>
                        {(() => {
                          const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                          const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
                          const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
                          const basePrice = Number(selectedTrip.price || 0);
                          return (ecoCount * basePrice + bizCount * basePrice * 2.5).toLocaleString("vi-VN");
                        })()} đ
                      </div>
                    </div>
                  </div>


                  <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}><FaUser /> {t.passengerNameText}</div>
                    {passengerInfoList.map((pi, idx) => (
                      <div key={idx} style={{ fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: idx < passengerInfoList.length - 1 ? "1px dashed var(--border-main)" : "none", color: "var(--text-main)", lineHeight: 1.6 }}>
                        <b style={{ fontSize: 15 }}>{pi.data.fullName || `${t.passengerNameText} ${idx + 1}`}</b> <span style={{ color: "var(--text-secondary)" }}>({pi.type === 'ADULT' ? t.adult : pi.type === 'CHILD' ? t.child : t.infant})</span>
                        {pi.type === 'ADULT' && <div style={{ color: "var(--text-main)", marginTop: 2 }}>{pi.data.email} · {pi.data.phone ? `${pi.data.phone}` : ''}</div>}
                        <div style={{ marginTop: 2, color: "var(--text-main)" }}>{t.dobPrefix} <b>{pi.data.dateOfBirth}</b> | {t.genderPrefix} <b>{pi.data.gender === 'Male' ? t.genderMale : pi.data.gender === 'Female' ? t.genderFemale : t.genderOther}</b></div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, color: "var(--text-main)", fontSize: 14 }}>{t.seatPrefix} <b style={{ fontSize: 15, color: "#f97316" }}>{seats.filter(s => selectedSeatIds.includes(s.id)).map(s => s.seatNumber).join(", ") || t.notSelected}</b></div>
                  </div>


                  {selectedServiceIds.length > 0 && (
                    <div style={{ border: "1px solid var(--border-main)", borderRadius: 12, padding: 16, marginBottom: 14, background: "var(--bg-input)" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--primary)" }}>🛎 {t.extrasLabel}</div>
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
                      <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder={t.promoPlaceholder}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--text-main)", fontSize: 14 }} />
                      <button type="button" onClick={() => handleApplyVoucher()} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t.applyPromo}</button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.promoInstruction}</div>
                      <SavedVoucherPicker providerId={selectedTrip?.providerId} orderAmount={voucherBaseAmount} onApply={handleApplyVoucher} />
                    </div>
                  </div>


                  {bookingResult ? (
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(34, 197, 94, 0.1)", border: "1px solid #22c55e", marginTop: 8 }}>
                      <div style={{ fontWeight: 800, color: "#22c55e", fontSize: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MdOutlineDone /> {t.successBooking}</div>
                      <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.9 }}>
                        <div>{t.bookingIdPrefix} <b style={{ color: "var(--primary)" }}>#{bookingResult.id}</b></div>
                        <div>{t.totalAmountPrefix} <b style={{ color: "#f97316" }}>{Number(bookingResult.totalPrice || 0).toLocaleString("vi-VN")} đ</b></div>
                        <div>{t.seatPrefix} {Array.isArray(bookingResult.seatNumbers) ? bookingResult.seatNumbers.join(", ") : ""}</div>
                      </div>
                      <button type="button"
                        onClick={async () => {
                          try {
                            const res = await axios.post("/api/payment/create", { bookingId: bookingResult.id, language: "vn", returnOrigin: window.location.origin }, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data && res.data.paymentUrl) window.location.href = res.data.paymentUrl;
                          } catch { showToast(t.errVnpayLinkFailed, "error"); }
                        }}
                        style={{ marginTop: 14, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#005baa", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <CiCreditCard1 fontSize={20} /> {t.paymentVNPAY}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                      <button type="button" onClick={() => setStep("extras")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" }}>← {t.goBack}</button>
                      <button type="button" onClick={submitBooking} disabled={submitLoading}
                        style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {submitLoading ? t.processing : `${t.bookTicketNow} →`}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-main)", height: "fit-content", position: "sticky", top: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, borderBottom: "1px solid var(--border-main)", paddingBottom: 10, color: "var(--text-main)" }}>{t.paymentDetails}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)" }}>
                    {(() => {
                      const selSeats = seats.filter(s => selectedSeatIds.includes(s.id));
                      const ecoCount = selSeats.filter(s => s.seatType !== "BUSINESS").length;
                      const bizCount = selSeats.filter(s => s.seatType === "BUSINESS").length;
                      const basePrice = Number(selectedTrip.price || 0);
                      const seatsTotal = ecoCount * basePrice + bizCount * basePrice * 2.5;
                      const extraTotal = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-main)", gap: 8 }}>
                            <span>{t.ticketPriceForSeats.replace('{count}', selectedSeatIds.length).replace('{seats}', t.seatUnit)}</span>
                            <b style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{seatsTotal.toLocaleString("vi-VN")} đ</b>
                          </div>
                          {ecoCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {ecoCount}x {t.economy}</span><b style={{ whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>{(ecoCount * basePrice).toLocaleString("vi-VN")} đ</b></div>}
                          {bizCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-main)", paddingLeft: 8, gap: 8 }}><span>↳ {bizCount}x {t.business}</span><b style={{ whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>{(bizCount * basePrice * 2.5).toLocaleString("vi-VN")} đ</b></div>}

                          {services.filter(s => selectedServiceIds.includes(s.id)).map(s => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--text-main)", gap: 10, marginTop: 4 }}>
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>+ {s.serviceName}</span>
                              <b style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#f97316" }}>{Number(s.price || 0) === 0 ? t.free : `${Number(s.price || 0).toLocaleString("vi-VN")} đ`}</b>
                            </div>
                          ))}
                          {membershipDiscount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 6, fontWeight: 600, gap: 8 }}>
                              <span>🏅 {t.memberDiscountLabel.replace('{rate}', membershipDiscountPercent)}</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{membershipDiscount.toLocaleString("vi-VN")} đ</span>
                            </div>
                          )}
                          {appliedVoucher && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginTop: 4, gap: 8 }}>
                              <span>🎟 {t.codePrefix} {appliedVoucher}</span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>-{voucherDiscount.toLocaleString("vi-VN")} đ</span>
                            </div>
                          )}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{t.totalLabel}</span>
                            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316", whiteSpace: "nowrap" }}>{Number(bookingResult ? bookingResult.totalPrice || 0 : Math.max(0, seatsTotal + extraTotal - membershipDiscount - voucherDiscount)).toLocaleString("vi-VN")} đ</span>
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

export default AirlineTickets;