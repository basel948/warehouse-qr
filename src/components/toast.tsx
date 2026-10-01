"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";

type ToastKind = "success" | "error";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

const VISIBLE_MS = 2600;

// Short confirmation messages ("Saved", "Deleted") shown at the bottom of the
// screen after an admin action, so it's clear the change went through.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDone={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS);
    const remove = setTimeout(onDone, VISIBLE_MS + 250);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
      clearTimeout(remove);
    };
    // onDone is a fresh closure each render; the timers only need to start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const success = toast.kind === "success";
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${success ? "bg-[#1a1714] text-white" : "bg-[#b3402e] text-white"}`}
    >
      {success ? (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2f6b3a]">
          <CheckIcon className="w-3 h-3" />
        </span>
      ) : (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 font-bold">!</span>
      )}
      {toast.message}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
