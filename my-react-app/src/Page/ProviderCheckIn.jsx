import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { parseBookingId } from "../utils/ticketQr";
import {
  FaSearch, FaHistory, FaCheckCircle, FaImage, FaCamera, FaSync, FaBolt,
  FaExclamationTriangle, FaInfoCircle, FaTimes, FaQrcode, FaUserAlt, FaChair,
  FaRegClock, FaMapMarkerAlt, FaTicketAlt, FaRedo, FaKeyboard, FaVideoSlash,
  FaArrowRight, FaBuilding,
} from "react-icons/fa";

/**
 * Trang soát vé của nhân viên (Provider/Admin).
 *
 * Hợp đồng với backend giữ nguyên như trước — chỉ hai endpoint:
 *   POST /api/bookings/{id}/check-in   -> trả về BookingResponse của vé vừa soát
 *   GET  /api/bookings/recent-checkins -> 10 lượt soát gần nhất
 * Việc nhận dạng nội dung QR nằm ở parseBookingId() trong utils/ticketQr.js — dùng chung
 * với MyBookings (nơi sinh mã) để hai bên không lệch định dạng. Hàm đó vẫn nhận cả các
 * dạng QR cũ đang lưu hành: JSON, số trần, "TICKET-<id>-<ngày>".
 * Toàn bộ phần còn lại ở đây nằm ở phía trình duyệt: cách xin quyền camera,
 * cách chống quét trùng, cách báo lỗi và giao diện.
 */

const READER_ID = "chk-qr-reader";

const SCAN_CONFIG = {
  fps: 12,
  // qrbox động: luôn chiếm ~70% cạnh ngắn của khung hình nên hoạt động tốt cả trên
  // điện thoại dọc lẫn webcam ngang, thay vì cố định 250px như trước.
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
    const size = Math.max(160, Math.min(edge, 420));
    return { width: size, height: size };
  },
  // Cố tình KHÔNG đặt `aspectRatio`: thư viện dịch tuỳ chọn đó thành
  // track.applyConstraints({aspectRatio}) và await nó, nên camera nào không nhận
  // ràng buộc này sẽ làm cả lượt start thất bại.
};

/** Thời gian chờ đủ dài cho lần gọi đầu tiên đánh thức backend Render (gói free ngủ khi vắng khách). */
const REQUEST_TIMEOUT_MS = 45000;
/** Sau ngần này mà chưa có phản hồi thì đổi thông báo sang "máy chủ đang khởi động". */
const WAKING_HINT_AFTER_MS = 6000;
/** Cùng một mã QR quét lại trong khoảng này sẽ bị bỏ qua, tránh bắn hàng loạt request. */
const DUPLICATE_WINDOW_MS = 4000;
/** Sau khi hiện kết quả thì tự mở lại camera để soát người tiếp theo. */
const AUTO_RESUME_MS = 3000;
/** Nhịp nghỉ cho driver nhả thiết bị giữa hai lần mở — webcam Windows nhả không tức thì. */
const RELEASE_SETTLE_MS = 300;
/** Chờ trước khi thử lại một nguồn camera vừa báo "đang bận". */
const BUSY_RETRY_MS = 500;
/** Hạn giờ cho scanner.stop() — xem chú thích ở stopQuietly. */
const STOP_TIMEOUT_MS = 2500;

/**
 * Ảnh chỉ được giải mã NGAY TRONG TRÌNH DUYỆT (blob URL -> <img> -> <canvas>),
 * không có byte nào của ảnh được gửi lên máy chủ. Danh sách này vì thế không phải
 * là hàng rào bảo mật phía server mà để (1) chặn sớm những định dạng trình duyệt
 * không giải mã được — trước đây chúng rơi vào câu "không tìm thấy mã QR" gây hiểu
 * nhầm, và (2) khỏi vẽ file khổng lồ lên canvas làm treo tab của nhân viên soát vé.
 */
const ACCEPTED_IMAGE_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp",
  "image/gif", "image/bmp", "image/x-ms-bmp", "image/avif",
];
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const isLocalhost = () => {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

const isStandalonePwa = () =>
  window.navigator.standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

/** Phản hồi bằng âm thanh + rung để nhân viên không phải nhìn màn hình sau mỗi lượt quét. */
const feedback = (ok) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = ok ? "sine" : "square";
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.16 : 0.32));
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.18 : 0.34));
      setTimeout(() => ctx.close().catch(() => {}), 600);
    }
  } catch {
    /* âm thanh chỉ là phụ trợ, im lặng nếu trình duyệt chặn */
  }
  try {
    navigator.vibrate?.(ok ? 60 : [60, 60, 60]);
  } catch {
    /* bỏ qua */
  }
};

/**
 * Gộp name + message của lỗi thành một chuỗi để dò nguyên nhân.
 *
 * Bắt buộc phải làm vậy vì html5-qrcode KHÔNG ném lại DOMException của getUserMedia:
 * nó nuốt đi rồi reject bằng một *chuỗi* dạng
 *   "Error getting userMedia, error = OverconstrainedError: ..."
 * nên `err.name` luôn rỗng, mọi so sánh theo name đều trượt và lỗi nào cũng rơi
 * xuống câu chung chung "Không thể bật camera".
 */
const errorText = (err) => {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    return `${err.name || ""} ${err.message || ""}`.trim() || String(err);
  }
  return String(err ?? "");
};

/** Chuyển lỗi của getUserMedia / html5-qrcode thành câu tiếng người. */
const describeCameraError = (err, t) => {
  const text = errorText(err);
  const has = (pattern) => pattern.test(text);

  if (has(/\bINSECURE\b|SecurityError|insecure|secure origin/i)) return t.chkInsecureContext;
  if (has(/\bUNSUPPORTED\b|NotSupportedError|not supported/i)) return t.chkUnsupported;
  if (has(/NotAllowedError|PermissionDenied|permission|denied|dismissed|disallowed/i)) return t.chkPermissionDenied;
  if (has(/NotFoundError|DevicesNotFound|no camera|not found/i)) return t.chkNoCamera;
  if (has(/NotReadableError|TrackStartError|AbortError|in use|could not start|failed to allocate/i)) return t.chkCameraBusy;
  if (has(/OverconstrainedError|ConstraintNotSatisfied|constraint/i)) return t.chkOverconstrained;
  return t.chkCameraFail;
};

/**
 * Sau khi thử lần lượt nhiều nguồn camera ta có cả một xâu lỗi. Lỗi của lượt CUỐI
 * thường là lượt dự phòng vô thưởng vô phạt, nên chọn lỗi nói được nguyên nhân thật
 * để hiển thị thay vì cứ lấy lỗi cuối cùng.
 */
const CAMERA_ERROR_PRIORITY = [
  /NotAllowedError|PermissionDenied|dismissed/i,
  /NotReadableError|TrackStartError|could not start|in use/i,
  /NotFoundError|DevicesNotFound/i,
  /OverconstrainedError|ConstraintNotSatisfied/i,
];

const pickCameraError = (errors) => {
  for (const pattern of CAMERA_ERROR_PRIORITY) {
    const hit = errors.find((e) => pattern.test(errorText(e)));
    if (hit) return hit;
  }
  return errors[errors.length - 1] ?? new Error("START_FAILED");
};

/**
 * Camera ảo và camera hồng ngoại: nằm chung danh sách như camera thật nhưng gần như
 * không bao giờ là thứ nhân viên muốn soát vé bằng.
 *
 * OBS/NVIDIA Broadcast cài đặt xong là để lại một thiết bị ảo thường trú, KHÔNG cần
 * mở ứng dụng; Windows lại hay đặt nó làm camera mặc định. Nó mở được bình thường —
 * chỉ có điều khung hình là ảnh chờ (logo OBS) chứ không có gì để quét. Camera hồng
 * ngoại Windows Hello thì ngược lại: mở ra là NotReadableError.
 *
 * Cả hai đều phải bị đẩy xuống cuối hàng chờ, sau mọi camera thật.
 */
const VIRTUAL_CAMERA_RE =
  /obs|virtual|nvidia|broadcast|manycam|xsplit|streamlabs|snap camera|ivcam|droidcam|epoccam|iriun|splitcam|fake|screen capture|infrared|windows hello|\bir\b/i;

const isVirtualCamera = (cam) => VIRTUAL_CAMERA_RE.test(cam?.label || "");

const isPermissionError = (err) =>
  /NotAllowedError|PermissionDenied|SecurityError|dismissed|disallowed/i.test(errorText(err));

