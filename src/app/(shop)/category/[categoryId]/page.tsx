import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubcategoryGrid } from "./subcategory-grid";

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

  const otherCount = await prisma.product.count({
    where: { categories: { some: { id: category.id } }, subcategoryId: null },
  });

  return (
    <SubcategoryGrid
      categoryId={category.id}
      categoryName={category.name}
      subcategories={category.subcategories}
      hasOther={otherCount > 0}
    />
  );
}
