import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteEmptyVariantGroups } from "@/lib/variant-groups";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  /**
   * Every option's label, in their new order ("edit names and order", or a
   * merge that adds ticked products to this card - they move onto it).
   */
  options: z
    .array(z.object({ productId: z.string().min(1), label: z.string().trim().min(1).max(60) }))
    .max(50)
    .optional(),
});

// Rename a card and relabel / reorder its options; products listed that are
// on no card or another card move onto this one (merge into an existing card).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.$transaction(async (tx) => {
    const updated = await tx.variantGroup.update({
      where: { id: params.id },
      data: parsed.data.name ? { name: parsed.data.name } : {},
    });
    const options = parsed.data.options ?? [];
    for (let index = 0; index < options.length; index++) {
      await tx.product.update({
        where: { id: options[index].productId },
        data: { variantGroupId: params.id, variantLabel: options[index].label, variantOrder: index },
      });
    }
    return updated;
  });
  // Products joining may have left another card with one option or none.
  if (parsed.data.options) await deleteEmptyVariantGroups();
  return NextResponse.json(group);
}