/** Thiết bị mở không được vì đang bị giữ — bởi ứng dụng khác HOẶC bởi chính trang này. */
const isBusyError = (err) =>
  /NotReadableError|TrackStartError|AbortError|could not start|in use|failed to allocate/i.test(errorText(err));

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Thu hồi luồng camera bị bỏ rơi                                      */
/* ------------------------------------------------------------------ */
/**
 * Đây là nguyên nhân gốc của triệu chứng "camera đang bị ứng dụng khác chiếm dụng"
 * trong khi không có Zoom/Meet/Máy ảnh nào đang chạy: kẻ chiếm camera chính là tab này.
 *
 * html5-qrcode mở stream trước rồi mới gắn vào thẻ <video>
 * (camera/core-impl.js: CameraImpl.create -> RenderedCameraImpl.create). Nếu bước gắn
 * hỏng — applyConstraints bị từ chối, video.onerror/onabort, thẻ bị tháo giữa chừng —
 * nó reject mà KHÔNG stop() các track đã mở. Stream đó sống tiếp một cách vô hình cho
 * tới khi tải lại trang, nên từ lần bấm "Bật Cam" thứ hai trở đi thiết bị bận thật và
 * trình duyệt trả về đúng NotReadableError: Could not start video source. Đặt lại quyền
 * không cứu được vì quyền không phải thứ đang chặn.
 *
 * Stream rò rỉ nằm kín bên trong thư viện, API công khai không chạm tới được. Nên ta
 * bọc getUserMedia đúng một lần để ghi sổ MỌI stream trang này mở — kể cả stream do
 * thư viện mở — rồi tự tay tắt sạch trước mỗi lần bật camera.
 */
const openStreams = new Set();

const stopStream = (stream) => {
  try {
    stream?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* track đã chết */
      }
    });
  } catch {
    /* bỏ qua */
  }
  openStreams.delete(stream);
};

let streamTrackerInstalled = false;

/**
 * Ghi đè getUserMedia ngay trên đối tượng mediaDevices (che hàm của prototype).
 * Chỉ thêm việc ghi sổ, không đổi tham số cũng không đổi kết quả, nên mọi nơi khác
 * trong ứng dụng vẫn dùng getUserMedia y như cũ.
 */
const installStreamTracker = () => {
  if (streamTrackerInstalled) return;
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) return;
  streamTrackerInstalled = true;

  const original = devices.getUserMedia.bind(devices);
  devices.getUserMedia = (constraints) => original(constraints).then((stream) => {
    openStreams.add(stream);
    // Stream tự kết thúc (thư viện gọi stop, rút USB...) thì xoá khỏi sổ luôn.
    stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
      if (stream.getTracks().every((tr) => tr.readyState === "ended")) openStreams.delete(stream);
    }));
    return stream;
  });
};

/** Tắt mọi luồng camera trang này còn giữ, kể cả stream còn dính trên thẻ <video>. */
const releaseCameraStreams = () => {
  [...openStreams].forEach(stopStream);
  document.querySelectorAll(`#${READER_ID} video`).forEach((video) => {
    const stream = video.srcObject;
    if (stream) {
      stopStream(stream);
      video.srcObject = null;
    }
  });
};

/**
 * Camera nhân viên tự chọn được nhớ lại giữa các lần vào trang: quầy soát vé dùng cố
 * định một chiếc webcam, bắt chọn lại mỗi lần F5 là vô lý. deviceId gắn với từng origin
 * và từng máy nên id cũ trên máy khác chỉ đơn giản là không khớp thiết bị nào — lúc đó
 * chương trình tự dò như bình thường.
 */
const CAMERA_PREF_KEY = "chk.cameraId";

const readCameraPref = () => {
  try {
    return localStorage.getItem(CAMERA_PREF_KEY) || "";
  } catch {
    return "";
  }
};

const saveCameraPref = (id) => {
  try {
    localStorage.setItem(CAMERA_PREF_KEY, id);
  } catch {
    /* chế độ ẩn danh chặn localStorage — chỉ mất tính năng nhớ, không sao */
  }
};

/** Xin quyền camera bằng đúng MỘT lần mở thiết bị. */
const requestCameraPermission = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  } catch (err) {
    if (isPermissionError(err)) throw err;
    // facingMode có thể đẩy trình duyệt vào đúng camera đang hỏng/bận; hạ xuống ràng
    // buộc tối thiểu để nó tự chọn thiết bị khác.
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
};

/**
 * scanner.stop() có thể treo vĩnh viễn: html5-qrcode resolve promise đóng camera bên
 * trong vòng lặp duyệt video track, nên stream không còn track nào (thiết bị bị rút,
 * track đã ended) thì không ai resolve cả. Vì vậy luôn kèm hạn giờ.
 */
