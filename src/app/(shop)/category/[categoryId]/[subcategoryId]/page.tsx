import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageBackLink } from "@/components/page-back-link";
import { ProductGrid } from "@/components/product-grid";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLocaleFromCookies } from "@/lib/i18n/get-locale";

export const dynamic = "force-dynamic";

export default async function SubcategoryPage({
  params,
}: {
  params: { categoryId: string; subcategoryId: string };
}) {
  const category = await prisma.category.findUnique({ where: { id: params.categoryId } });
  if (!category) notFound();

  const locale = getLocaleFromCookies();
  const t = dictionaries[locale];

  let subcategoryName: string;
  let products;

  if (params.subcategoryId === "other") {
    subcategoryName = t.catalog.otherCategory;
    products = await prisma.product.findMany({
      where: { categories: { some: { id: category.id } }, subcategoryId: null },
      orderBy: { name: "asc" },
      include: { categories: true, subcategory: true },
    });
  } else {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: params.subcategoryId },
    });
    if (!subcategory || subcategory.categoryId !== category.id) notFound();
    subcategoryName = subcategory.name;
    products = await prisma.product.findMany({
      where: { subcategoryId: subcategory.id },
      orderBy: { name: "asc" },
      include: { categories: true, subcategory: true },
    });
  }

  return (
    <div>
      <PageBackLink href={`/category/${category.id}`} title={subcategoryName} />
      <ProductGrid products={products} />
    </div>
  );
}
