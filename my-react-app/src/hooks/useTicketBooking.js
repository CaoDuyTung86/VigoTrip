// @ts-check
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useSavedPassengers } from "../context/SavedPassengersContext";

import useCountdown from "./useCountdown";
import useSeatLockRekey from "./useSeatLockRekey";
import useBookingDraft from "./useBookingDraft";

import { RESTORABLE_STEPS, readDraft, verifyHeldSeats } from "../utils/bookingDraft";
import { canSelectSeats, isSeatLockedByOthers } from "../utils/seatBookingHelpers";
import { validatePassengerDob } from "../utils/passengerValidation";
import { getMealImage } from "../utils/mealImages";
import { formatMoney } from "../utils/money";
import { groupServices } from "../utils/serviceCatalog";
import { seatsSubtotal } from "../utils/seatPricing";
import { placesFor } from "../utils/placeCatalog";

/**
 * Quá hạn này mà WebSocket vẫn chưa cấp mã chủ sở hữu thì bỏ việc khôi phục.
 *
 * Không có mã thì không đối chiếu được ghế, mà chờ mãi thì nút tìm chuyến kẹt vĩnh viễn
 * ở trạng thái đang tải — hỏng nặng hơn hẳn so với việc mất bản nháp. Đặt dài hơn hạn chờ
 * danh tính bên trong WebSocketContext (8 giây) để lần thử của nó kết thúc trước.
 */
const DRAFT_RESTORE_TIMEOUT_MS = 12000;

/**
 * Thời gian giữ chỗ của một đơn PENDING chưa bấm thanh toán.
 * PHẢI khớp BookingCleanupService.PENDING_HOLD_MINUTES ở backend.
 */
const PENDING_HOLD_MS = 5 * 60 * 1000;

/**
 * Toàn bộ luồng đặt vé — tìm chuyến, chọn chỗ, giữ chỗ, điền hành khách, tạo đơn.
 *
 * Ba trang `BusTickets`, `TrainTickets` và `AirlineTickets` trước đây mỗi trang giữ một bản
 * sao của đúng luồng này: khoảng một nghìn dòng gần như trùng khít, và so từng dòng thì
 * `BusTickets` với `TrainTickets` giống nhau 90%. Khác biệt THẬT chỉ có bảy điểm, tất cả đều
 * là dữ liệu chứ không phải hành vi: khoá bản nháp, mã loại chuyến gửi lên API, câu báo lỗi
 * khi tìm không ra, cách tính phụ thu theo hạng chỗ, bảng hạng chỗ cao cấp, bảng nhãn hiệu
 * nhà cung cấp, và danh sách điểm đi/đến. Bảy điểm ấy nay là tham số của hook này.
 *
 * Vì sao đáng gộp, chứ không chỉ là cho gọn: ba bản sao đã bắt đầu trôi khỏi nhau một cách
 * âm thầm. `BusTickets` viết `setSeats(data || [])` còn hai trang kia viết `setSeats(data)`,
 * nên cùng một phản hồi rỗng từ máy chủ thì xe khách hiện sơ đồ trống còn tàu và máy bay
 * ném lỗi trắng trang. Sửa một lỗi ở luồng đặt vé trước đây có nghĩa là nhớ sửa ở ba nơi,
 * và lịch sử repo cho thấy việc nhớ đó không phải lúc nào cũng xảy ra.
 *
 * KHÔNG ôm phần giao diện. Giao diện dùng chung nằm ở các component bước đặt vé
 * (`TripSearchPanel`, `TripResultsList`, `SeatSelectionStep`, `PassengerStep`, `ExtrasStep`,
 * `ReviewStep`); chúng nhận nguyên giá trị trả về của hook này qua prop `booking`, kiểu
 * `Booking` bên dưới. Phần JSX của ba trang từng trùng nhau 72–90% tính theo từng cặp, và
 * chỗ khác nhau chỉ là màu, biểu tượng, chữ — nên đó là tham số, không phải nhánh
 * `if (mode === "air")`. Sơ đồ chỗ thì khác nhau thật, nên vẫn là ba component riêng.
 *
 * @param {object} config
 * @param {"bus"|"train"|"air"} config.mode khoá bản nháp và khoá tra bảng dữ liệu theo phương tiện
 * @param {string} config.tripType mã loại chuyến gửi lên `/api/trips/search` ("BUS"|"TRAIN"|"PLANE")
 * @param {string} config.searchFailedKey khoá trong bảng dịch cho câu báo khi tìm chuyến hỏng
 * @param {boolean} [config.calendarCountsInfants] xem ghi chú ở chỗ dựng tham số của lịch giá
 */
