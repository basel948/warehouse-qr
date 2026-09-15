import { prisma } from "@/lib/prisma";
import { OrderCatalog } from "./order-catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { category: true, subcategory: true },
  });

  return <OrderCatalog products={products} />;
}
