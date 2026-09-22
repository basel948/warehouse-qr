import { prisma } from "@/lib/prisma";
import { PageBackLink } from "@/components/page-back-link";
import { ProductGrid } from "@/components/product-grid";

export const dynamic = "force-dynamic";

const SANO_BRAND_MATCH = "סנו";

export default async function SanoBrandPage() {
  const products = await prisma.product.findMany({
    where: { name: { contains: SANO_BRAND_MATCH } },
    orderBy: { name: "asc" },
    include: { categories: true, subcategory: true },
  });

  return (
    <div>
      <PageBackLink href="/" title={SANO_BRAND_MATCH} />
      <ProductGrid products={products} />
    </div>
  );
}
