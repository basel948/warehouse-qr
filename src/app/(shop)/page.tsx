import { prisma } from "@/lib/prisma";
import { toPublicProduct } from "@/lib/public-product";
import { HomeCategoryGrid } from "./home-category-grid";
import { SaleCarousel } from "@/components/sale-carousel";

export const dynamic = "force-dynamic";

const SALE_PRODUCTS_LIMIT = 10;

export default async function HomePage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, imageUrl: true },
  });

  const saleProducts = await prisma.product.findMany({
    where: { onSale: true, salePrice: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: SALE_PRODUCTS_LIMIT,
    include: { categories: true, subcategory: true },
  });

  return (
    <div>
      <SaleCarousel products={saleProducts.map(toPublicProduct)} />
      <HomeCategoryGrid categories={categories} />
    </div>
  );
}
