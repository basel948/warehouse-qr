"use client";

import { useLocale } from "@/components/locale-provider";
import { LOCALES, LOCALE_NATIVE_NAME } from "@/lib/i18n/locales";

// A two-way toggle in the site's accent colour: the filled thumb slides under
// the current language. `fullWidth` stretches it to its container (used
// inside the admin menu).
export function LanguageSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { locale, setLocale } = useLocale();
  const index = Math.max(0, LOCALES.indexOf(locale));

  return (
    <div
      role="radiogroup"
      className={`${fullWidth ? "grid w-full" : "inline-grid shrink-0"} relative grid-cols-2 rounded-full border border-[var(--accent)] p-[2px] text-xs font-semibold`}
    >
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] rounded-full bg-[var(--accent)] transition-[inset-inline-start] duration-200"
        style={{ insetInlineStart: index === 0 ? "2px" : "50%" }}
      />
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={locale === code}
          onClick={() => setLocale(code)}
          className={`relative rounded-full px-2.5 py-1 text-center transition-colors duration-200 ${
            locale === code ? "text-white" : "text-[var(--accent)]"
          }`}
        >
          {LOCALE_NATIVE_NAME[code]}
        </button>
      ))}
    </div>
  );
}
