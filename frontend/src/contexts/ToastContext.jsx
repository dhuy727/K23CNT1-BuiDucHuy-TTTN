import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', title, message, duration = 4000 }) => {
      const id = Date.now() + Math.random().toString(36).substring(2, 9);
      const newToast = { id, type, title, message };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (message, title = 'Thành công') => addToast({ type: 'success', title, message }),
    error: (message, title = 'Lỗi') => addToast({ type: 'error', title, message }),
    info: (message, title = 'Thông báo') => addToast({ type: 'info', title, message }),
    warning: (message, title = 'Cảnh báo') => addToast({ type: 'warning', title, message })
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast-card toast-${item.type} animate-slide-in`}>
            <div className="toast-icon">
              {item.type === 'success' && <CheckCircle2 size={20} />}
              {item.type === 'error' && <AlertCircle size={20} />}
              {item.type === 'warning' && <AlertTriangle size={20} />}
              {item.type === 'info' && <Info size={20} />}
            </div>
            <div className="toast-content">
              {item.title && <div className="toast-title">{item.title}</div>}
              <div className="toast-message">{item.message}</div>
            </div>
            <button
              className="toast-close-btn"
              onClick={() => removeToast(item.id)}
              aria-label="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
