"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "./admin-nav";
import { IdleLogout } from "./idle-logout";
import { BackToTop } from "@/components/back-to-top";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // These pages are used while logged out, so they get no admin nav bar.
  const isLoggedOutPage = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"].includes(pathname);

  return (
    <>
      {!isLoggedOutPage && <AdminNav />}
      {!isLoggedOutPage && <IdleLogout />}
      {children}
      {/* Raised so it clears the products page's bulk-action bar. */}
      {!isLoggedOutPage && <BackToTop bottomClass="bottom-20" />}
    </>
  );
}
