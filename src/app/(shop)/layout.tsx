import { StorefrontShell } from "@/components/storefront-shell";
import { getCurrentBuyer } from "@/lib/buyer-session";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const buyer = await getCurrentBuyer();
  return (
    <StorefrontShell
      buyer={
        buyer && {
          phone: buyer.phone,
          name: buyer.name,
          businessName: buyer.businessName,
          businessId: buyer.businessId,
        }
      }
    >
      {children}
    </StorefrontShell>
  );
}