export default function useTicketBooking({
  mode,
  tripType,
  searchFailedKey,
  calendarCountsInfants = false,
}) {
  const { t, currentLanguage } = useLanguage();
  // Mọi số tiền trên trang này đi qua đây. Trước đây từng chỗ tự viết
  // `toLocaleString("vi-VN") + " đ"`, nên bản English hiện "677.450 đ" — dấu chấm ở
  // đúng vị trí mà người đọc tiếng Anh hiểu là dấu thập phân.
  const money = useCallback(
    (amount) => formatMoney(amount, currentLanguage?.code),
    [currentLanguage]
  );
  const { token, isAuthenticated, user, membershipDiscountPercent } = useAuth();
  const { showToast } = useToast();
  const { isConnected, ownerToken, subscribeToTrip, lockSeats, unlockSeats, handoverSeats } =
    useWebSocket();
  const location = useLocation();

  const stations = useMemo(
    () => placesFor(mode, currentLanguage?.code || "vi"),
    [mode, currentLanguage]
  );

  const [from, setFrom] = useState("HAN");
  const [to, setTo] = useState("SGN");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [date, setDate] = useState("");
  const [passengerCounts, setPassengerCounts] = useState({ adult: 1, child: 0, infant: 0 });
  const [showPassengersDropdown, setShowPassengersDropdown] = useState(false);
  // Em bé dưới 2 tuổi ngồi cùng người lớn nên không chiếm chỗ riêng.
  const passengers = passengerCounts.adult + passengerCounts.child;
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [step, setStep] = useState("search");
  // Vào luồng đặt vé rồi thì số hành khách phải cố định: ghế đang giữ, tiền tạm tính và
  // danh sách form thông tin hành khách đều sinh ra từ con số này. Cho sửa giữa chừng sẽ
  // đẻ thêm/bớt ô điền thông tin trong khi số ghế giữ không đổi, dẫn tới lệch người/ghế.
  const passengerCountLocked =
    Boolean(selectedTrip) && ["seatClass", "passenger", "extras", "review"].includes(step);
  const [lockDeadline, setLockDeadline] = useState(null);
  const [paymentDeadline, setPaymentDeadline] = useState(null);

  /**
   * Bản nháp của lượt đặt vé còn dở từ trước khi tải lại trang, hoặc null.
   *
   * Đọc ĐỒNG BỘ ngay lúc dựng hook chứ không trong effect: effect đọc tham số URL bên dưới
   * cần biết ngay ở nhịp render đầu tiên là có bản nháp hay không, để nhường đường thay vì
   * tự chạy tìm chuyến. Xem readDraft trong utils/bookingDraft.
   */
  const [pendingDraft] = useState(() => readDraft(mode));

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarData, setCalendarData] = useState([]);

  // Sort & Filter
  const [sortBy, setSortBy] = useState("price_asc");
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [filterProviders, setFilterProviders] = useState([]);
  const [timeRange, setTimeRange] = useState([0, 24]);
  const [maxPriceFilter, setMaxPriceFilter] = useState(null);

  const allProviders = useMemo(
    () => Array.from(new Set(trips.map((tr) => tr.providerName).filter(Boolean))),
    [trips]
  );

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    const now = new Date();

    return trips
      .filter((trip) => {
        if (filterAvailableOnly && (trip.availableSeats || 0) <= 0) return false;
        if (filterProviders.length > 0 && !filterProviders.includes(trip.providerName)) return false;
        if (maxPriceFilter && trip.price > maxPriceFilter) return false;

        // Bỏ những chuyến sắp chạy trong 30 phút tới hoặc đã chạy rồi.
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
          const timeStr = trip.departureTime.includes("T")
            ? trip.departureTime.split("T")[1]
            : trip.departureTime;
          depHour = parseInt(timeStr.split(":")[0], 10);
        }
        if (isNaN(depHour)) depHour = 0;
        if (depHour < timeRange[0] || depHour > timeRange[1]) return false;

        return true;
      })
      .sort((a, b) => {
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

        const getDuration = (trip) => {
          const parseT = (s) =>
            !s ? null : s.includes("T") ? new Date(s) : new Date(`2000-01-01T${s}`);
          const dep = parseT(trip.departureTime);
          const arr = parseT(trip.arrivalTime);
          if (!dep || !arr) return 0;
          let diff = (arr.getTime() - dep.getTime()) / 60000;
          if (diff < 0) diff += 1440;
          return diff;
        };
        if (sortBy === "duration_asc") return getDuration(a) - getDuration(b);

        return 0;
      });
  }, [trips, sortBy, filterAvailableOnly, filterProviders, timeRange, maxPriceFilter, date]);

  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [passengerInfoList, setPassengerInfoList] = useState([]);
  const [globalContact, setGlobalContact] = useState({ promoOptIn: true, remember: false });
  const { savedPassengers, addPassenger } = useSavedPassengers();

  // Người liên hệ của cả đơn: nơi nhận vé và mọi thông báo chuyến đi.
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "" });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  // Bật sẵn khi có bản nháp: từ lúc mở trang tới lúc khôi phục xong mất chừng một giây
  // (chờ WebSocket cấp mã chủ sở hữu rồi mới đối chiếu ghế được). Để nút tìm chuyến bấm
  // được trong quãng đó thì một lần bấm sẽ xoá chuyến và ghế mà việc khôi phục đang dựng
  // lại dở dang.
  const [loading, setLoading] = useState(Boolean(pendingDraft));
  // Lỗi thao tác hiển thị bằng toast trượt từ bên phải thay vì một dòng chữ đỏ chèn giữa
  // form: ở các bước dài, dòng đó thường nằm ngoài tầm nhìn nên người dùng bấm tiếp mà
  // không hề biết vừa có lỗi. Giữ nguyên tên setError để mọi chỗ gọi không phải sửa —
  // setError("") lúc dọn dẹp trở thành lệnh rỗng.
  const setError = useCallback(
    (message) => {
      if (message) showToast(message, "error");
    },
    [showToast]
  );
  const [formErrors, setFormErrors] = useState(/** @type {{from?: string, to?: string, date?: string}} */ ({}));
  const [promoCode, setPromoCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [selectedSeatClass, setSelectedSeatClass] = useState("");
  const [showInsuranceInfo, setShowInsuranceInfo] = useState(false);
  const [showAllMeals, setShowAllMeals] = useState(false);

  // Điền sẵn từ hồ sơ tài khoản, nhưng CHỈ vào những ô còn trống.
  //
  // user được useAuth trộn thêm dữ liệu từ /api/users/me, nên nó đổi tham chiếu một lúc
  // sau khi trang đã mở. Ghi đè vô điều kiện ở đây thì thứ khách vừa gõ vào ô liên hệ sẽ
  // bị nuốt mất ngay giữa chừng, không hiểu vì sao.
  useEffect(() => {
    if (!user) return;
    setContactInfo((prev) => ({
      name: prev.name || user.fullName || "",
      email: prev.email || user.email || "",
      phone: prev.phone || String(user.phone || "").replace(/\D/g, "").slice(0, 10),
    }));
  }, [user]);

  useEffect(() => {
    if (selectedTrip && isConnected) {
      const subscription = subscribeToTrip(selectedTrip.id, (update) => {
        if (update.tripId === selectedTrip.id) {
          const isLockedByOther =
            (update.status === "SELECTED" || update.status === "BOOKED") &&
            update.ownerToken !== ownerToken;

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
                    tempLockedBy: update.status === "SELECTED" ? update.ownerToken : null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrip, isConnected, subscribeToTrip, ownerToken]);

  // Giữ ghế bằng lock tạm ở backend (SeatLockService, 10 phút). Hết giờ thì nhả ghế.
  const timeLeft = useCountdown(lockDeadline, () => {
    unlockSeats({
      tripId: selectedTrip?.id,
      seatIds: selectedSeatIds,
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
    ownerToken,
    tripId: selectedTrip?.id,
    seatIds: selectedSeatIds,
    active: !!lockDeadline,
    handoverSeats,
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
    setPassengerInfoList((prev) =>
      newList.map((item, idx) => (prev[idx] ? { ...item, data: prev[idx].data } : item))
    );
  }, [passengerCounts]);

  // Đổi số hành khách thì nhả hết ghế đang giữ: số ghế cũ không còn khớp số người,
  // giữ lại sẽ tạo đơn lệch người/ghế. Chỉ xảy ra ở bước tìm/chọn chuyến, từ bước chọn
  // ghế trở đi bộ đếm đã bị khoá (passengerCountLocked).
  const changePassengerCount = (type, delta) => {
    if (selectedSeatIds.length > 0) {
      unlockSeats({
        tripId: selectedTrip?.id,
        seatIds: selectedSeatIds,
      });
      setSelectedSeatIds([]);
      setLockDeadline(null);
    }
    setPassengerCounts((p) => ({ ...p, [type]: p[type] + delta }));
  };

  const handlePassengerChange = (index, type, data) => {
    setPassengerInfoList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], data };
      return copy;
    });
  };

  // Tổng tiền gốc (ghế + dịch vụ) — phải khớp đúng cách backend cộng tiền trong BookingService.
  const orderSubtotal = useMemo(() => {
    if (!selectedTrip) return 0;
    const selSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
    const extraTotal = services
      .filter((s) => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + (s.price || 0), 0);
    return seatsSubtotal(tripType, selectedTrip.price, selSeats) + extraTotal;
  }, [seats, selectedSeatIds, selectedTrip, services, selectedServiceIds, tripType]);

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
        : String(
            passengerCounts.adult + passengerCounts.child + passengerCounts.infant || 1
          );

      const params = new URLSearchParams({
        from: searchFrom,
        to: searchTo,
        date: searchDate,
        type: tripType,
        passengers: passengersCount,
      });

      const res = await fetch(`${API_BASE}/trips/search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json();
      setTrips(data || []);
      setStep("chooseTrip");
    } catch (err) {
      console.error(err);
      setError(t[searchFailedKey]);
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

      // Trang máy bay đếm CẢ em bé ở đây trong khi trang xe/tàu thì không, và hai cách
      // đếm ấy có từ trước lần gộp này. Giữ nguyên khác biệt thay vì lặng lẽ thống nhất:
      // con số này quyết định ngày nào bị chấm là hết chỗ, nên đổi nó là đổi thứ khách
      // nhìn thấy trên lịch giá. Xem ghi chú trong docs/ về việc chốt lại một cách đếm.
      const calendarPassengers = calendarCountsInfants
        ? passengerCounts.adult + passengerCounts.child + passengerCounts.infant
        : passengers;

      const params = new URLSearchParams({
        from,
        to,
        start,
        end,
        type: tripType,
        passengers: String(calendarPassengers || 1),
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

      // Suất ăn lấy thẳng từ cơ sở dữ liệu (AdditionalServiceSeeder) để id gửi lên khi đặt vé
      // là id có thật; ảnh minh hoạ tra theo tên trong utils/mealImages.js.
      setServices(loadedServices.map((s) => ({ ...s, img: s.img || getMealImage(s) })));
    } catch (err) {
      console.error(err);
      setError(t.errServicesFailed);
    } finally {
      setServicesLoading(false);
    }
  };

  // Đọc tham số URL một lần lúc mở trang.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qFrom = params.get("from");
    const qTo = params.get("to");
    const qDate = params.get("date");
    const qPassengers = params.get("passengers");
    const urlMode = params.get("mode");

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

    if (qMaxPrice && !Number.isNaN(Number(qMaxPrice))) setMaxPriceFilter(Number(qMaxPrice));
    if (qProvider) setFilterProviders([qProvider]);
    if (qTimeSlot) {
      if (qTimeSlot === "MORNING") setTimeRange([5, 12]);
      else if (qTimeSlot === "AFTERNOON") setTimeRange([12, 18]);
      else if (qTimeSlot === "EVENING") setTimeRange([18, 24]);
      else if (qTimeSlot === "EARLY_MORNING") setTimeRange([0, 5]);
    }

    // Có bản nháp thì không tự tìm chuyến nữa. performSearch xoá chuyến và ghế đang chọn,
    // chạy song song với việc khôi phục sẽ thành cuộc đua mà bên nào về sau thì bên đó
    // thắng — tức là thỉnh thoảng người dùng mất tiến trình, không đoán trước được.
    if (pendingDraft) return;

    if (qFrom && qTo && qPassengers && urlMode === "calendar") {
      setTimeout(() => {
        loadCalendar();
      }, 0);
    } else if (qFrom && qTo && qDate) {
      setTimeout(() => {
        performSearch(qFrom, qTo, qDate, qPassengers ? Number(qPassengers) : 1);
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Bản nháp được lưu lại sau mỗi thay đổi, để tải lại trang không mất tiến trình.
   *
   * Cố ý KHÔNG lưu `bookingResult` và `paymentDeadline`: sau khi tạo đơn thì ghế đã do đơn
   * PENDING giữ chứ không còn là lock tạm, và trang "Vé của tôi" đã có sẵn nút thanh toán
   * lại cho đơn đó — đường ấy dựa vào CSDL nên dùng được cả từ máy khác, tốt hơn hẳn một
   * màn thanh toán dựng lại từ bản nháp và có thể đã hết hiệu lực.
   */
  const bookingDraft = useMemo(
    () => ({
      step,
      tripId: selectedTrip?.id ?? null,
      selectedTrip,
      selectedSeatIds,
      lockDeadline,
      from,
      to,
      date,
      passengerCounts,
      contactInfo,
      passengerInfoList,
      globalContact,
      selectedServiceIds,
      selectedSeatClass,
      promoCode,
    }),
    [
      step,
      selectedTrip,
      selectedSeatIds,
      lockDeadline,
      from,
      to,
      date,
      passengerCounts,
      contactInfo,
      passengerInfoList,
      globalContact,
      selectedServiceIds,
      selectedSeatClass,
      promoCode,
    ]
  );

  const forgetDraft = useBookingDraft({
    mode,
    enabled: Boolean(selectedTrip) && RESTORABLE_STEPS.includes(step) && !bookingResult,
    draft: bookingDraft,
  });

  /**
   * Dựng lại lượt đặt vé còn dở sau khi tải lại trang.
   *
   * Chờ có ownerToken rồi mới chạy. Đó là mã ẩn danh của chính phiên này; không có nó thì
   * không phân biệt được ghế nào còn là của mình, và verifyHeldSeats sẽ coi như mất sạch rồi
   * đá người dùng về bước chọn ghế chỉ vì WebSocket nối chậm hơn REST một nhịp.
   *
   * Không tin bản nháp: sơ đồ ghế lấy lại từ máy chủ rồi mới đối chiếu. Bản nháp chỉ là lời
   * khai của trình duyệt, còn SeatLockService giữ bảng lock trong RAM — backend restart
   * (Render gói miễn phí ngủ khi vắng request) là mất sạch lock trong khi bản nháp vẫn nằm
   * nguyên đó. Tin nó thì người dùng điền xong hết mọi thứ mới vỡ ở bước tạo đơn, tức hỏng
   * vào đúng lúc tệ nhất.
   */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!pendingDraft || restoredRef.current) return;

    if (!ownerToken) {
      const giveUp = setTimeout(() => {
        restoredRef.current = true;
        forgetDraft();
        setLoading(false);
        setError(t.draftRestoreFailed);
      }, DRAFT_RESTORE_TIMEOUT_MS);
      return () => clearTimeout(giveUp);
    }

    restoredRef.current = true;

    (async () => {
      try {
        // Trả lại ngay phần không phụ thuộc vào ghế. Đây mới là thứ đắt giá nhất với người
        // dùng: bấm lại vài cái ghế thì nhanh, gõ lại cả form hành khách mới là thứ khiến
        // người ta bỏ cuộc giữa chừng.
        setFrom(pendingDraft.from);
        setTo(pendingDraft.to);
        setDate(pendingDraft.date);
        setPassengerCounts(pendingDraft.passengerCounts);
        setSelectedTrip(pendingDraft.selectedTrip);
        setContactInfo(pendingDraft.contactInfo);
        setPassengerInfoList(pendingDraft.passengerInfoList);
        setGlobalContact(pendingDraft.globalContact);
        setSelectedServiceIds(pendingDraft.selectedServiceIds);
        setSelectedSeatClass(pendingDraft.selectedSeatClass);
        // Chỉ trả lại chữ trong ô mã giảm giá, KHÔNG trả lại khoản đã giảm: voucher phải
        // được máy chủ duyệt lại theo đúng số tiền của đơn (nó có thể đã hết lượt, hết hạn,
        // hoặc không còn đủ điều kiện). Hiện sẵn một khoản giảm chưa ai duyệt lại là hứa với
        // khách một con số mà bước tạo đơn có thể không thực hiện được.
        setPromoCode(pendingDraft.promoCode || "");

        const res = await fetch(`${API_BASE}/trips/${pendingDraft.tripId}/seats`);
        if (!res.ok) throw new Error(`Lỗi HTTP ${res.status}`);
        const freshSeats = (await res.json()) || [];
        setSeats(freshSeats);

        const { ok, keptSeatIds } = verifyHeldSeats({
          seats: freshSeats,
          selectedSeatIds: pendingDraft.selectedSeatIds,
          ownerToken,
          lockDeadline: pendingDraft.lockDeadline,
        });
        setSelectedSeatIds(keptSeatIds);

        if (!ok) {
          // Ghế không còn nguyên vẹn thì dừng lại ở bước chọn ghế. Cho đi tiếp là đẩy người
          // dùng tới bước tạo đơn để hỏng ở đó, sau khi họ đã điền xong tất cả.
          setLockDeadline(null);
          setStep("seatClass");
          setError(t.draftSeatsLost);
          return;
        }

        setLockDeadline(pendingDraft.lockDeadline);
        // Từ bước "extras" trở đi tổng tiền có cộng dịch vụ đi kèm. Không nạp lại danh sách
        // dịch vụ thì màn hình hiện ra thiếu hẳn khoản đó — số tiền sai, và sai theo hướng
        // thấp hơn số thực thu, tức là hứa rẻ rồi thu đắt.
        if (pendingDraft.step === "extras" || pendingDraft.step === "review") {
          await loadServices();
        }
        setStep(pendingDraft.step);
        showToast(t.draftRestored, "info");
      } catch (err) {
        console.error(err);
        // Không dựng lại được thì trả về màn hình tìm chuyến sạch sẽ, đừng để lại một bước
        // chọn ghế không có ghế nào để chọn.
        forgetDraft();
        setSelectedTrip(null);
        setSelectedSeatIds([]);
        setStep("search");
        setError(t.draftRestoreFailed);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerToken, pendingDraft]);

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
      // Loại chỗ giữ đúng như máy chủ trả về. Bản cũ tự gán "4 hàng đầu là giường nằm" cho
      // những chỗ CSDL ghi ECONOMY: sơ đồ hiện ra giường nhưng BookingService lại tính phụ
      // thu theo seat_type thật, nên giá hiển thị lệch hẳn với số tiền thu lúc thanh toán.
      setSeats(data || []);

      setStep("seatClass");
    } catch (err) {
      console.error(err);
      setError(t.errSeatsFailed);
    } finally {
      setLoading(false);
    }
  };

  const maxSeats = passengers || 1;
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

    if (seat.booked || isSeatLockedByOthers(seat, ownerToken)) return;

    if (selectedSeatIds.length >= maxSeats) {
      return;
    }

    setError("");
    setSelectedSeatIds((prev) => [...prev, seat.id]);
  };

  // Xếp nhóm theo `category` backend trả về, không theo tiền tố chữ tiếng Việt trong tên nữa.
  // Xem utils/serviceCatalog.js để biết ba lỗi mà cách cũ gây ra trên bản deploy.
  const categories = useMemo(() => groupServices(services), [services]);

  const setSingleServiceInCategory = (serviceId, categoryServices) => {
    const categoryIds = categoryServices.map((s) => s.id);
    setSelectedServiceIds((prev) => {
      const filtered = prev.filter((id) => !categoryIds.includes(id));
      if (!serviceId) return filtered;
      return [...filtered, serviceId];
    });
  };

  /**
   * Người liên hệ phải hợp lệ trước khi đi tiếp: đây là địa chỉ DUY NHẤT nhận vé điện tử
   * và các thông báo đổi giờ / huỷ chuyến. Sai ở đây thì khách không nhận được gì cả,
   * mà lại không có dấu hiệu nào cho thấy đã sai.
   *
   * Ràng buộc SĐT khớp đúng với @Pattern bên BookingRequest (10 số, bắt đầu bằng 0) —
   * lỏng hơn ở web thì backend chặn và khách nhận về một lỗi khó hiểu ở bước cuối.
   */
  const validateContact = () => {
    const name = (contactInfo.name || "").trim();
    if (name.length < 2) return t.errContactNameRequired;
    if (!/^\S+@\S+\.\S+$/.test((contactInfo.email || "").trim())) return t.errEmailInvalid;
    if (!/^0\d{9}$/.test((contactInfo.phone || "").replace(/\D/g, ""))) return t.errPhoneInvalid;
    return null;
  };

  const validatePassenger = () => {
    const contactError = validateContact();
    if (contactError) return contactError;

    for (const [idx, pi] of passengerInfoList.entries()) {
      const d = pi.data || {};
      const isAdult = pi.type === "ADULT";
      const typeLabel = isAdult
        ? t.adult.toLowerCase()
        : pi.type === "CHILD"
          ? t.child.toLowerCase()
          : t.infant.toLowerCase();

      if (!d.fullName || d.fullName.trim() === "")
        return t.errPassengerName.replace("{type}", typeLabel).replace("{index}", idx + 1);

      const dobError = validatePassengerDob(
        d.dateOfBirth,
        pi.type,
        selectedTrip?.departureTime ? new Date(selectedTrip.departureTime) : undefined
      );
      if (dobError === "future") return t.errDobFuture.replace("{index}", idx + 1);
      if (dobError === "ageMismatch")
        return t.errDobAgeMismatch.replace("{index}", idx + 1).replace("{type}", typeLabel);
      if (dobError) return t.errDobInvalid.replace("{index}", idx + 1);
      if (!d.gender) return t.errGenderRequired.replace("{index}", idx + 1);

      // Email/SĐT không còn hỏi theo từng hành khách — chúng thuộc về người liên hệ
      // của cả đơn và được kiểm ở validateContact(). Ở đây chỉ còn giấy tờ tuỳ thân,
      // thứ thực sự gắn với từng người khi soát vé.
      if (isAdult && !d.idNumber) return t.errIdNumberRequired;
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
      setError(
        t.errSeatCountMismatch
          .replaceAll("{total}", maxSeats)
          .replace("{selected}", selectedSeatIds.length)
      );
      return;
    }
    if (!isConnected) {
      setError(t.wsNotConnected);
      return;
    }

    setError("");
    const { success, failed, error } = await lockSeats({
      tripId: selectedTrip.id,
      seatIds: selectedSeatIds,
    });

    if (!success) {
      // TIMEOUT/DISCONNECTED là lỗi hạ tầng, không phải tranh chấp ghế. Trước đây hai
      // trường hợp này rơi vào nhánh `failed?.length` nên ghế đang chọn bị xoá sạch kèm
      // thông báo "ghế đã có người khác chọn" — sai hẳn bản chất, và đó là thứ người dùng
      // gặp trên production lúc web không có ai khác đang đặt. Giờ giữ nguyên ghế để bấm lại.
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
      setError(
        t.errSeatCountMismatch
          .replaceAll("{total}", maxSeats)
          .replace("{selected}", selectedSeatIds.length)
      );
      return;
    }

    setError("");
    setSubmitLoading(true);

    const names = passengerInfoList
      .filter((p) => p.type !== "INFANT")
      .map((p) => p.data.fullName)
      .filter(Boolean);

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
          contactName: contactInfo.name.trim(),
          contactEmail: contactInfo.email.trim(),
          contactPhone: contactInfo.phone.trim(),
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
        passengerInfoList.forEach((pi) => {
          if (pi.type === "ADULT" && pi.data.fullName) {
            addPassenger({ ...pi.data, passengerType: "ADULT" }).catch(() => {});
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

  return {
    // tra cứu & bản dịch
    t,
    currentLanguage,
    money,
    stations,
    location,

    // tài khoản
    token,
    isAuthenticated,
    user,
    membershipDiscountPercent,
    savedPassengers,

    // tìm chuyến
    from,
    setFrom,
    to,
    setTo,
    date,
    setDate,
    showFromDropdown,
    setShowFromDropdown,
    showToDropdown,
    setShowToDropdown,
    passengerCounts,
    passengers,
    passengerCountLocked,
    changePassengerCount,
    showPassengersDropdown,
    setShowPassengersDropdown,
    todayISO,
    handleSearch,
    handleSearchWithDate,
    performSearch,
    formErrors,
    setFormErrors,

    // kết quả & bộ lọc
    trips,
    filteredTrips,
    allProviders,
    sortBy,
    setSortBy,
    filterAvailableOnly,
    setFilterAvailableOnly,
    filterProviders,
    setFilterProviders,
    timeRange,
    setTimeRange,
    maxPriceFilter,
    setMaxPriceFilter,

    // lịch giá
    calendarOpen,
    setCalendarOpen,
    calendarLoading,
    calendarData,
    loadCalendar,

    // chuyến & chỗ
    selectedTrip,
    handleSelectTrip,
    seats,
    selectedSeatIds,
    setSelectedSeatIds,
    toggleSeat,
    maxSeats,
    isMaxReached,
    selectedSeatClass,
    setSelectedSeatClass,

    // giữ chỗ
    isConnected,
    ownerToken,
    timeLeft,
    paymentTimeLeft,
    lockDeadline,
    setLockDeadline,
    // Trang tự nhả ghế khi người dùng bấm quay lại từ các bước sau.
    unlockSeats,

    // Thông báo trượt góc màn hình. setError ở trên là lối tắt cho mức "error";
    // trang nào cần báo thành công hoặc nhắc nhở thì gọi thẳng showToast.
    showToast,

    // hành khách & liên hệ
    passengerInfoList,
    handlePassengerChange,
    contactInfo,
    setContactInfo,
    globalContact,
    setGlobalContact,

    // dịch vụ đi kèm
    services,
    servicesLoading,
    selectedServiceIds,
    categories,
    setSingleServiceInCategory,
    showAllMeals,
    setShowAllMeals,
    showInsuranceInfo,
    setShowInsuranceInfo,

    // tiền
    orderSubtotal,
    membershipDiscount,
    voucherBaseAmount,
    promoCode,
    setPromoCode,
    appliedVoucher,
    voucherDiscount,
    handleApplyVoucher,

    // điều hướng các bước & tạo đơn
    step,
    setStep,
    goToExtras,
    goToExtrasFromPassenger,
    goToReview,
    submitBooking,
    submitLoading,
    bookingResult,
    loading,
    setError,
  };
}

/**
 * Mọi thứ hook trả về — kiểu của prop `booking` ở các component bước đặt vé.
 *
 * Suy ra thẳng từ câu `return` của hook chứ không khai tay: thêm, bớt hay đổi tên một
 * trường ở đây thì mọi chỗ đọc `booking.x` sai tên đều bị `npm run typecheck` chỉ ra, thay
 * vì lặng lẽ nhận `undefined` rồi hiện ô trống trên màn hình.
 *
 * @typedef {ReturnType<typeof useTicketBooking>} Booking
 */
