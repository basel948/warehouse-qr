import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  /** The card's product ids in their new option order. */
  order: z.array(z.string().min(1)).max(50).optional(),
});

// Rename a card, or reorder its options.
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
    const order = parsed.data.order ?? [];
    for (let index = 0; index < order.length; index++) {
      const productId = order[index];
      await tx.product.updateMany({
        where: { id: productId, variantGroupId: params.id },
        data: { variantOrder: index },
      });
    }
    return updated;
  });
  return NextResponse.json(group);
}

// Split the card: every option goes back to being its own card.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.product.updateMany({
      where: { variantGroupId: params.id },
      data: { variantGroupId: null, variantLabel: null, variantOrder: 0 },
    }),
    prisma.variantGroup.deleteMany({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
