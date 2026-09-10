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
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-5">
        <Link href="/admin">
          <BrandLogo size="sm" />
        </Link>
        <Link
          href="/admin/products"
          className="text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
        >
          {t("nav.products")}
        </Link>
        <Link
          href="/admin/orders"
          className="text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
        >
          {t("nav.orders")}
        </Link>
        <Link
          href="/admin/coupons"
          className="text-sm font-medium px-3 py-1.5 rounded-lg text-[#6b6259] hover:bg-[#f2efe9] hover:text-[#1a1714] transition-colors"
        >
          {t("nav.coupons")}
        </Link>
        <div className="ms-auto flex items-center gap-3.5">
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
