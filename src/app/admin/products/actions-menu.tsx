"use client";

import { useEffect, useRef, useState } from "react";
import { DotsIcon } from "@/components/icons";

export type ActionItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

// The "⋯" button on a product card and the menu of actions it opens. Closes
// on choosing an item, tapping outside, or Escape.
export function ActionsMenu({
  items,
  label,
  disabled = false,
  busyIcon,
}: {
  items: ActionItem[];
  label: string;
  disabled?: boolean;
  /** Shown instead of the dots while an action on this card is running. */
  busyIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 border border-[#e6e0d6] text-[#4a443c] shadow-sm disabled:opacity-60"
      >
        {busyIcon ?? <DotsIcon className="w-5 h-5" />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full end-0 mt-1.5 min-w-[190px] bg-white border border-[#e6e0d6] rounded-[10px] shadow-lg p-1.5 z-20"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-[7px] text-start transition-colors ${
                item.danger
                  ? "text-[#b3402e] hover:bg-[#fbf1ef]"
                  : "text-[#1a1714] hover:bg-[#f7f5f1]"
              }`}
            >
              {item.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
