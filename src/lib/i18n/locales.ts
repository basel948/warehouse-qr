export const LOCALES = ["he", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "he";

export const LOCALE_DIR: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  ar: "rtl",
};

export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  he: "עברית",
  ar: "العربية",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
