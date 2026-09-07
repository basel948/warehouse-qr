import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { LOCALE_COOKIE } from "./cookie";

export function getLocaleFromCookies(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}
