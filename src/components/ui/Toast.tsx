import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

type ToastApi = {
  notify: (message: string, tone?: ToastTone) => void;
  /** Wraps an async action with saving / success / failure feedback. */
  runWithFeedback: <T>(action: () => Promise<T>, messages: { success: string; failure?: string }) => Promise<T | undefined>;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4200);
  }, []);

  const runWithFeedback = useCallback<ToastApi["runWithFeedback"]>(async (action, messages) => {
    try {
      const result = await action();
      notify(messages.success, "success");
      return result;
    } catch (error) {
      notify(messages.failure ?? (error instanceof Error ? error.message : "That action failed."), "error");
      return undefined;
    }
  }, [notify]);

  const value = useMemo(() => ({ notify, runWithFeedback }), [notify, runWithFeedback]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            <span aria-hidden>{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span>
            <p>{toast.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}