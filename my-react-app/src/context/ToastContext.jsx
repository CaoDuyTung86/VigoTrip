/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext();

const DEFAULT_DURATION = 4000;
/** Nhiều hơn ngần này thì thẻ cũ nhất bị đẩy ra — chồng một cột dài kín màn hình còn khó đọc hơn. */
const MAX_VISIBLE = 4;
/** Phải khớp thời lượng của @keyframes toastOut bên dưới. */
const EXIT_MS = 220;

/**
 * Màu nhấn theo loại thông báo.
 *
 * Cố tình KHÔNG dùng --danger/--success của theme: hai biến đó đổi hẳn độ sáng giữa nền
 * sáng và nền tối, trong khi ở đây màu nhấn luôn nằm trên nền thẻ (--bg-card) nên cần một
 * sắc độ trung tính đủ tương phản ở cả hai. Nền tint dùng rgba để tự hoà vào màu thẻ.
 */
const TONES = {
  error: { accent: '#ef4444', tint: 'rgba(239, 68, 68, 0.14)', Icon: XCircle },
  warning: { accent: '#f59e0b', tint: 'rgba(245, 158, 11, 0.14)', Icon: AlertTriangle },
  success: { accent: '#10b981', tint: 'rgba(16, 185, 129, 0.14)', Icon: CheckCircle2 },
  info: { accent: '#3b82f6', tint: 'rgba(59, 130, 246, 0.14)', Icon: Info },
};

let toastSeq = 0;
const nextId = () => `toast-${Date.now()}-${toastSeq++}`;

const ToastItem = ({ toast, onDismiss }) => {
  const { accent, tint, Icon } = TONES[toast.type] || TONES.info;
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(0);

  // Đồng hồ tự đóng nằm trong từng thẻ để rê chuột vào là dừng được — người dùng đang đọc
  // dở một thông báo lỗi thì không nên bị nó biến mất giữa chừng.
  useEffect(() => {
    if (paused || toast.leaving) return undefined;
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [paused, toast.id, toast.leaving, onDismiss]);

  return (
    <div
      className={`vg-toast${toast.leaving ? ' vg-toast--leaving' : ''}`}
      style={{ '--vg-toast-accent': accent, '--vg-toast-tint': tint }}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="vg-toast__icon">
        <Icon size={17} strokeWidth={2.2} />
      </span>

      <p className="vg-toast__message">{toast.message}</p>

      <button
        type="button"
        className="vg-toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
      >
        <X size={15} strokeWidth={2.4} />
      </button>

      <span
        className="vg-toast__progress"
        style={{
          animationDuration: `${toast.duration}ms`,
          animationPlayState: paused || toast.leaving ? 'paused' : 'running',
        }}
      />
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const showToast = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    if (!message) return;
    setToasts((prev) => {
      // Cùng một nội dung bắn lại (người dùng bấm đi bấm lại một nút đang lỗi) thì làm mới
      // thẻ đang hiện thay vì xếp chồng nhiều bản sao. Đổi id -> React remount -> chạy lại
      // hiệu ứng và đếm lại thời gian.
      const duplicate = prev.find((t) => t.message === message && t.type === type && !t.leaving);
      if (duplicate) {
        return prev.map((t) => (t === duplicate ? { ...t, id: nextId(), duration } : t));
      }
      const next = [...prev, { id: nextId(), message, type, duration, leaving: false }];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      <div className="vg-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      <style>{`
        .vg-toast-stack {
          position: fixed;
          top: calc(var(--header-height, 64px) + 16px);
          right: 16px;
          z-index: 10001;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: min(384px, calc(100vw - 32px));
          pointer-events: none;
        }

        .vg-toast {
          pointer-events: auto;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: start;
          column-gap: 12px;
          padding: 14px 14px 16px;
          border-radius: 14px;
          background: var(--bg-card, #ffffff);
          color: var(--text-main, #1a1a2e);
          border: 1px solid var(--border-main, #e5eaf0);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
          animation: toastIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        body.dark .vg-toast {
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04);
        }
        .vg-toast--leaving {
          animation: toastOut ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) both;
        }

        .vg-toast__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: var(--vg-toast-tint);
          color: var(--vg-toast-accent);
          flex-shrink: 0;
        }

        .vg-toast__message {
          margin: 0;
          padding-top: 5px;
          font-size: 13.5px;
          line-height: 1.5;
          font-weight: 500;
          color: var(--text-main, #1a1a2e);
          overflow-wrap: anywhere;
        }

        .vg-toast__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          margin-top: 2px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, #9ca3af);
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
          flex-shrink: 0;
        }
        .vg-toast__close:hover {
          background: var(--bg-hover, rgba(127, 127, 127, 0.12));
          color: var(--text-main, #1a1a2e);
        }

        .vg-toast__progress {
          position: absolute;
          left: 0;
          bottom: 0;
          height: 3px;
          width: 100%;
          transform-origin: left center;
          background: var(--vg-toast-accent);
          opacity: 0.85;
          animation-name: toastProgress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translate3d(115%, 0, 0) scale(0.96); }
          to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          to   { opacity: 0; transform: translate3d(115%, 0, 0) scale(0.96); }
        }
        @keyframes toastProgress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }

        @media (max-width: 520px) {
          .vg-toast-stack {
            left: 12px;
            right: 12px;
            width: auto;
            top: calc(var(--header-height, 64px) + 10px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vg-toast, .vg-toast--leaving { animation-duration: 1ms; }
          .vg-toast__progress { animation: none; transform: scaleX(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => alert(msg), dismissToast: () => {} };
  }
  return context;
};
