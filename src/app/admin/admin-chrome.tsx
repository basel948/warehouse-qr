"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "./admin-nav";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  return (
    <>
      {!isLogin && <AdminNav />}
      {children}
    </>
  );
}
