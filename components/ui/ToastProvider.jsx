"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import "./toast.css";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 ToastProvider 안에서만 사용할 수 있습니다");
  return ctx;
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const push = useCallback(({ message, tone = "info" }) => {
    const id = ++seq.current;
    setToasts(prev => [...prev, { id, message, tone }]);
    if (tone !== "fail") setTimeout(() => dismiss(id), 3000);  // 오류는 수동 닫기
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast__stack" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
            {t.tone === "fail" && (
              <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="닫기">×</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
