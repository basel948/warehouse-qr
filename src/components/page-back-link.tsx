"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export function PageBackLink({ href, title }: { href: string; title: string }) {
  const { t } = useLocale();
  return (
    <div className="mb-4">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6b6259] mb-2"
      >
        {/* Points toward the RTL "back" direction (the app has no LTR locale yet) */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12H19" />
          <path d="M13 18l6-6-6-6" />
        </svg>
        {t("catalog.back")}
      </Link>
      <h1 className="text-lg font-bold text-[#1a1714]">{title}</h1>
    </div>
  );
}
