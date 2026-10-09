import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_INCLUDE } from "@/lib/variant-groups";

const addOptionSchema = z.object({
  /** The product being edited; the new option starts as a copy of it. */
  sourceProductId: z.string().min(1),
  /** The new option's label, e.g. "שחור" or "8OZ". */
  label: z.string().trim().min(1).max(60),
  // Only when the source isn't on a card yet: the new card's name, and the
  // source's own label on it.
  groupName: z.string().trim().min(1).max(120).optional(),
  sourceLabel: z.string().trim().min(1).max(60).optional(),
});

// "+ Add option" in the edit window: copies the product (price, unit,
// categories, subcategory, description) into a new option on the same card,
// creating the card first if the product isn't on one. The copy has no photo
// of its own (the card's photo shows) and its stock isn't tracked yet.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = addOptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sourceProductId, label, groupName, sourceLabel } = parsed.data;

  const source = await prisma.product.findUnique({
    where: { id: sourceProductId },
    include: { categories: { select: { id: true } }, variantGroup: true },
  });
  if (!source) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const created = await prisma.$transaction(async (tx) => {
    let groupId = source.variantGroupId;
    let cardName = source.variantGroup?.name;
    if (!groupId) {
      cardName = groupName ?? source.name;
      const group = await tx.variantGroup.create({ data: { name: cardName } });
      groupId = group.id;
      await tx.product.update({
        where: { id: source.id },
        data: { variantGroupId: groupId, variantLabel: sourceLabel ?? source.name, variantOrder: 0 },
      });
    }
    const last = await tx.product.findFirst({
      where: { variantGroupId: groupId },
      orderBy: { variantOrder: "desc" },
      select: { variantOrder: true },
    });
    return tx.product.create({
      data: {
        name: `${cardName} ${label}`,
        description: source.description,
        price: source.price,
        unit: source.unit,
        inStock: true,
        sortOrder: source.sortOrder,
        categories: { connect: source.categories.map((c) => ({ id: c.id })) },
        subcategoryId: source.subcategoryId,
        variantGroupId: groupId,
        variantLabel: label,
        variantOrder: (last?.variantOrder ?? 0) + 1,
      },
      include: PRODUCT_INCLUDE,
    });
  });
  return NextResponse.json(created, { status: 201 });
}
