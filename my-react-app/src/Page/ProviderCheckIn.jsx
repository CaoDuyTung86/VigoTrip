import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import axios from "axios";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
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
 * và định dạng QR do MyBookings sinh ra ({"bookingId":..,"type":..,"user":..,"code":..})
 * cũng không đổi. Toàn bộ thay đổi ở đây nằm ở phía trình duyệt: cách xin quyền camera,
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
 * Rút mã đặt chỗ ra khỏi nội dung QR.
 * Chấp nhận: JSON của MyBookings, chuỗi "TICKET-12-...", "#12", hoặc "12".
 * Mọi thứ khác bị coi là không hợp lệ — cố tình chặt chẽ để không lỡ gửi
 * một con số bất kỳ đọc được từ mã QR lạ lên endpoint check-in.
 */
const parseBookingId = (raw) => {
  if (raw === null || raw === undefined) return null;

  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    } else {
      value = trimmed;
    }
  }

  if (Array.isArray(value)) value = value[0];
  if (value && typeof value === "object") {
    value = value.bookingId ?? value.id ?? value.code ?? "";
  }

  const text = String(value ?? "").replace(/[#\s]/g, "");
  if (!text) return null;
  if (/^\d+$/.test(text)) return text;

  const ticketForm = text.match(/^TICKET-(\d+)(?:-.*)?$/i);
  if (ticketForm) return ticketForm[1];

  return null;
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
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraError, setCameraError] = useState("");
  // Nguyên văn lỗi của trình duyệt/thư viện — hiện dưới dạng dòng nhỏ để khi máy nào
  // đó không bật được camera thì còn có cái mà đọc, khỏi phải mở DevTools.
  const [cameraErrorDetail, setCameraErrorDetail] = useState("");
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
    const resumeTimer = resumeTimerRef;
    const wakingTimer = wakingTimerRef;
    return () => {
      aliveRef.current = false;
      clearTimeout(resumeTimer.current);
      clearTimeout(wakingTimer.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scanner.stop().catch(() => {});
          }
        } catch {
          /* thư viện có thể ném chuỗi thay vì Error — nuốt để không chặn unmount */
        }
      }
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
    const scanner = scannerRef.current;
    setTorchOn(false);
    setTorchAvailable(false);
    if (!scanner) {
      setCamState("idle");
      return;
    }
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch (err) {
      console.error("[CheckIn] Lỗi khi dừng camera:", err);
    } finally {
      setCamState("idle");
    }
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

  const pickCameraId = useCallback((list, preferred) => {
    if (!list.length) return "";
    if (preferred && list.some((c) => c.id === preferred)) return preferred;
    const back = list.find((c) => /back|rear|sau|environment|後|后置/i.test(c.label || ""));
    return back ? back.id : list[list.length - 1].id;
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
  const buildCameraAttempts = useCallback((preferredIds, allIds) => {
    const seen = new Set();
    const attempts = [];
    for (const id of [...preferredIds, ...allIds]) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      attempts.push(id);
    }
    attempts.push({ facingMode: "environment" });
    attempts.push({ facingMode: "user" });
    return attempts;
  }, []);

  const startScanner = useCallback(async () => {
    if (camState === "starting" || camState === "scanning") return;

    setCameraError("");
    setCameraErrorDetail("");
    setCamState("starting");

    try {
      if (!window.isSecureContext && !isLocalhost()) throw new Error("INSECURE");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNSUPPORTED");

      // (1) Xin quyền NGAY trong cử chỉ bấm nút. Bản cũ gọi Html5Qrcode.getCameras()
      // lúc trang vừa load — mà hàm đó bên trong gọi getUserMedia({video:true}); yêu cầu
      // quyền không đi kèm cử chỉ người dùng bị Safari từ chối thẳng và bị Chrome
      // tự đóng hộp thoại, nên về sau bấm nút cũng không bật được camera nữa.
      let probe;
      try {
        probe = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (err?.name === "OverconstrainedError" || err?.name === "NotFoundError") {
          probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw err;
        }
      }

      // deviceId của camera VỪA mở được — nguồn duy nhất chắc chắn dùng được. Bản cũ
      // vứt thông tin này đi rồi đoán lại bằng nhãn thiết bị, mà khi không nhãn nào
      // khớp "back/rear" thì nó lấy đại thiết bị CUỐI danh sách: trên máy bàn/laptop
      // đó thường là camera hồng ngoại Windows Hello hoặc webcam ảo (OBS, iVCam) —
      // mở ra là OverconstrainedError/NotReadableError.
      const workingId = probe.getVideoTracks()[0]?.getSettings?.()?.deviceId || "";
      probe.getTracks().forEach((track) => track.stop());
      // Webcam trên Windows cần một nhịp để nhả thiết bị; mở lại ngay lập tức rất hay
      // dính NotReadableError "Could not start video source".
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!aliveRef.current) return;

      // (2) Quyền đã có nên enumerateDevices mới trả về nhãn camera thật.
      const list = await listCameras();
      if (aliveRef.current) setCameras(list);
      const targetId = pickCameraId(list, selectedCameraId);
      if (targetId && targetId !== selectedCameraId && aliveRef.current) {
        setSelectedCameraId(targetId);
      }

      const scanner = ensureScanner();
      clearReaderSurface();

      // (3) Thử lần lượt cho tới khi có khung hình: camera nhân viên tự chọn ->
      // camera vừa mở được ở bước probe -> camera đoán là mặt sau -> mọi camera còn
      // lại -> cuối cùng mới tới facingMode.
      const attempts = buildCameraAttempts(
        [selectedCameraId, workingId, targetId],
        list.map((c) => c.id),
      );

      let started = false;
      const errors = [];
      for (const source of attempts) {
        try {
          await scanner.start(source, SCAN_CONFIG, stableOnScan, undefined);
          started = true;
          break;
        } catch (err) {
          errors.push(err);
          console.warn("[CheckIn] Không mở được camera với nguồn", source, err);
          try {
            if (scanner.getState() !== Html5QrcodeScannerState.NOT_STARTED) await scanner.stop();
          } catch {
            /* bỏ qua */
          }
        }
        if (!aliveRef.current) return;
      }
      if (!started) throw pickCameraError(errors);

      if (!aliveRef.current) {
        await scanner.stop().catch(() => {});
        return;
      }
      setCamState("scanning");
      detectTorch();
    } catch (err) {
      console.error("[CheckIn] Bật camera thất bại:", err);
      if (!aliveRef.current) return;
      setCamState("idle");
      setCameraError(describeCameraError(err, t));
      const detail = errorText(err);
      setCameraErrorDetail(/\b(INSECURE|UNSUPPORTED)\b/.test(detail) ? "" : detail.slice(0, 200));
    }
  }, [camState, selectedCameraId, listCameras, pickCameraId, buildCameraAttempts, ensureScanner, clearReaderSurface, detectTorch, stableOnScan, t]);

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
  const cameraActive = scanning || paused || starting;

  return (
    <div className="chk-page">
      <style>{CHECKIN_STYLES}</style>
      <Sidebar />

      <div className="chk-shell">
        <Header />

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
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  disabled={cameraActive}
                  aria-label={t.chkStartCam}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || (t.chkCameraLabel || "Camera {id}...").replace("{id}", String(idx + 1))}
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
