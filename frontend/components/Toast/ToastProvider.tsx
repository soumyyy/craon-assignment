'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'warning' | 'error';
interface Toast { id: string; message: string; variant: ToastVariant; }
interface ToastCtx { toast: (message: string, variant?: ToastVariant) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const borderColor: Record<ToastVariant, string> = {
  success: 'border-status-success',
  warning: 'border-status-warning',
  error:   'border-status-error',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      variant === 'error' ? 5000 : 3000
    );
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 bg-bg-elevated border-l-4 ${borderColor[t.variant]} rounded px-4 py-3 text-cream text-sm max-w-xs shadow-lg`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-cream-muted hover:text-cream mt-0.5">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
