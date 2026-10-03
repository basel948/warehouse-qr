"use client";

import { useLocale } from "@/components/locale-provider";
import { LOCALES, LOCALE_NATIVE_NAME } from "@/lib/i18n/locales";

// `fullWidth` stretches the toggle to its container and splits it evenly
// between the languages (used inside the admin menu).
export function LanguageSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={`${fullWidth ? "flex w-full" : "inline-flex shrink-0"} rounded-full bg-[#f2efe9] p-[3px] text-xs font-semibold`}>
      {LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-full px-2.5 py-1 transition-colors ${fullWidth ? "flex-1 text-center" : ""} ${
            locale === code
              ? "bg-white text-[#1a1714] shadow-sm"
              : "text-[#8a8177]"
          }`}
        >
          {LOCALE_NATIVE_NAME[code]}
        </button>
      ))}
    </div>
  );
}
