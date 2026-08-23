'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (title: string, message: string, type?: 'success' | 'danger' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((title: string, message: string, type: 'success' | 'danger' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast: ToastItem = { id, title, message, type };
    setToasts(prev => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <i
              className={`fa-solid ${
                toast.type === 'success'
                  ? 'fa-circle-check'
                  : toast.type === 'danger'
                  ? 'fa-circle-xmark'
                  : toast.type === 'warning'
                  ? 'fa-triangle-exclamation'
                  : 'fa-circle-info'
              }`}
              style={{
                fontSize: 18,
                color:
                  toast.type === 'success'
                    ? '#16a34a'
                    : toast.type === 'danger'
                    ? '#dc2626'
                    : toast.type === 'warning'
                    ? '#d97706'
                    : '#2563eb',
                marginTop: 1,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => removeToast(toast.id)}
              aria-label="Đóng thông báo"
              style={{ padding: 2, margin: -2, color: 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