const stopQuietly = async (scanner) => {
  try {
    if (!scanner || scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) return;
    await Promise.race([scanner.stop(), settle(STOP_TIMEOUT_MS)]);
  } catch {
    /* thư viện ném cả chuỗi lẫn Error — dừng được tới đâu hay tới đó */
  }
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

/** "14:30 · 23/08/2026" — bỏ giây cho đỡ rối, giờ đứng trước vì nhân viên soát vé nhìn giờ là chính. */
const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} · ${date}`;
};

const relativeTime = (value, t) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return t.chkRelativeNow || "vừa xong";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return (t.chkMinutesAgo || "{n} phút trước").replace("{n}", mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return (t.chkHoursAgo || "{n} giờ trước").replace("{n}", hours);
  return d.toLocaleDateString("vi-VN");
};

const isSameDay = (value, ref) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
};

/* ------------------------------------------------------------------ */
/* Thẻ thông tin vé — dùng lại ở cả khung kết quả lẫn modal chi tiết.   */
/* ------------------------------------------------------------------ */
const TicketInfo = ({ booking, t }) => {
  if (!booking) return null;
  const passengers = booking.ticketDetails || [];

  return (
    <div className="chk-ticket">
      <div className="chk-ticket-route">
        <span>{booking.origin || "N/A"}</span>
        <FaArrowRight className="chk-ticket-arrow" />
        <span>{booking.destination || "N/A"}</span>
      </div>

      <div className="chk-ticket-grid">
        <div className="chk-field">
          <span className="chk-field-label"><FaRegClock /> {t.chkDepartureLabel || "Khởi hành"}</span>
          <span className="chk-field-value">{formatDateTime(booking.departureTime) || "—"}</span>
        </div>
        <div className="chk-field">
          <span className="chk-field-label"><FaMapMarkerAlt /> {t.chkVehicleTypeLabel}</span>
          <span className="chk-field-value">{booking.vehicleType || "—"}</span>
        </div>
        <div className="chk-field">
          <span className="chk-field-label"><FaBuilding /> {t.chkProviderLabel || "Nhà cung cấp"}</span>
          <span className="chk-field-value">{booking.providerName || "—"}</span>
        </div>
        <div className="chk-field">
          <span className="chk-field-label"><FaTicketAlt /> {t.chkTotalLabel || "Tổng tiền"}</span>
          <span className="chk-field-value">{formatMoney(booking.totalPrice)}</span>
        </div>
      </div>

      <div className="chk-field">
        <span className="chk-field-label">
          <FaUserAlt /> {t.chkPassengerSeatLabel}
          {passengers.length > 0 && (
            <em className="chk-count">
              {(t.chkPassengersCount || "{n} hành khách").replace("{n}", passengers.length)}
            </em>
          )}
        </span>
        <div className="chk-passengers">
          {passengers.length > 0 ? (
            passengers.map((p, idx) => (
              <div key={p.ticketId ?? idx} className="chk-passenger">
                <span className="chk-passenger-name">{p.passengerName || t.chkWalkInGuest}</span>
                <span className="chk-seat"><FaChair /> {t.seatPrefix} {p.seatNumber || "N/A"}</span>
              </div>
            ))
          ) : (
            <div className="chk-empty-inline">{t.chkNoSeatDetails}</div>
          )}
        </div>
      </div>

      {booking.checkInDate && (
        <div className="chk-checked-at">
          <FaCheckCircle /> {t.chkCheckInAtLabel}: <b>{formatDateTime(booking.checkInDate)}</b>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const ProviderCheckIn = () => {
  const { t } = useLanguage();
  const { user, token, isAuthenticated } = useAuth();

  const [camState, setCamState] = useState("idle"); // idle | starting | scanning | paused
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(readCameraPref);
  const [cameraError, setCameraError] = useState("");
  // Nguyên văn lỗi của trình duyệt/thư viện — hiện dưới dạng dòng nhỏ để khi máy nào
  // đó không bật được camera thì còn có cái mà đọc, khỏi phải mở DevTools.
  const [cameraErrorDetail, setCameraErrorDetail] = useState("");
  const [usingVirtualCamera, setUsingVirtualCamera] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressNote, setProgressNote] = useState("");
  const [result, setResult] = useState(null); // { kind, bookingId, booking, message }

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  // Bản sao của selectedCameraId đọc được ngay lập tức: khi nhân viên đổi camera rồi
  // khởi động lại trong cùng một nhịp, state vẫn đang là giá trị cũ.
  const selectedCameraIdRef = useRef(readCameraPref());
  // Nhân viên đã TỰ chọn camera trong danh sách hay chưa. Đã tự chọn thì không được
  // âm thầm nhảy sang thiết bị khác nữa — xem chú thích ở startScanner.
  const explicitPickRef = useRef(!!readCameraPref());
  const fileInputRef = useRef(null);
  const processingRef = useRef(false);
  const lastCodeRef = useRef({ code: "", at: 0 });
  const resumeTimerRef = useRef(null);
  const wakingTimerRef = useRef(null);
  const aliveRef = useRef(true);

  const authHeaders = useMemo(() => {
    const bearer = token || localStorage.getItem("authToken");
    return bearer ? { Authorization: `Bearer ${bearer}` } : {};
  }, [token]);

  const roleLooksValid = useMemo(() => {
    const role = String(user?.role || "").toUpperCase();
    return role.includes("ADMIN") || role.includes("PROVIDER");
  }, [user]);

  /* ---------------- lịch sử soát vé ---------------- */

  const fetchRecentCheckIns = useCallback(async () => {
    if (!isAuthenticated) {
      setHistoryLoading(false);
      return [];
    }
    try {
      setHistoryLoading(true);
      const res = await axios.get("/api/bookings/recent-checkins", {
        headers: authHeaders,
        timeout: REQUEST_TIMEOUT_MS,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      if (aliveRef.current) {
        setHistory(list);
        setHistoryError("");
      }
      return list;
    } catch (err) {
      console.error("[CheckIn] Không tải được lịch sử:", err);
      if (aliveRef.current) setHistoryError(t.chkHistoryLoadError || "Không tải được lịch sử soát vé.");
      return [];
    } finally {
      if (aliveRef.current) setHistoryLoading(false);
    }
  }, [authHeaders, isAuthenticated, t]);

  useEffect(() => {
    fetchRecentCheckIns();
  }, [fetchRecentCheckIns]);

  /**
   * Dọn dẹp CHỈ khi rời trang. Tách riêng khỏi effect tải lịch sử ở trên: effect kia
   * phụ thuộc vào `t`, nên nếu gộp chung thì chỉ cần đổi ngôn ngữ giữa chừng là camera
   * đang quét bị tắt và scannerRef bị xoá trong khi giao diện vẫn báo "đang quét".
   */
  useEffect(() => {
    aliveRef.current = true;
    // Phải cài TRƯỚC khi thư viện kịp gọi getUserMedia lần nào, nếu không stream đầu
    // tiên nó mở sẽ nằm ngoài sổ và không thu hồi được.
    installStreamTracker();
    const resumeTimer = resumeTimerRef;
    const wakingTimer = wakingTimerRef;
    return () => {
      aliveRef.current = false;
      clearTimeout(resumeTimer.current);
      clearTimeout(wakingTimer.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      stopQuietly(scanner);
      // Rời trang giữa lúc camera đang chạy là đường rò rỉ dễ gặp nhất: thư viện tháo
      // thẻ <video> nhưng track vẫn sáng đèn, quay lại trang là gặp "thiết bị bận".
      releaseCameraStreams();
    };
  }, []);

  /* ---------------- vòng đời máy quét ---------------- */

  /**
   * Tạo instance ngay tại thời điểm cần dùng chứ không phải lúc mount.
   * Bản cũ khởi tạo trong useEffect và nuốt lỗi; nếu constructor ném (nó ném *chuỗi*
   * khi chưa tìm thấy phần tử DOM) thì ref vẫn là null và nút "Bật Cam" im lặng
   * không làm gì — đúng triệu chứng gặp trên bản deploy.
   */
  const ensureScanner = useCallback(() => {
    if (scannerRef.current) return scannerRef.current;
    if (!document.getElementById(READER_ID)) {
      throw new Error("Không tìm thấy khung hiển thị camera.");
    }
    scannerRef.current = new Html5Qrcode(READER_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
    });
    return scannerRef.current;
  }, []);

  const scannerState = () => {
    try {
      return scannerRef.current?.getState() ?? Html5QrcodeScannerState.NOT_STARTED;
    } catch {
      return Html5QrcodeScannerState.NOT_STARTED;
    }
  };

  const stopScanner = useCallback(async () => {
    clearTimeout(resumeTimerRef.current);
    setTorchOn(false);
    setTorchAvailable(false);
    setUsingVirtualCamera(false);
    await stopQuietly(scannerRef.current);
    // Quét nốt phần thư viện bỏ sót: chỉ cần một lần start hỏng giữa chừng là có một
    // stream vô chủ còn sống, và chính nó khiến lần bật sau báo "camera đang bận".
    releaseCameraStreams();
    setCamState("idle");
  }, []);

  /** Xoá nội dung thư viện đã vẽ vào khung (ảnh còn sót lại sau khi "Quét ảnh"). */
  const clearReaderSurface = useCallback(() => {
    try {
      if (scannerRef.current && scannerState() === Html5QrcodeScannerState.NOT_STARTED) {
        scannerRef.current.clear();
      }
    } catch {
      /* bỏ qua */
    }
  }, []);

  const detectTorch = useCallback(() => {
    try {
      const caps = scannerRef.current?.getRunningTrackCapabilities();
      setTorchAvailable(!!caps && "torch" in caps);
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    try {
      await scannerRef.current?.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch (err) {
      console.error("[CheckIn] Không đổi được đèn flash:", err);
      setTorchAvailable(false);
    }
  }, [torchOn]);

  const listCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ id: d.deviceId, label: d.label }))
        .filter((d) => d.id);
    } catch {
      return [];
    }
  }, []);

  /**
   * Camera nên chọn sẵn trong ô dropdown, kèm cờ cho biết đó là lựa chọn chắc chắn
   * (nhân viên tự chọn / nhãn nói rõ là camera sau) hay chỉ là đoán. Phải phân biệt vì
   * một cú đoán sai không chỉ hiển thị sai: nó còn là thiết bị được thử ĐẦU TIÊN.
   */
  const pickCameraId = useCallback((list, preferred) => {
    if (!list.length) return { id: "", confident: false };
    if (preferred && list.some((c) => c.id === preferred)) return { id: preferred, confident: true };

    const real = list.filter((c) => !isVirtualCamera(c));
    const pool = real.length ? real : list;
    const back = pool.find((c) => /back|rear|sau|environment|後|后置/i.test(c.label || ""));
    if (back) return { id: back.id, confident: true };
    // Loại được camera ảo ra rồi thì thiết bị đầu tiên còn lại là camera thật — trên
    // laptop/máy bàn đó chính là webcam gắn sẵn, đủ chắc để thử ngay đầu tiên.
    if (real.length) return { id: real[0].id, confident: true };
    return { id: pool[0].id, confident: false };
  }, []);

  const resumeScanning = useCallback(() => {
    clearTimeout(resumeTimerRef.current);
    try {
      if (scannerState() === Html5QrcodeScannerState.PAUSED) {
        scannerRef.current.resume();
        setCamState("scanning");
      }
    } catch (err) {
      console.error("[CheckIn] Không tiếp tục quét được:", err);
    }
  }, []);

  /**
   * html5-qrcode giữ nguyên callback được truyền vào lúc start(). Nếu truyền thẳng
   * onScanSuccess thì phiên quét đang chạy sẽ mãi dùng closure cũ (token, ngôn ngữ cũ),
   * nên ở đây truyền một wrapper ổn định và đọc bản mới nhất qua ref.
   */
  const onScanRef = useRef(() => {});
  const stableOnScan = useCallback((decodedText) => onScanRef.current(decodedText), []);

  /**
   * Xếp thứ tự các nguồn camera sẽ thử: deviceId cụ thể trước, rồi mới tới facingMode.
   *
   * Lưu ý về facingMode: html5-qrcode CHỈ chấp nhận chuỗi ("environment"/"user") hoặc
   * object { exact }. Bản cũ truyền { ideal: "environment" } nên lượt thử đó ném lỗi
   * ngay lập tức trước khi kịp chạm tới getUserMedia — coi như mất một lượt dự phòng.
   */
  const buildCameraAttempts = useCallback((preferredIds, list) => {
    const seen = new Set();
    const attempts = [];
    const push = (id) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      attempts.push(id);
    };

    preferredIds.forEach(push);
    list.filter((c) => !isVirtualCamera(c)).forEach((c) => push(c.id));
    // facingMode nằm SAU các camera thật vì trên máy tính nó vô nghĩa: trình duyệt chỉ
    // trả về thiết bị mặc định của Windows, mà máy có OBS/NVIDIA Broadcast thì mặc định
    // thường chính là camera ảo. Nó chỉ đáng giá trên điện thoại — nơi danh sách thiết
    // bị hoặc chưa có nhãn, hoặc mọi deviceId ở trên đều đã thất bại.
    attempts.push({ facingMode: "environment" });
    attempts.push({ facingMode: "user" });
    // Camera ảo là phương án cuối: có hình còn hơn không có gì.
    list.filter(isVirtualCamera).forEach((c) => push(c.id));
    return attempts;
  }, []);

  /**
   * Thử mở MỘT nguồn camera, tối đa hai lượt.
   *
   * Lượt đầu dính "thiết bị bận" phần lớn chỉ là driver chưa nhả xong từ lần mở ngay
   * trước đó (webcam Windows có máy chậm hơn nửa giây), chờ một nhịp rồi thử lại là chạy.
   */
  const startWithSource = useCallback(async (scanner, source, errors) => {
    for (let round = 0; round < 2; round += 1) {
      try {
        await scanner.start(source, SCAN_CONFIG, stableOnScan, undefined);
        return true;
      } catch (err) {
        errors.push(err);
        console.warn("[CheckIn] Không mở được camera với nguồn", source, err);
        // Bắt buộc dọn ở đây: start() hỏng giữa chừng là thư viện bỏ rơi stream đã mở,
        // để nguyên thì chính lượt thử kế tiếp sẽ thấy thiết bị bận vì lượt này.
        await stopQuietly(scanner);
        releaseCameraStreams();
        if (!aliveRef.current) return false;
        if (round === 0 && isBusyError(err)) {
          await settle(BUSY_RETRY_MS);
          continue;
        }
        return false;
      }
    }
    return false;
  }, [stableOnScan]);

  /**
   * Bật camera.
   *
   * Nguyên tắc xuyên suốt: mỗi lần mở thiết bị là một lần có thể hỏng, nên mở càng ít
   * lần càng tốt, và không lần hỏng nào được phép chặn những lần thử còn lại. Bản cũ
   * làm ngược lại — mở một stream để xin quyền, mở/đóng thêm vài stream nữa để dò xem
   * thiết bị rảnh chưa, rồi mới để thư viện mở lần cuối — và chỉ cần lượt đầu tiên ném
   * lỗi là cả quy trình dừng, kể cả khi máy còn camera khác dùng tốt.
   */
  const startScanner = useCallback(async () => {
    // Chốt bằng ref chứ không bằng camState: state chỉ đổi ở lần render sau, nên hai
    // cú bấm liền nhau lọt được cả hai vào đây và tự tranh camera của nhau.
    if (startingRef.current) return;
    if (scannerState() === Html5QrcodeScannerState.SCANNING) return;
    startingRef.current = true;

    setCameraError("");
    setCameraErrorDetail("");
    setUsingVirtualCamera(false);
    setCamState("starting");

    const errors = [];
    let failedCamLabel = "";
    try {
      if (!window.isSecureContext && !isLocalhost()) throw new Error("INSECURE");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNSUPPORTED");

      // (0) Đòi lại camera mà chính trang này còn giữ từ những lần thử trước.
      releaseCameraStreams();

      // (1) Chỉ xin quyền khi thật sự chưa có: enumerateDevices giấu nhãn thiết bị cho
      // tới khi được cấp quyền, nên danh sách không nhãn = chưa có quyền. Khi đã có
      // quyền thì bỏ hẳn bước probe — mở thừa một lần là thêm một nhịp đóng/mở thiết bị,
      // mà chính nhịp đó hay đẻ ra NotReadableError.
      let list = await listCameras();
      let probeId = "";
      if (!list.some((c) => c.label)) {
        try {
          // Xin quyền NGAY trong cử chỉ bấm nút: yêu cầu quyền không đi kèm cử chỉ
          // người dùng bị Safari từ chối thẳng và bị Chrome tự đóng hộp thoại.
          const probe = await requestCameraPermission();
          // deviceId của camera VỪA mở được — nguồn chắc chắn dùng được, quý hơn mọi
          // phép đoán theo nhãn thiết bị.
          probeId = probe.getVideoTracks()[0]?.getSettings?.()?.deviceId || "";
          stopStream(probe);
          await settle(RELEASE_SETTLE_MS);
        } catch (err) {
          // Bị chặn quyền thì có cố nữa cũng vô ích. Còn NotReadable/Overconstrained/
          // NotFound chỉ nói camera MẶC ĐỊNH không mở được — máy vẫn có thể còn camera
          // khác chạy tốt, nên ghi lỗi lại rồi đi tiếp thay vì bỏ cuộc như bản cũ.
          if (isPermissionError(err)) throw err;
          errors.push(err);
          console.warn("[CheckIn] Camera mặc định không mở được, chuyển sang thử từng thiết bị:", err);
        }
        if (!aliveRef.current) return;
        list = await listCameras();
      }
      if (aliveRef.current) setCameras(list);

      // Camera vừa mở ở bước xin quyền chỉ đáng tin khi nó là camera thật: trên máy có
      // OBS/NVIDIA Broadcast, thiết bị mặc định mà trình duyệt đưa ra chính là camera ảo.
      if (probeId && isVirtualCamera(list.find((c) => c.id === probeId))) probeId = "";

      const chosenId = selectedCameraIdRef.current;
      const { id: targetId, confident } = pickCameraId(list, chosenId);
      if (targetId && targetId !== chosenId && aliveRef.current) {
        selectedCameraIdRef.current = targetId;
        setSelectedCameraId(targetId);
      }

      const scanner = ensureScanner();
      clearReaderSurface();

      // (2) Nhân viên đã tự chọn camera thì thử ĐÚNG cái đó, hỏng là báo hỏng.
      //
      // Rơi tiếp sang thiết bị khác trong tình huống này là có hại: nó lặng lẽ đưa
      // camera ảo (OBS/NVIDIA Broadcast — thứ luôn mở được và luôn có ảnh chờ) lên màn
      // hình, ô chọn nhảy về theo, và người dùng tưởng camera đang chạy trong khi thực
      // ra webcam họ chọn đã hỏng. Thà báo thẳng để còn biết đường xử lý.
      //
      // Khi chưa ai chọn gì thì mới tự dò: nguồn chắc chắn trước (camera vừa mở được ở
      // bước xin quyền, camera có nhãn "mặt sau", webcam thật đầu tiên), rồi tới các
      // camera thật còn lại, rồi facingMode, cuối cùng mới tới camera ảo.
      const chosenCam = list.find((c) => c.id === chosenId);
      const strictPick = explicitPickRef.current && !!chosenCam;
      if (strictPick) failedCamLabel = chosenCam.label || "";

      const attempts = strictPick
        ? [chosenId]
        : buildCameraAttempts([chosenId, probeId, confident ? targetId : ""], list);

      let started = false;
      for (const source of attempts) {
        started = await startWithSource(scanner, source, errors);
        if (started || !aliveRef.current) break;
      }

      if (!aliveRef.current) {
        if (started) await stopQuietly(scanner);
        releaseCameraStreams();
        return;
      }
      if (!started) throw pickCameraError(errors);

      // Đồng bộ ô chọn với thiết bị THẬT SỰ đang chạy: nguồn thắng cuộc có thể là
      // facingMode chứ không phải deviceId ta nhắm, để lệch thì ô chọn ghi một đằng
      // khung hình một nẻo — đúng cảnh dropdown ghi webcam laptop mà màn hình lên logo OBS.
      try {
        const runningId = scanner.getRunningTrackSettings?.()?.deviceId;
        if (runningId) {
          selectedCameraIdRef.current = runningId;
          setSelectedCameraId(runningId);
          // Camera ảo mở được nhưng khung hình chỉ là ảnh chờ của OBS/NVIDIA — quét cả
          // ngày cũng không ra mã. Phải nói rõ thay vì để nhân viên ngồi soi màn hình.
          setUsingVirtualCamera(isVirtualCamera(list.find((c) => c.id === runningId)));
        }
      } catch {
        /* không đọc được thì thôi, chỉ là hiển thị */
      }

      setCamState("scanning");
      detectTorch();
    } catch (err) {
      console.error("[CheckIn] Bật camera thất bại:", err);
      if (!aliveRef.current) return;
      setCamState("idle");
      setCameraError(describeCameraError(err, t));
      const detail = errorText(err);
      const shown = /\b(INSECURE|UNSUPPORTED)\b/.test(detail) ? "" : detail.slice(0, 200);
      // Ghi kèm tên camera đã chọn: trên máy có nhiều thiết bị, biết "cái nào hỏng"
      // quan trọng ngang biết "hỏng vì lý do gì".
      setCameraErrorDetail(failedCamLabel && shown ? `${failedCamLabel} — ${shown}` : shown);
    } finally {
      startingRef.current = false;
    }
  }, [listCameras, pickCameraId, buildCameraAttempts, ensureScanner, clearReaderSurface, detectTorch, startWithSource, t]);

  /**
   * Đổi camera ngay giữa lúc đang quét. Bản cũ khoá ô chọn khi camera đang chạy nên
   * muốn đổi phải Dừng Cam rồi Bật Cam lại — mà đúng lúc cần đổi nhất là lúc đang thấy
   * khung hình sai (camera ảo, camera hồng ngoại tối om) thì camera lại đang chạy.
   */
  const switchCamera = useCallback(async (id) => {
    selectedCameraIdRef.current = id;
    explicitPickRef.current = true;
    saveCameraPref(id);
    setSelectedCameraId(id);
    const state = scannerState();
    if (state !== Html5QrcodeScannerState.SCANNING && state !== Html5QrcodeScannerState.PAUSED) return;
    await stopScanner();
    await settle(RELEASE_SETTLE_MS);
    if (aliveRef.current) startScanner();
  }, [stopScanner, startScanner]);

  /* ---------------- soát vé ---------------- */

  const runCheckIn = useCallback(async (rawValue, { fromCamera = false } = {}) => {
    if (processingRef.current) return;

    const bookingId = parseBookingId(rawValue);
    if (!bookingId) {
      const shown = String(rawValue ?? "").slice(0, 60) || "—";
      feedback(false);
      setResult({
        kind: "error",
        bookingId: "",
        booking: null,
        message: (t.chkInvalidNumber || "Mã vé phải là số. Nội dung đọc được: {v}").replace("{v}", shown),
      });
      return;
    }

    processingRef.current = true;
    setBusy(true);
    setProgressNote(t.chkVerifying);
    clearTimeout(wakingTimerRef.current);
    wakingTimerRef.current = setTimeout(() => {
      if (aliveRef.current) setProgressNote(t.chkWakingServer || t.chkVerifying);
    }, WAKING_HINT_AFTER_MS);

    try {
      const res = await axios.post(`/api/bookings/${bookingId}/check-in`, {}, {
        headers: authHeaders,
        timeout: REQUEST_TIMEOUT_MS,
      });

      feedback(true);
      if (aliveRef.current) {
        setResult({ kind: "success", bookingId, booking: res.data, message: "" });
        setManualId("");
      }
      fetchRecentCheckIns();
    } catch (err) {
      console.error("[CheckIn] Lỗi soát vé:", err);
      const serverMsg = err.response?.data?.message;
      // axios đổi adapter tuỳ trình duyệt: bản fetch báo hết giờ bằng ETIMEDOUT,
      // bản XHR bằng ECONNABORTED — phải nhận cả hai, cộng thêm lỗi mạng.
      const timedOut = ["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED", "ERR_NETWORK"].includes(err.code);
      const offline = !navigator.onLine;
      // Không có câu lỗi nghiệp vụ + mã 5xx => sự cố phía máy chủ / proxy, không phải lỗi vé.
      const infraDown = !serverMsg && Number(err.response?.status) >= 500;

      // Backend trả đúng câu này khi vé đã soát rồi — đó không phải lỗi thao tác,
      // nhân viên vẫn cần thấy vé của ai và đã soát lúc nào.
      if (serverMsg && serverMsg.includes("đã được check-in vào lúc")) {
        feedback(false);
        const when = serverMsg.split("vào lúc ")[1];
        let note = serverMsg;
        const d = when ? new Date(when.trim()) : null;
        if (d && !Number.isNaN(d.getTime())) {
          note = (t.chkAlreadyCheckedIn || "đã được check-in lúc {time} ngày {date}")
            .replace("{time}", d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))
            .replace("{date}", d.toLocaleDateString("vi-VN"));
        }
        if (aliveRef.current) setResult({ kind: "already", bookingId, booking: null, message: note });

        // Lấy lại lịch sử để hiện đầy đủ thông tin vé đã soát trước đó.
        const list = await fetchRecentCheckIns();
        const found = list.find((b) => String(b.id) === String(bookingId));
        if (found && aliveRef.current) {
          setResult((prev) => (prev && prev.bookingId === bookingId ? { ...prev, booking: found } : prev));
        }
      } else {
        feedback(false);
        // Lỗi hạ tầng (mất mạng, hết giờ chờ, 5xx, 401/403) không nói lên vé đúng hay sai,
        // nên tiêu đề phải là "chưa kiểm tra được" chứ không phải "vé không hợp lệ".
        let message = serverMsg || err.message || t.chkProcessingError;
        let title = null;
        const status = err.response?.status;
        if (offline) {
          message = t.chkOffline || message;
          title = t.chkUnverifiedTitle;
        } else if (timedOut || infraDown) {
          message = t.chkTimeoutError || message;
          title = t.chkUnverifiedTitle;
        } else if (status === 401 || status === 403) {
          message = t.chkAuthRequired || message;
          title = t.chkUnverifiedTitle;
        }
        if (aliveRef.current) setResult({ kind: "error", bookingId, booking: null, message, title });
      }
    } finally {
      clearTimeout(wakingTimerRef.current);
      processingRef.current = false;
      if (aliveRef.current) {
        setBusy(false);
        setProgressNote("");
        if (fromCamera && scannerState() === Html5QrcodeScannerState.PAUSED) {
          resumeTimerRef.current = setTimeout(resumeScanning, AUTO_RESUME_MS);
        }
      }
    }
  }, [authHeaders, fetchRecentCheckIns, resumeScanning, t]);

  /**
   * Callback của thư viện: bắn liên tục ~12 lần/giây khi mã QR nằm trong khung.
   * Bản cũ gọi thẳng check-in ở đây nên một tấm vé giơ lên 2 giây tạo ra hàng chục
   * request và loạt thông báo "vé đã check-in". Giờ tạm dừng khung hình ngay lập tức
   * và chặn trùng mã trong DUPLICATE_WINDOW_MS.
   */
  const onScanSuccess = useCallback((decodedText) => {
    if (processingRef.current) return;
    const now = Date.now();
    if (lastCodeRef.current.code === decodedText && now - lastCodeRef.current.at < DUPLICATE_WINDOW_MS) {
      // Vẫn là tấm vé cũ đang nằm trong khung: dời mốc thời gian để cửa sổ chống trùng
      // chỉ hết hạn sau khi mã đã rời khỏi khung đủ lâu, thay vì cứ mỗi lần tự quét lại
      // là gửi thêm một request cho cùng một vé.
      lastCodeRef.current.at = now;
      return;
    }
    lastCodeRef.current = { code: decodedText, at: now };

    try {
      if (scannerState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.pause(true);
        setCamState("paused");
      }
    } catch {
      /* bỏ qua */
    }
    runCheckIn(decodedText, { fromCamera: true });
  }, [runCheckIn]);

  useEffect(() => { onScanRef.current = onScanSuccess; }, [onScanSuccess]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = "";
    if (!file) return;

    // accept="image/*" chỉ là gợi ý cho hộp thoại chọn file, người dùng vẫn có thể
    // chọn "All files" và đưa vào bất cứ thứ gì — nên phải tự kiểm lại ở đây.
    const mime = String(file.type || "").toLowerCase();
    if (!ACCEPTED_IMAGE_TYPES.includes(mime)) {
      feedback(false);
      setResult({ kind: "error", bookingId: "", booking: null, message: t.chkImageTypeError });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      feedback(false);
      setResult({ kind: "error", bookingId: "", booking: null, message: t.chkImageTooLarge });
      return;
    }

    try {
      setBusy(true);
      setCameraError("");
      setCameraErrorDetail("");
      setProgressNote(t.chkAnalyzingImage);

      if (camState !== "idle") await stopScanner();

      const scanner = ensureScanner();
      // showImage = false: giữ khung hiển thị do React kiểm soát, tránh việc thư viện
      // chèn thẻ <img> vào rồi bị lớp overlay che mất như bản cũ.
      const decoded = await scanner.scanFile(file, false);
      clearReaderSurface();
      setProgressNote("");
      await runCheckIn(decoded);
    } catch (err) {
      console.error("[CheckIn] Không đọc được mã từ ảnh:", err);
      feedback(false);
      setResult({ kind: "error", bookingId: "", booking: null, message: t.chkQrNotFound });
    } finally {
      setBusy(false);
      setProgressNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [camState, stopScanner, ensureScanner, clearReaderSurface, runCheckIn, t]);

  const submitManual = useCallback(() => {
    const value = manualId.trim();
    if (!value || busy) return;
    runCheckIn(value);
  }, [manualId, busy, runCheckIn]);

  /* ---------------- dữ liệu dẫn xuất ---------------- */

  const todayCount = useMemo(() => {
    const now = new Date();
    return history.filter((b) => isSameDay(b.checkInDate, now)).length;
  }, [history]);

  const resultTone = result?.kind === "success" ? "ok" : result?.kind === "already" ? "warn" : "bad";
  const resultTitle = result?.title
    || (result?.kind === "success"
      ? (t.chkSuccessTitle || "Check-in thành công")
      : result?.kind === "already"
        ? (t.chkAlreadyTitle || "Vé đã được soát trước đó")
        : (t.chkFailTitle || "Vé không hợp lệ"));

  const scanning = camState === "scanning";
  const paused = camState === "paused";
  const starting = camState === "starting";

  return (
    <div className="chk-page">
      <style>{CHECKIN_STYLES}</style>
      <Sidebar />

      <div className="chk-shell">
        {/* App.jsx đã dựng <Header /> cho route này. Trang tự dựng thêm một cái nữa là
            hai header position:fixed chồng khít lên nhau — từ khi có ngăn kéo mobile thành
            hai hamburger, hai ngăn kéo trong DOM. Prop setIsSidebarOpen cũng chưa bao giờ
            có tác dụng: Header không nhận prop nào. */}

        <main className="chk-main">
          <header className="chk-head">
            <div className="chk-head-icon"><FaQrcode /></div>
            <div className="chk-head-text">
              <h1>{t.chkTitle}</h1>
              <p>{t.chkSubtitle || ""}</p>
            </div>
            <div className="chk-head-stats">
              <div className="chk-stat">
                <b>{todayCount}</b>
                <span>{t.chkTodayCount || "Hôm nay"}</span>
              </div>
              <div className="chk-stat">
                <b>{history.length}</b>
                <span>{t.chkTotalCount || "Gần đây"}</span>
              </div>
            </div>
          </header>

          {isAuthenticated && !roleLooksValid && (
            <div className="chk-banner warn">
              <FaExclamationTriangle /> <span>{t.chkAuthRequired}</span>
            </div>
          )}
          {!isAuthenticated && (
            <div className="chk-banner bad">
              <FaExclamationTriangle /> <span>{t.chkAuthRequired}</span>
            </div>
          )}

          <div className="chk-grid">
            {/* ---------------- cột trái: máy quét ---------------- */}
            <section className="chk-card">
              <div className={`chk-viewport ${scanning ? "is-scanning" : ""}`}>
                {/* Vùng do html5-qrcode toàn quyền điều khiển — React không render con
                    nào bên trong để hai bên không tranh nhau DOM. */}
                <div id={READER_ID} className="chk-reader" />

                {!scanning && !paused && (
                  <div className="chk-overlay">
                    {starting ? (
                      <>
                        <FaSync className="chk-spin chk-overlay-icon" />
                        <span className="chk-overlay-title">{t.chkStarting || "Đang khởi động camera..."}</span>
                      </>
                    ) : (
                      <>
                        <FaCamera className="chk-overlay-icon" />
                        <span className="chk-overlay-title">{t.chkScanHint1}</span>
                        <span className="chk-overlay-sub">{t.chkScanHint2}</span>
                      </>
                    )}
                  </div>
                )}

                {scanning && (
                  <div className="chk-frame" aria-hidden="true">
                    <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
                    <div className="chk-laser" />
                  </div>
                )}

                {paused && (
                  <div className="chk-overlay chk-overlay-paused">
                    <FaCheckCircle className="chk-overlay-icon" />
                    <span className="chk-overlay-title">
                      {busy ? progressNote : (result ? resultTitle : (t.chkReady || ""))}
                    </span>
                    <button type="button" className="chk-btn primary sm" onClick={resumeScanning}>
                      <FaRedo /> {t.chkScanAgain || "Quét tiếp"}
                    </button>
                  </div>
                )}

                {scanning && (
                  <span className="chk-live">
                    <i /> {t.chkScanningNow || "Đang quét"}
                  </span>
                )}
              </div>

              {cameras.length > 1 && (
                <select
                  className="chk-select"
                  value={selectedCameraId}
                  onChange={(e) => switchCamera(e.target.value)}
                  disabled={starting}
                  aria-label={t.chkStartCam}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || (t.chkCameraLabel || "Camera {id}...").replace("{id}", String(idx + 1))}
                      {isVirtualCamera(cam) ? ` — ${t.chkVirtualCameraTag || "camera ảo"}` : ""}
                    </option>
                  ))}
                </select>
              )}

              <div className="chk-actions">
                <button
                  type="button"
                  className={`chk-btn ${scanning || paused ? "danger" : "primary"}`}
                  onClick={scanning || paused ? stopScanner : startScanner}
                  disabled={starting}
                >
                  {starting ? <FaSync className="chk-spin" /> : (scanning || paused ? <FaVideoSlash /> : <FaCamera />)}
                  {scanning || paused ? t.chkStopCam : t.chkStartCam}
                </button>

                <button
                  type="button"
                  className="chk-btn success"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <FaImage /> {t.chkScanImage}
                </button>

                {torchAvailable && (
                  <button
                    type="button"
                    className={`chk-btn ${torchOn ? "amber-on" : "amber"}`}
                    onClick={toggleTorch}
                  >
                    <FaBolt /> {torchOn ? (t.chkTorchOff || "Tắt đèn") : (t.chkTorchOn || "Bật đèn")}
                  </button>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  hidden
                />
              </div>

              {usingVirtualCamera && (
                <div className="chk-banner warn">
                  <FaExclamationTriangle />
                  <span>{t.chkVirtualCameraWarn}</span>
                </div>
              )}

              {cameraError && (
                <div className="chk-banner bad">
                  <FaExclamationTriangle />
                  <span>
                    {cameraError}
                    <em className="chk-tip">
                      {t.chkCameraTip}
                      {isStandalonePwa() ? ` ${t.chkCameraPwaError}` : ""}
                    </em>
                    {cameraErrorDetail && <em className="chk-tip chk-tip-code">{cameraErrorDetail}</em>}
                  </span>
                </div>
              )}

              <div className="chk-manual">
                <label className="chk-manual-label" htmlFor="chk-manual-input">
                  <FaKeyboard /> {t.chkTicketPlaceholder}
                </label>
                <div className="chk-manual-row">
                  <input
                    id="chk-manual-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t.chkTicketPlaceholder}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
                  />
                  <button
                    type="button"
                    className="chk-btn primary square"
                    onClick={submitManual}
                    disabled={!manualId.trim() || busy}
                    aria-label={t.chkTicketPlaceholder}
                  >
                    {busy ? <FaSync className="chk-spin" /> : <FaSearch />}
                  </button>
                </div>
                <span className="chk-hint">{t.chkManualHint}</span>
              </div>

              {busy && progressNote && (
                <div className="chk-banner info">
                  <FaSync className="chk-spin" /> <span>{progressNote}</span>
                </div>
              )}
            </section>

            {/* ---------------- cột phải: kết quả + lịch sử ---------------- */}
            <div className="chk-column">
              {result && (
                <section className={`chk-card chk-result ${resultTone}`}>
                  <div className="chk-result-head">
                    <span className="chk-result-icon">
                      {result.kind === "success" ? <FaCheckCircle />
                        : result.kind === "already" ? <FaInfoCircle />
                          : <FaExclamationTriangle />}
                    </span>
                    <div>
                      <h2>{resultTitle}</h2>
                      {result.bookingId && <p>{t.ticketCode}: #{result.bookingId}</p>}
                    </div>
                    <button
                      type="button"
                      className="chk-icon-btn"
                      onClick={() => setResult(null)}
                      aria-label={t.qrCloseBtn}
                    >
                      <FaTimes />
                    </button>
                  </div>

                  {result.message && <p className="chk-result-msg">{result.message}</p>}
                  {result.booking && <TicketInfo booking={result.booking} t={t} />}
                </section>
              )}

              <section className="chk-card chk-history">
                <div className="chk-card-head">
                  <h2><FaHistory /> {t.chkScanHistory}</h2>
                  <button
                    type="button"
                    className="chk-icon-btn"
                    onClick={fetchRecentCheckIns}
                    disabled={historyLoading}
                    aria-label={t.chkRefresh}
                    title={t.chkRefresh}
                  >
                    <FaSync className={historyLoading ? "chk-spin" : ""} />
                  </button>
                </div>

                {historyError && (
                  <div className="chk-banner bad">
                    <FaExclamationTriangle />
                    <span>{historyError}</span>
                    <button type="button" className="chk-link" onClick={fetchRecentCheckIns}>
                      {t.chkRetryBtn}
                    </button>
                  </div>
                )}

                <div className="chk-history-list">
                  {historyLoading && history.length === 0 ? (
                    <>
                      <div className="chk-skeleton" />
                      <div className="chk-skeleton" />
                      <div className="chk-skeleton" />
                    </>
                  ) : history.length === 0 ? (
                    <div className="chk-empty">
                      <FaTicketAlt />
                      <span>{t.chkNoScans}</span>
                    </div>
                  ) : (
                    history.map((item, index) => (
                      <button
                        type="button"
                        key={item.id ?? index}
                        className={`chk-row ${index === 0 ? "is-latest" : ""}`}
                        onClick={() => setSelectedTicket(item)}
                      >
                        <span className="chk-row-main">
                          <span className="chk-row-id">{t.ticketCode}: #{item.id}</span>
                          <span className="chk-row-route">
                            {item.origin || "—"} <FaArrowRight /> {item.destination || "—"}
                          </span>
                        </span>
                        <span className="chk-row-side">
                          <span className="chk-badge ok"><FaCheckCircle /> OK</span>
                          <span className="chk-row-time" title={formatDateTime(item.checkInDate)}>
                            {relativeTime(item.checkInDate, t)}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {history.length > 0 && <p className="chk-hint">{t.chkHistoryHint}</p>}
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* ---------------- modal chi tiết vé ---------------- */}
      {selectedTicket && (
        <div
          className="chk-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="chk-modal"
            role="dialog"
            aria-modal="true"
            aria-label={(t.chkTicketDetail || "Chi tiết vé #{id}").replace("{id}", selectedTicket.id)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chk-modal-head">
              <h2>{(t.chkTicketDetail || "Chi tiết vé #{id}").replace("{id}", selectedTicket.id)}</h2>
              <span className="chk-badge ok"><FaCheckCircle /> {t.chkVerified}</span>
              <button
                type="button"
                className="chk-icon-btn"
                onClick={() => setSelectedTicket(null)}
                aria-label={t.qrCloseBtn}
              >
                <FaTimes />
              </button>
            </div>

            <TicketInfo booking={selectedTicket} t={t} />

            <button
              type="button"
              className="chk-btn primary wide"
              onClick={() => setSelectedTicket(null)}
            >
              {t.qrCloseBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* Giao diện gom vào một chỗ thay vì rải style inline khắp JSX như bản cũ;
   toàn bộ màu lấy từ biến theme nên tự khớp cả sáng lẫn tối. */
const CHECKIN_STYLES = `
.chk-page { display: flex; min-height: 100vh; background: var(--bg-main); }
.chk-shell { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.chk-main { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto;
  padding: 96px clamp(14px, 3vw, 28px) 48px; display: flex; flex-direction: column; gap: 18px; }

.chk-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: 22px; padding: 18px 22px; box-shadow: var(--shadow-card); }
.chk-head-icon { width: 52px; height: 52px; flex: none; border-radius: 16px; display: grid; place-items: center;
  font-size: 22px; color: #fff; background: linear-gradient(135deg, var(--primary), #7c3aed); }
.chk-head-text { flex: 1; min-width: 200px; }
.chk-head-text h1 { margin: 0; font-size: clamp(18px, 2.4vw, 23px); font-weight: 800; color: var(--text-heading); }
.chk-head-text p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary); }
.chk-head-stats { display: flex; gap: 10px; }
.chk-stat { min-width: 78px; text-align: center; padding: 8px 12px; border-radius: 14px;
  background: var(--bg-input); border: 1px solid var(--border-light); }
