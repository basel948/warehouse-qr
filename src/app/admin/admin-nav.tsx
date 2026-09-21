"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

export function AdminNav() {
  const { t } = useLocale();

  return (
    <nav className="bg-white border-b border-[#eae5dc] mb-6">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3.5">
        <Link href="/admin" className="shrink-0">
          <BrandLogo size="sm" />
        </Link>
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/admin/products"
            className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
          >
            {t("nav.products")}
          </Link>
          <Link
            href="/admin/orders"
            className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
          >
            {t("nav.orders")}
          </Link>
          <Link
            href="/admin/coupons"
            className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
          >
            {t("nav.coupons")}
          </Link>
          <Link
            href="/admin/pay-later"
            className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
          >
            {t("nav.payLater")}
          </Link>
        </div>
        <div className="ms-auto shrink-0 flex items-center gap-3.5">
          <LanguageSwitcher />
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-sm font-medium text-[#6b6259]"
          >
            {t("nav.signOut")}
          </button>
        </div>
      </div>
    </nav>
  );
}
