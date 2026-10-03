"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type ConfirmOptions = {
  title: string;
  /** Short explanation of what the action does to related data. */
  message: string;
  /** Defaults to "Delete". */
  confirmLabel?: string;
  /** "danger" (red, the default) for deletions; "normal" (accent) for other changes. */
  tone?: "danger" | "normal";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

// One "are you sure?" popup for every admin action that changes what buyers
// see, so a stray tap can't delete or change anything. `await confirm({...})`
// resolves true only when the admin presses the confirm button; Cancel,
// Escape and tapping outside all say no.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  function close(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const { t } = useLocale();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus Cancel, not Delete, so pressing Enter by reflex doesn't confirm.
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1714]/55 p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-[16px] shadow-xl p-5"
      >
        <h2 id="confirm-title" className="text-base font-bold text-[#1a1714] mb-2">
          {options.title}
        </h2>
        <p id="confirm-message" className="text-sm text-[#6b6259] leading-relaxed mb-5">
          {options.message}
        </p>
        <div className="flex gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="flex-1 h-11 rounded-[10px] border border-[#e6e0d6] text-[#1a1714] text-sm font-semibold"
          >
            {t("admin.confirmDialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`flex-1 h-11 rounded-[10px] text-white text-sm font-semibold ${
              options.tone === "normal" ? "bg-[var(--accent)]" : "bg-[#b3402e]"
            }`}
          >
            {options.confirmLabel ?? t("admin.confirmDialog.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