.chk-stat b { display: block; font-size: 20px; font-weight: 800; color: var(--primary); line-height: 1.1; }
.chk-stat span { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); }

.chk-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 900px) { .chk-grid { grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr); } }
.chk-column { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

.chk-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 22px;
  padding: 18px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.chk-card-head { display: flex; align-items: center; gap: 10px; }
.chk-card-head h2 { flex: 1; margin: 0; font-size: 16px; font-weight: 800; color: var(--text-heading);
  display: flex; align-items: center; gap: 9px; }
.chk-card-head h2 svg { color: var(--primary); }

/* ----- khung camera -----
   Cố ý KHÔNG ép kích thước thẻ <video>: html5-qrcode tính vùng quét bằng tỉ lệ
   videoWidth/clientWidth theo từng trục, nên mọi can thiệp kiểu object-fit: cover
   sẽ làm vùng quét lệch khỏi phần hình mà nhân viên nhìn thấy. */
.chk-viewport { position: relative; width: 100%; min-height: 280px; display: flex; align-items: center;
  justify-content: center; border-radius: 18px; overflow: hidden; background: #0b0d12;
  border: 1px solid var(--border-input); }
.chk-reader { width: 100%; min-height: 280px; }
.chk-reader video { display: block; margin: 0 auto; max-width: 100%; }
.chk-reader img, .chk-reader canvas { max-width: 100%; }
.chk-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; text-align: center; padding: 20px; background: #0b0d12; color: #8b95a5; }
.chk-overlay-paused { background: rgba(11, 13, 18, .86); color: #e6edf3; }
.chk-overlay-icon { font-size: 38px; opacity: .45; }
.chk-overlay-paused .chk-overlay-icon { opacity: 1; color: #4ade80; }
.chk-overlay-title { font-size: 14px; font-weight: 600; }
.chk-overlay-sub { font-size: 11.5px; opacity: .65; }

.chk-frame { position: absolute; inset: 15%; pointer-events: none; }
.chk-frame .c { position: absolute; width: 26px; height: 26px; border: 3px solid #22d3ee; border-radius: 3px; }
.chk-frame .tl { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 10px; }
.chk-frame .tr { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 10px; }
.chk-frame .bl { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 10px; }
.chk-frame .br { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 10px; }
.chk-laser { position: absolute; left: 6%; right: 6%; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, #22d3ee, transparent);
  box-shadow: 0 0 12px #22d3ee; animation: chkLaser 2.1s ease-in-out infinite; }
@keyframes chkLaser { 0%, 100% { top: 4%; } 50% { top: 94%; } }

.chk-live { position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: #fff;
  background: rgba(0, 0, 0, .55); backdrop-filter: blur(6px); }
.chk-live i { width: 7px; height: 7px; border-radius: 50%; background: #22d3ee; animation: chkPulse 1.2s infinite; }
@keyframes chkPulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

/* ----- điều khiển ----- */
.chk-select { width: 100%; padding: 11px 12px; border-radius: 12px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-main); }
.chk-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.chk-btn { flex: 1 1 140px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 14px; border: 1px solid transparent; border-radius: 13px; font-size: 13.5px; font-weight: 700;
  cursor: pointer; transition: transform .12s ease, filter .12s ease; }
.chk-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.chk-btn:disabled { opacity: .55; cursor: not-allowed; }
.chk-btn.primary { background: var(--primary); color: #fff; }
.chk-btn.danger { background: rgba(239, 68, 68, .14); color: #ef4444; border-color: rgba(239, 68, 68, .32); }
.chk-btn.success { background: rgba(22, 163, 74, .13); color: #16a34a; border-color: rgba(22, 163, 74, .3); }
.chk-btn.amber { background: rgba(245, 158, 11, .13); color: #d97706; border-color: rgba(245, 158, 11, .32); }
.chk-btn.amber-on { background: #f59e0b; color: #1a1a2e; border-color: #f59e0b; }
.chk-btn.square { flex: 0 0 52px; padding: 12px 0; }
.chk-btn.wide { flex: 1 1 100%; }
.chk-btn.sm { flex: 0 0 auto; padding: 9px 16px; font-size: 12.5px; }
.chk-icon-btn { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px;
  border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-secondary); cursor: pointer; }
.chk-icon-btn:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); }
.chk-icon-btn:disabled { opacity: .5; cursor: not-allowed; }
.chk-link { border: none; background: none; padding: 0; font: inherit; font-weight: 700;
  color: inherit; text-decoration: underline; cursor: pointer; }

/* ----- nhập tay ----- */
.chk-manual { display: flex; flex-direction: column; gap: 7px; padding-top: 2px;
  border-top: 1px dashed var(--border-input); }
.chk-manual-label { display: flex; align-items: center; gap: 7px; margin-top: 12px;
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--text-muted); }
.chk-manual-row { display: flex; gap: 9px; }
.chk-manual-row input { flex: 1; min-width: 0; padding: 12px 14px; border-radius: 13px; font-size: 14px;
  border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-main); }
.chk-manual-row input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
.chk-hint { font-size: 11.5px; color: var(--text-muted); }

/* ----- băng thông báo ----- */
.chk-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px;
  font-size: 13px; font-weight: 600; line-height: 1.5; border: 1px solid transparent; }
.chk-banner svg { flex: none; margin-top: 2px; font-size: 15px; }
.chk-banner.ok { background: rgba(22, 163, 74, .12); color: #16a34a; border-color: rgba(22, 163, 74, .28); }
.chk-banner.warn { background: rgba(245, 158, 11, .13); color: #b45309; border-color: rgba(245, 158, 11, .3); }
.chk-banner.bad { background: rgba(239, 68, 68, .12); color: #dc2626; border-color: rgba(239, 68, 68, .28); }
.chk-banner.info { background: var(--bg-input); color: var(--text-secondary); border-color: var(--border-input); }
body.dark .chk-banner.warn { color: #fbbf24; }
body.dark .chk-banner.bad { color: #f87171; }
body.dark .chk-banner.ok { color: #4ade80; }
.chk-tip { display: block; margin-top: 5px; font-size: 11.5px; font-weight: 500; font-style: normal; opacity: .85; }
.chk-tip-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px;
  opacity: .6; word-break: break-word; }

/* ----- khung kết quả ----- */
.chk-result { border-width: 2px; }
.chk-result.ok { border-color: rgba(22, 163, 74, .45); }
.chk-result.warn { border-color: rgba(245, 158, 11, .5); }
.chk-result.bad { border-color: rgba(239, 68, 68, .45); }
.chk-result-head { display: flex; align-items: center; gap: 12px; }
.chk-result-head h2 { margin: 0; font-size: 16px; font-weight: 800; color: var(--text-heading); }
.chk-result-head p { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.chk-result-head > div { flex: 1; min-width: 0; }
.chk-result-icon { width: 42px; height: 42px; flex: none; border-radius: 13px; display: grid; place-items: center; font-size: 19px; }
.chk-result.ok .chk-result-icon { background: rgba(22, 163, 74, .14); color: #16a34a; }
.chk-result.warn .chk-result-icon { background: rgba(245, 158, 11, .16); color: #d97706; }
.chk-result.bad .chk-result-icon { background: rgba(239, 68, 68, .14); color: #dc2626; }
/* Nền tối làm mấy tông cam/đỏ/xanh đậm bị chìm — nâng sáng lên cho dễ đọc. */
body.dark .chk-result.ok .chk-result-icon { color: #4ade80; }
body.dark .chk-result.warn .chk-result-icon { color: #fbbf24; }
body.dark .chk-result.bad .chk-result-icon { color: #f87171; }
body.dark .chk-btn.success { color: #4ade80; }
body.dark .chk-btn.amber { color: #fbbf24; }
body.dark .chk-btn.danger { color: #f87171; }
body.dark .chk-checked-at svg { color: #4ade80; }
body.dark .chk-overlay-paused .chk-overlay-icon { color: #4ade80; }
.chk-result-msg { margin: 0; padding: 10px 13px; border-radius: 12px; font-size: 13px; font-weight: 600;
  background: var(--bg-input); color: var(--text-secondary); word-break: break-word; }

/* ----- thẻ thông tin vé ----- */
.chk-ticket { display: flex; flex-direction: column; gap: 13px; }
.chk-ticket-route { display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
  font-size: 16px; font-weight: 800; color: var(--text-heading); }
.chk-ticket-arrow { font-size: 13px; color: var(--primary); }
.chk-ticket-grid { display: grid; gap: 11px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.chk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.chk-field-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .03em; color: var(--text-muted); }
.chk-field-label svg { font-size: 11px; }
.chk-field-value { font-size: 13.5px; font-weight: 700; color: var(--text-main); word-break: break-word; }
.chk-count { margin-left: auto; font-style: normal; text-transform: none; letter-spacing: 0; color: var(--primary); }
.chk-passengers { display: flex; flex-direction: column; gap: 6px; }
.chk-passenger { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 13px; border-radius: 11px; background: var(--bg-input); border: 1px solid var(--border-light); }
.chk-passenger-name { font-size: 13.5px; font-weight: 600; color: var(--text-main); }
.chk-seat { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; color: var(--primary); }
.chk-empty-inline { font-size: 12.5px; font-style: italic; color: var(--text-muted); }
.chk-checked-at { display: flex; align-items: center; gap: 8px; padding-top: 11px; font-size: 12.5px;
  color: var(--text-secondary); border-top: 1px dashed var(--border-input); }
.chk-checked-at svg { color: #16a34a; }

/* ----- lịch sử ----- */
.chk-history-list { display: flex; flex-direction: column; gap: 8px; max-height: 430px; overflow-y: auto; padding-right: 2px; }
.chk-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
  padding: 11px 14px; border-radius: 14px; text-align: left; cursor: pointer;
  background: transparent; border: 1px solid var(--border-input); transition: background .15s ease, border-color .15s ease; }
.chk-row:hover { background: var(--bg-hover); border-color: var(--primary); }
.chk-row.is-latest { background: var(--bg-input); border-color: rgba(22, 163, 74, .4); }
.chk-row-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.chk-row-id { font-size: 13.5px; font-weight: 800; color: var(--text-main); }
.chk-row-route { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-muted); }
.chk-row-route svg { font-size: 9px; }
.chk-row-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.chk-row-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.chk-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 800; }
.chk-badge.ok { background: rgba(22, 163, 74, .14); color: #16a34a; }
body.dark .chk-badge.ok { color: #4ade80; }
.chk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 44px 20px; border-radius: 16px; border: 2px dashed var(--border-input); color: var(--text-muted); font-size: 13px; }
.chk-empty svg { font-size: 26px; opacity: .5; }
.chk-skeleton { height: 58px; border-radius: 14px; background: var(--bg-input); animation: chkShimmer 1.3s ease-in-out infinite; }
@keyframes chkShimmer { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }

/* ----- modal ----- */
.chk-modal-backdrop { position: fixed; inset: 0; z-index: 1400; display: flex; align-items: center;
  justify-content: center; padding: 18px; background: rgba(0, 0, 0, .58); backdrop-filter: blur(3px); }
.chk-modal { width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
  padding: 22px; border-radius: 22px; background: var(--bg-modal); border: 1px solid var(--border-main);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .35); }
.chk-modal-head { display: flex; align-items: center; gap: 10px; padding-bottom: 13px; border-bottom: 1px solid var(--border-light); }
.chk-modal-head h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 800; color: var(--text-heading); }

.chk-spin { animation: chkSpin 1s linear infinite; }
@keyframes chkSpin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .chk-spin, .chk-laser, .chk-live i, .chk-skeleton { animation: none; }
  .chk-btn:hover:not(:disabled) { transform: none; }
}
`;

export default ProviderCheckIn;
