import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteEmptyVariantGroups } from "@/lib/variant-groups";

const mergeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  options: z
    .array(z.object({ productId: z.string().min(1), label: z.string().trim().min(1).max(60) }))
    .min(2)
    .max(50),
});

// "Merge into one card": the given products become the options of a new
// card, in the given order. A product already on another card moves over.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = mergeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, options } = parsed.data;
  if (new Set(options.map((o) => o.productId)).size !== options.length) {
    return NextResponse.json({ error: "duplicate_products" }, { status: 400 });
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.variantGroup.create({ data: { name } });
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      await tx.product.update({
        where: { id: option.productId },
        data: { variantGroupId: created.id, variantLabel: option.label, variantOrder: index },
      });
    }
    return created;
  });
  await deleteEmptyVariantGroups();
  return NextResponse.json(group, { status: 201 });
}
