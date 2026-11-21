import { StorefrontShell } from "@/components/storefront-shell";
import { getCurrentBuyer } from "@/lib/buyer-session";
import { prisma } from "@/lib/prisma";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [buyer, customerTypes] = await Promise.all([
    getCurrentBuyer(),
    // For the login window's "what kind of business" dropdown.
    prisma.customerType.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, icon: true },
    }),
  ]);
  return (
    <StorefrontShell
      buyer={
        buyer && {
          phone: buyer.phone,
          name: buyer.name,
          businessName: buyer.businessName,
          customerType: buyer.customerType,
        }
      }
      customerTypes={customerTypes}
    >
      {children}
    </StorefrontShell>
  );
}
