import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteEmptyVariantGroups } from "@/lib/variant-groups";

const bulkSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(1000),
  action: z.enum(["inStock", "outOfStock", "delete", "subcategory", "unmerge"]),
  // For "subcategory": the target, or null for no subcategory ("other").
  subcategoryId: z.string().min(1).nullable().optional(),
});

// Bulk actions from the admin's "arrange products" list: stock on/off, move
// to another subcategory, or delete. Delete follows the
// single-product rule: a product that has ever been ordered is kept (past
// orders reference it) and reported back as skipped.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bulkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { action } = parsed.data;
  const ids = Array.from(new Set(parsed.data.productIds));

  if (action === "subcategory") {
    const subcategoryId = parsed.data.subcategoryId ?? null;
    if (subcategoryId) {
      // A subcategory only makes sense under its own category: move only the
      // products that belong to that category.
      const target = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
      if (!target) return NextResponse.json({ error: "unknown_subcategory" }, { status: 400 });
      const result = await prisma.product.updateMany({
        where: { id: { in: ids }, categories: { some: { id: target.categoryId } } },
        data: { subcategoryId },
      });
      return NextResponse.json({ updated: result.count, skipped: ids.length - result.count });
    }
    const result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { subcategoryId: null } });
    return NextResponse.json({ updated: result.count, skipped: 0 });
  }

  // Takes the products off their cards (each becomes its own card again).
  if (action === "unmerge") {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids }, variantGroupId: { not: null } },
      data: { variantGroupId: null, variantLabel: null, variantOrder: 0 },
    });
    await deleteEmptyVariantGroups();
    return NextResponse.json({ updated: result.count, skipped: 0 });
  }

  if (action !== "delete") {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { inStock: action === "inStock" },
    });
    return NextResponse.json({ updated: result.count, skipped: 0 });
  }

  const ordered = await prisma.orderItem.findMany({
    where: { productId: { in: ids } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const keep = new Set(ordered.map((item) => item.productId));
  const deletable = ids.filter((id) => !keep.has(id));
  const result = await prisma.product.deleteMany({ where: { id: { in: deletable } } });
  await deleteEmptyVariantGroups();
  return NextResponse.json({ updated: result.count, skipped: keep.size });
}
