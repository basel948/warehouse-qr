"use client";

import { useLocale } from "@/components/locale-provider";
import { LOCALES, LOCALE_NATIVE_NAME } from "@/lib/i18n/locales";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex shrink-0 rounded-full border border-stone-300 bg-white p-0.5 text-xs font-semibold">
      {LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            locale === code ? "bg-amber-600 text-white" : "text-stone-600"
          }`}
        >
          {LOCALE_NATIVE_NAME[code]}
        </button>
      ))}
    </div>
  );
}
