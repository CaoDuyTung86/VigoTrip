import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { buildAnnouncementText, fetchAnnouncements } from "../utils/announcements";

/**
 * Dải tin chạy ngang kiểu bảng điện tử nhà ga, nằm ngay dưới Header.
 *
 * PHẠM VI — chỉ tin KHÔNG khẩn cấp dùng chung cả site (voucher đang hiệu lực; nhịp hai thêm
 * tuyến mới mở bán, lịch bảo trì). Ba thứ cố ý KHÔNG đi vào đây:
 *   - Giữ ghế sắp hết hạn → HoldCountdownBanner, vì nó gắn với một thao tác đang dở và
 *     người dùng phải thấy ngay tại chỗ mình đang làm.
 *   - Phản hồi sau thao tác ("đã lưu voucher") → ToastContext.
 *   - Bất cứ thứ gì bỏ lỡ thì mất tiền hoặc mất chuyến. Chữ chạy là thứ đọc lướt, không
 *     phải kênh báo tin quan trọng.
 *
 * Chữ chạy chỉ là MỒI: mỗi mẩu tin là một liên kết mở trang đầy đủ để đọc lại. Không ai
 * đọc trọn một câu đang trôi ngang, và người dùng bàn phím hay trình đọc màn hình lại càng
 * không.
 */

/** Tốc độ chạy (px/giây). Chậm hơn thì đọc kịp nhưng vòng lặp dài, nhanh hơn thì chóng mặt. */
const SPEED_PX_PER_SEC = 55;

/** Vòng ngắn quá thì chữ giật liên tục ở mép; đây là sàn thời lượng một vòng. */
const MIN_DURATION_SEC = 24;

/** Khoảng cách tối thiểu giữa hai lần gọi lại khi cửa sổ được focus. */
const REFRESH_COOLDOWN_MS = 60000;

/**
 * Tin đã tắt được nhớ theo NỘI DUNG chứ không phải theo thời điểm: khóa lưu là danh sách id
 * đang hiển thị. Có tin mới là chữ ký đổi, dải tin hiện lại. Nếu nhớ theo kiểu "đã tắt hôm
 * nay" thì một thông báo bảo trì đăng lúc 10h sẽ không bao giờ tới được người đã tắt lúc 9h.
 */
const DISMISS_KEY = "vigotrip.ticker.dismissed";

/** Đọc/ghi localStorage không được phép làm vỡ dải tin (chế độ riêng tư chặn quyền ghi). */
const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) || "";
  } catch {
    return "";
  }
};

const writeDismissed = (signature) => {
  try {
    window.localStorage.setItem(DISMISS_KEY, signature);
  } catch {
    /* không lưu được thì chỉ mất việc nhớ đã tắt, không ảnh hưởng gì khác */
  }
};

export default function AnnouncementTicker() {
  const { t, currentLanguage } = useLanguage();
  const langCode = currentLanguage?.code || "vi";

  const [items, setItems] = useState([]);
  const [dismissedSignature, setDismissedSignature] = useState(readDismissed);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [duration, setDuration] = useState(MIN_DURATION_SEC);

  const lastFetchRef = useRef(0);
  const groupRef = useRef(null);

  const load = useCallback(async () => {
    lastFetchRef.current = Date.now();
    setItems(await fetchAnnouncements());
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Bọc trong hàm async thay vì gọi thẳng load(): cờ cancelled chặn việc đặt state sau khi
    // component đã bị gỡ (đổi trang ngay lúc request còn bay).
    const run = async () => {
      const data = await fetchAnnouncements();
      lastFetchRef.current = Date.now();
      if (!cancelled) setItems(data);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Gọi lại khi người dùng quay lại tab. Đây là chỗ thay cho WebSocket: tin đổi vài lần mỗi
  // tuần nên không đáng để mọi khách vãng lai giữ một kết nối thường trực.
  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current < REFRESH_COOLDOWN_MS) return;
      load();
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [load]);

  // prefers-reduced-motion: người bật cài đặt này có thể bị chóng mặt/buồn nôn vì chuyển
  // động ngang. Với họ dải tin thành danh sách tĩnh cuộn được, không phải chữ trôi.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => buildAnnouncementText(item, t, langCode).trim().length > 0),
    [items, t, langCode]
  );

  const signature = useMemo(() => visibleItems.map((item) => item.id).join("|"), [visibleItems]);
  const hidden = visibleItems.length === 0 || signature === dismissedSignature;

  // Chiều cao dải tin được công bố ra :root để mọi chỗ chừa chỗ cho header (--header-offset)
  // tự giãn theo. Không có bước này thì dải tin đè lên dòng đầu của mỗi trang.
  useEffect(() => {
    const root = document.documentElement;
    if (hidden) {
      root.style.removeProperty("--ticker-height");
      return undefined;
    }
    root.style.setProperty("--ticker-height", "var(--ticker-height-base)");
    return () => root.style.removeProperty("--ticker-height");
  }, [hidden]);

  // Thời lượng một vòng tính theo bề rộng nội dung thật: ít tin thì chạy nhanh hết vòng,
  // nhiều tin thì chạy lâu hơn, nhưng tốc độ đọc luôn như nhau.
  useLayoutEffect(() => {
    if (hidden || reducedMotion || !groupRef.current) return undefined;
    const measure = () => {
      const width = groupRef.current?.scrollWidth || 0;
      setDuration(Math.max(MIN_DURATION_SEC, Math.round(width / SPEED_PX_PER_SEC)));
    };
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(groupRef.current);
    return () => observer.disconnect();
  }, [hidden, reducedMotion, signature, langCode]);

  const handleDismiss = () => {
    setDismissedSignature(signature);
    writeDismissed(signature);
  };

  if (hidden) return null;

  const renderItem = (item, { duplicate = false } = {}) => (
    <Link
      key={`${duplicate ? "dup-" : ""}${item.id}`}
      to={item.link || "/uu-dai"}
      className="ann-item"
      tabIndex={duplicate ? -1 : undefined}
    >
      {buildAnnouncementText(item, t, langCode)}
    </Link>
  );

  return (
    <div className="ann-ticker" role="region" aria-label={t.annLabel}>
      <span className="ann-badge" aria-hidden="true">
        <Megaphone size={15} />
      </span>

      {reducedMotion ? (
        <div className="ann-static">{visibleItems.map((item) => renderItem(item))}</div>
      ) : (
        <div className="ann-viewport">
          <div className="ann-track" style={{ animationDuration: `${duration}s` }}>
            <div className="ann-group" ref={groupRef}>
              {visibleItems.map((item) => renderItem(item))}
            </div>
            {/* Bản sao chỉ để vòng lặp không hở khoảng trắng ở mép phải. Ẩn khỏi trình đọc
                màn hình và khỏi thứ tự Tab, nếu không mỗi tin sẽ đọc/dừng hai lần. */}
            <div className="ann-group" aria-hidden="true">
              {visibleItems.map((item) => renderItem(item, { duplicate: true }))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="ann-close"
        onClick={handleDismiss}
        title={t.annDismiss}
        aria-label={t.annDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}
