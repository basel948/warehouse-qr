import type { Metadata } from "next";
import { WAREHOUSE_NAME } from "@/lib/branding";
import { AdminProviders } from "./providers";
import { AdminChrome } from "./admin-chrome";

// Admin pages get their own install manifest, so "Add to Home Screen" from
// here creates an admin app that opens /admin rather than the shop.
export const metadata: Metadata = {
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { title: `${WAREHOUSE_NAME} Admin` },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviders>
      <AdminChrome>{children}</AdminChrome>
    </AdminProviders>
  );
}
