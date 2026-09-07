"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE } from "@/lib/i18n/cookie";

type TranslateParams = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.documentElement.lang = next;
      document.documentElement.dir = LOCALE_DIR[next];
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
      router.refresh();
    },
    [router]
  );

  const t = useCallback(
    (key: string, params?: TranslateParams) => {
      const value = getByPath(dictionaries[locale], key);
      if (typeof value !== "string") return key;
      return interpolate(value, params);
    },
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir: LOCALE_DIR[locale], setLocale, t }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
