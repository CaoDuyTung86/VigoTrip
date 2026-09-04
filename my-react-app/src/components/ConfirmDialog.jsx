import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Hộp xác nhận dùng chung, thay cho `window.confirm`.
 *
 * `window.confirm` hiện hộp thoại của trình duyệt: kèm tên miền, không theo được theme
 * tối/sáng của trang, và trên vài trình duyệt còn có ô "chặn không hiện nữa" — người dùng
 * tick vào là mọi xác nhận sau đó bị trả về `false` âm thầm, tức nút xóa im lặng không
 * làm gì. Hộp thoại tự vẽ nên không dính cả ba vấn đề đó.
 *
 * Cố ý KHÔNG đóng khi bấm ra ngoài: đây là thao tác không hoàn tác được, phải bấm rõ
 * một trong hai nút (Esc vẫn hủy được vì Esc là "hủy", không phải "đồng ý").
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = true,
  busy = false,
  onConfirm,
  onCancel
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        // Trên cả nút FAB (1000) và cửa sổ chat, nếu không hộp xác nhận chui xuống dưới.
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 16,
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          padding: 20
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: danger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(99, 102, 241, 0.12)',
            color: danger ? '#ef4444' : 'var(--primary)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            {title && (
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              {message}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 14,
              cursor: busy ? 'default' : 'pointer'
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: danger ? '#ef4444' : 'var(--primary)',
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              opacity: busy ? 0.7 : 1,
              cursor: busy ? 'default' : 'pointer'
            }}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
