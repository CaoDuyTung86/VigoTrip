import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../context/LanguageContext";

/**
 * Ô chọn ngày có lịch bật ra, thay cho <input type="date">.
 *
 * Vì sao bỏ input date của trình duyệt: nó chỉ hiện "dd/mm/yyyy" cùng một icon lịch bé xíu
 * nằm sát mép phải — mà icon đó ở đây còn bị index.css tô invert nên gần như tàng hình trên
 * nền sáng. Người dùng nhìn vào tưởng phải gõ tay. Thêm nữa mỗi trình duyệt vẽ một kiểu,
 * không theo được biến màu / dark mode của trang.
 *
 * Lịch được portal thẳng ra <body> chứ không đặt absolute trong ô: thẻ tìm kiếm nằm trong
 * .page-main có animation transform, mà một ancestor có transform sẽ trở thành containing
 * block cho position:fixed và cũng có thể cắt mất phần lịch tràn ra ngoài. Ra body rồi thì
 * chỉ cần toạ độ từ getBoundingClientRect là đặt đúng chỗ trong mọi trường hợp.
 */

const LOCALE_MAP = { vi: "vi-VN", en: "en-GB", ja: "ja-JP", zh: "zh-TW" };

const PANEL_WIDTH = 312;
const PANEL_HEIGHT = 392; // ước lượng, chỉ dùng để quyết định lật lên trên hay xuống dưới

const pad2 = (n) => String(n).padStart(2, "0");

/** Date -> "YYYY-MM-DD" theo giờ địa phương (toISOString sẽ lệch 1 ngày ở múi giờ +7). */
const toISODate = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** "YYYY-MM-DD" -> Date lúc 00:00 địa phương; chuỗi rỗng hoặc sai định dạng trả về null. */
const fromISODate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const firstOfMonth = (date, offset = 0) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const sameDay = (a, b) => Boolean(a && b) && toISODate(a) === toISODate(b);

/** Lưới 6 tuần x 7 ngày, tuần bắt đầu từ Thứ Hai. */
const buildGrid = (viewDate) => {
  const first = firstOfMonth(viewDate);
  const offset = (first.getDay() + 6) % 7; // Chủ nhật (getDay 0) đẩy về cuối tuần
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

const DatePicker = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  ariaLabel,
  icon = null,
}) => {
  const { t, currentLanguage } = useLanguage();
  const locale = LOCALE_MAP[currentLanguage?.code] || LOCALE_MAP.vi;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => fromISODate(value), [value]);
  const minDate = useMemo(() => fromISODate(min), [min]);
  const maxDate = useMemo(() => fromISODate(max), [max]);

  const [viewDate, setViewDate] = useState(() => selected || minDate || today);

  const isBlocked = useCallback(
    (day) => Boolean((minDate && day < minDate) || (maxDate && day > maxDate)),
    [minDate, maxDate],
  );

  const place = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const flip = below + PANEL_HEIGHT > window.innerHeight - 8 && rect.top > PANEL_HEIGHT + 16;
    setPos({ top: flip ? rect.top - PANEL_HEIGHT - 8 : below, left, width });
  }, []);

  // Mở: chốt vị trí và tháng hiển thị ngay tại thao tác của người dùng. Làm trong effect
  // thì lịch sẽ vẽ một khung hình ở toạ độ cũ rồi mới nhảy sang chỗ đúng.
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setViewDate(selected || minDate || today);
    place();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // true: bắt cả khi cuộn trong khung con
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      anchorRef.current?.focus();
    };
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 là Thứ Hai — mốc để lấy đúng thứ tự nhãn theo từng ngôn ngữ.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewDate),
    [locale, viewDate],
  );

  const displayValue = useMemo(() => {
    if (!selected) return "";
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(selected);
  }, [locale, selected]);

  const pick = (day) => {
    if (isBlocked(day)) return;
    onChange?.(toISODate(day));
    setOpen(false);
    anchorRef.current?.focus();
  };

  const grid = useMemo(() => buildGrid(viewDate), [viewDate]);
  const prevDisabled = Boolean(minDate) && firstOfMonth(viewDate, -1) < firstOfMonth(minDate);
  const nextDisabled = Boolean(maxDate) && firstOfMonth(viewDate, 1) > firstOfMonth(maxDate);

  const shortcuts = [
    { label: t.dpToday, date: today },
    { label: t.dpTomorrow, date: addDays(today, 1) },
  ].filter((s) => !isBlocked(s.date));

  const navBtnStyle = (isDisabled) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--border-main)",
    background: "var(--bg-card)",
    color: isDisabled ? "var(--text-muted)" : "var(--text-main)",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    fontSize: 16,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder || t.pickDate}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          width: "100%",
          textAlign: "left",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: selected ? 600 : 400,
          color: selected ? "var(--text-main)" : "var(--text-muted)",
          cursor: disabled ? "not-allowed" : "pointer",
          // Icon nằm TRONG nút chứ không đứng cạnh: bấm trúng cái icon lịch mà không mở
          // được lịch là chỗ hụt tay khó chịu nhất của ô ngày cũ.
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {icon}
        <span>{displayValue || placeholder || t.pickDate}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel || t.pickDate}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 4000,
            background: "var(--bg-card)",
            border: "1px solid var(--border-main)",
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
            padding: 14,
            animation: "modalCardIn 0.16s ease-out",
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <button
              type="button"
              onClick={() => !prevDisabled && setViewDate(firstOfMonth(viewDate, -1))}
              disabled={prevDisabled}
              aria-label={t.dpPrevMonth}
              style={navBtnStyle(prevDisabled)}
            >
              ‹
            </button>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-main)",
              textTransform: "capitalize",
            }}>
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => !nextDisabled && setViewDate(firstOfMonth(viewDate, 1))}
              disabled={nextDisabled}
              aria-label={t.dpNextMonth}
              style={navBtnStyle(nextDisabled)}
            >
              ›
            </button>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
            marginBottom: 4,
          }}>
            {weekdays.map((w) => (
              <div key={w} style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                padding: "4px 0",
              }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {grid.map((day) => {
              const outside = day.getMonth() !== viewDate.getMonth();
              const blocked = isBlocked(day);
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={toISODate(day)}
                  type="button"
                  onClick={() => pick(day)}
                  disabled={blocked}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: isToday && !isSelected
                      ? "1px solid var(--primary)"
                      : "1px solid transparent",
                    background: isSelected ? "var(--primary)" : "transparent",
                    color: isSelected ? "#fff" : blocked || outside ? "var(--text-muted)" : "var(--text-main)",
                    opacity: blocked ? 0.35 : outside ? 0.55 : 1,
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? 700 : 500,
                    fontFamily: "inherit",
                    cursor: blocked ? "not-allowed" : "pointer",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!blocked && !isSelected) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {shortcuts.length > 0 && (
            <div style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border-light)",
            }}>
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => pick(s.date)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border-main)",
                    background: "var(--bg-input)",
                    color: "var(--primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};

export default DatePicker;
