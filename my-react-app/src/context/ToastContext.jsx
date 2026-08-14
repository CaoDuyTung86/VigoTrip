/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div
        style={{
          position: 'fixed',
          top: 80,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--bg-card, #1e293b)',
              color: 'var(--text-main, #f8fafc)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
              borderLeft: `4px solid ${
                toast.type === 'error'
                  ? '#ef4444'
                  : toast.type === 'warning'
                  ? '#f59e0b'
                  : toast.type === 'success'
                  ? '#22c55e'
                  : '#3b82f6'
              }`,
              animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              fontSize: 13.5,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {toast.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
              {toast.type === 'warning' && <AlertCircle size={18} color="#f59e0b" />}
              {toast.type === 'success' && <CheckCircle size={18} color="#22c55e" />}
              {toast.type === 'info' && <Info size={18} color="#3b82f6" />}
            </div>
            <div style={{ flex: 1 }}>{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(60px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => alert(msg) };
  }
  return context;
};
