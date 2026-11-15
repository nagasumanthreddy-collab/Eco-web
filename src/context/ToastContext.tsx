import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 lg:px-0"
      >
        {toasts.map((toast) => {
          const isError = toast.variant === 'error';
          const isSuccess = toast.variant === 'success';
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg transition-all ${
                isError
                  ? 'bg-white dark:bg-[#11191F] border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
                  : isSuccess
                    ? 'bg-white dark:bg-[#11191F] border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                    : 'bg-white dark:bg-[#11191F] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-600 dark:text-slate-400" />
              )}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
