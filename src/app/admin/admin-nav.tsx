"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand-logo";
import { ChevronDownIcon, LogOutIcon, StoreIcon } from "@/components/icons";
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

        {/* Logo at the start; the store link and the menu sit together at the
            far end (the left, in Hebrew/Arabic). */}
        <div className="ms-auto shrink-0 flex items-center gap-3">
          {/* New tab so the admin page stays open behind the buyer's view. */}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 text-sm font-medium text-[#6b6259] hover:text-[#1a1714]"
          >
            <StoreIcon className="w-[18px] h-[18px]" />
            {t("nav.viewStore")}
          </a>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-1.5 rounded-full border border-[#1a1714] text-[#1a1714] hover:bg-[#f2efe9] transition-colors"
            >
              {activeItem?.label ?? t("nav.pages")}
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="absolute top-full end-0 mt-1.5 min-w-[190px] bg-white border border-[#e6e0d6] rounded-[10px] shadow-lg p-1.5 z-20">
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

                <div className="border-t border-[#eae5dc] my-1.5" />
                <div className="px-2 py-1.5">
                  <LanguageSwitcher fullWidth />
                </div>

                <div className="border-t border-[#eae5dc] my-1.5" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="w-full flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[7px] text-[#b3402e] hover:bg-[#fbf1ef] transition-colors"
                >
                  <LogOutIcon className="w-4 h-4 rtl:-scale-x-100" />
                  {t("nav.signOut")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
