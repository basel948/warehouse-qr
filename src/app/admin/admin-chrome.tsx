"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "./admin-nav";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // These pages are used while logged out, so they get no admin nav bar.
  const isLoggedOutPage = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"].includes(pathname);

  return (
    <>
      {!isLoggedOutPage && <AdminNav />}
      {children}
    </>
  );
}
