"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand-logo";
import { ChevronDownIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

export function AdminNav() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { href: "/admin", label: t("nav.dashboard") },
    { href: "/admin/products", label: t("nav.products") },
    { href: "/admin/orders", label: t("nav.orders") },
    { href: "/admin/coupons", label: t("nav.coupons") },
    { href: "/admin/pay-later", label: t("nav.payLater") },
  ];

  const activeItem = navItems.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href)
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-white border-b border-[#eae5dc] mb-6">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3.5">
        <Link href="/admin" className="shrink-0">
          <BrandLogo size="sm" />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-1.5 rounded-full border border-[#1a1714] text-[#1a1714] hover:bg-[#f2efe9] transition-colors"
          >
            {activeItem?.label ?? t("nav.pages")}
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute top-full start-0 mt-1.5 min-w-[160px] bg-white border border-[#e6e0d6] rounded-[10px] shadow-lg p-1.5 z-20">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block text-sm font-medium px-3 py-2 rounded-[7px] transition-colors ${
                    activeItem?.href === item.href
                      ? "bg-[#f2efe9] text-[#1a1714]"
                      : "text-[#6b6259] hover:bg-[#f7f5f1] hover:text-[#1a1714]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
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
