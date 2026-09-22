import { StorefrontShell } from "@/components/storefront-shell";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
