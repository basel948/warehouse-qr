"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

export function AdminNav() {
  const { t } = useLocale();

  return (
    <nav className="bg-white border-b border-stone-200 mb-6">
      <div className="h-1 bg-amber-600" aria-hidden />
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-5">
        <Link href="/admin">
          <BrandLogo size="sm" />
        </Link>
        <Link href="/admin/products" className="text-sm font-medium text-stone-600">
          {t("nav.products")}
        </Link>
        <Link href="/admin/orders" className="text-sm font-medium text-stone-600">
          {t("nav.orders")}
        </Link>
        <Link href="/admin/coupons" className="text-sm font-medium text-stone-600">
          {t("nav.coupons")}
        </Link>
        <div className="ms-auto flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-sm font-medium text-stone-600"
          >
            {t("nav.signOut")}
          </button>
        </div>
      </div>
    </nav>
  );
}
