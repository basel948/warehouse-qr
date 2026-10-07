import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bulkSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(1000),
  action: z.enum(["inStock", "outOfStock", "delete"]),
});

// Bulk actions from the admin's "arrange products" list. Delete follows the
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
  return NextResponse.json({ updated: result.count, skipped: keep.size });
}
