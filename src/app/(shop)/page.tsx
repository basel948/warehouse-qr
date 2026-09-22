import { prisma } from "@/lib/prisma";
import { HomeCategoryGrid } from "./home-category-grid";
import { SaleCarousel } from "@/components/sale-carousel";

export const dynamic = "force-dynamic";

const SANO_BRAND_MATCH = "סנו";
const SALE_PRODUCTS_LIMIT = 10;

export default async function HomePage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  const sanoCount = await prisma.product.count({
    where: { name: { contains: SANO_BRAND_MATCH } },
  });

  const saleProducts = await prisma.product.findMany({
    where: { onSale: true, salePrice: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: SALE_PRODUCTS_LIMIT,
    include: { categories: true, subcategory: true },
  });

  return (
    <div>
      <SaleCarousel products={saleProducts} />
      <HomeCategoryGrid categories={categories} showSano={sanoCount > 0} />
    </div>
  );
}
