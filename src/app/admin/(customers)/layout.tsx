"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

// "Customers and prices": one entry in the admin menu, two tabs. The folder
// name in brackets is a route group, so the URLs stay /admin/customers and
// /admin/prices.
export default function CustomersAndPricesLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/customers", label: t("admin.customers.tabCustomers") },
    { href: "/admin/prices", label: t("admin.customers.tabPrices") },
  ];

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <h1 className="text-xl font-bold text-[#1a1714] mb-3">{t("nav.customers")}</h1>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full border border-[var(--accent)] bg-white p-1">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={active}
                className={`rounded-full py-2 text-center text-sm font-semibold transition-colors ${
                  active ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--accent)] hover:bg-[#fdf6ea]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </>
  );
}
