import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toPublicProduct } from "@/lib/public-product";
import { CategorySections } from "./category-sections";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: { categoryId: string };
}) {
  const category = await prisma.category.findUnique({
    where: { id: params.categoryId },
    include: {
      subcategories: {
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  if (!category) notFound();

  const products = await prisma.product.findMany({
    where: { categories: { some: { id: category.id } } },
    // The admin's arrangement ("arrange products"); name breaks ties.
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { categories: true, subcategory: true },
  });

  return (
    <CategorySections
      categoryName={category.name}
      subcategories={category.subcategories}
      products={products.map(toPublicProduct)}
    />
  );
}
