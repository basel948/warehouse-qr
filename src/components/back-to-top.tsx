"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

// How far down the page (px) before the button appears.
const SHOW_AFTER = 400;

// Round "back to top" button, shown once the page is scrolled down. Sits at
// the bottom end corner (left in RTL), raised by `bottomClass` so it clears
// bars pinned to the bottom (the shop's cart bar, the admin's bulk bar), and
// under popups (z-20; overlays are z-30 and up).
export function BackToTop({ bottomClass = "bottom-5" }: { bottomClass?: string }) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > SHOW_AFTER);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function scrollToTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t("nav.backToTop")}
      tabIndex={visible ? 0 : -1}
      className={`fixed end-4 ${bottomClass} z-20 w-12 h-12 rounded-full bg-[var(--accent)] text-white ring-2 ring-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <ArrowUpIcon className="w-6 h-6" />
    </button>
  );
}
