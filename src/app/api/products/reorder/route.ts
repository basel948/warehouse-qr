import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reorderSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(1000),
});

// Saves the order the admin dragged products into (within one category, or
// one subcategory group of it). The products swap positions only among
// themselves: their existing sortOrder values are handed back out in the new
// order, so products in other categories keep their places.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ids = Array.from(new Set(parsed.data.productIds));

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, sortOrder: true },
  });
  if (products.length !== ids.length) {
    return NextResponse.json({ error: "unknown_product" }, { status: 400 });
  }

  let slots = products.map((p) => p.sortOrder).sort((a, b) => a - b);
  // Shared positions (e.g. products created before ordering existed) can't be
  // swapped meaningfully; give this group fresh positions after everything.
  if (new Set(slots).size !== slots.length) {
    const last = await prisma.product.aggregate({ _max: { sortOrder: true } });
    const start = (last._max.sortOrder ?? 0) + 10;
    slots = ids.map((_, i) => start + i * 10);
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.product.update({ where: { id }, data: { sortOrder: slots.at(i) } }))
  );
  return NextResponse.json({ ok: true });
}
