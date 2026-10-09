// Server-only helpers for product options (VariantGroup): several products
// shown as one card in the shop. See the VariantGroup model.
import { prisma } from "@/lib/prisma";

/** Product relations every product query returns (shop and admin). */
export const PRODUCT_INCLUDE = {
  categories: true,
  subcategory: true,
  variantGroup: { select: { id: true, name: true } },
} as const;

/**
 * Tidies cards after options are removed or deleted: a card with one option
 * left becomes a normal product again, and empty cards are deleted.
 */
export async function deleteEmptyVariantGroups(): Promise<void> {
  const groups = await prisma.variantGroup.findMany({ select: { id: true, _count: { select: { products: true } } } });
  const single = groups.filter((g) => g._count.products === 1).map((g) => g.id);
  if (single.length > 0) {
    await prisma.product.updateMany({
      where: { variantGroupId: { in: single } },
      data: { variantGroupId: null, variantLabel: null, variantOrder: 0 },
    });
  }
  await prisma.variantGroup.deleteMany({ where: { products: { none: {} } } });
}
