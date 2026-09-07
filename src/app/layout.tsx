import type { Metadata } from "next";
import localFont from "next/font/local";
import { WAREHOUSE_NAME } from "@/lib/branding";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocaleFromCookies } from "@/lib/i18n/get-locale";
import { LOCALE_DIR } from "@/lib/i18n/locales";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
