import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { WAREHOUSE_ACCENT_COLOR, WAREHOUSE_NAME } from "@/lib/branding";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocaleFromCookies } from "@/lib/i18n/get-locale";
import { LOCALE_DIR } from "@/lib/i18n/locales";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: WAREHOUSE_NAME,
  description: "Scan the QR code to order products from the warehouse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getLocaleFromCookies();

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]}>
      <body
        className={`${ibmPlexSansArabic.variable} antialiased`}
        style={{ ["--accent" as string]: WAREHOUSE_ACCENT_COLOR }}
      >
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
