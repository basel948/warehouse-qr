"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand-logo";

export function AdminNav() {
  return (
    <nav className="bg-white border-b border-stone-200 mb-6">
      <div className="h-1 bg-amber-600" aria-hidden />
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-5">
        <Link href="/admin">
          <BrandLogo size="sm" />
        </Link>
        <Link href="/admin/products" className="text-sm font-medium text-stone-600">
          Products
        </Link>
        <Link href="/admin/orders" className="text-sm font-medium text-stone-600">
          Orders
        </Link>
        <Link href="/admin/coupons" className="text-sm font-medium text-stone-600">
          Coupons
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="ml-auto text-sm font-medium text-stone-600"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
