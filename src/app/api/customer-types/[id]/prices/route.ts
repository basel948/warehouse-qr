import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const setPriceSchema = z.object({
  productId: z.string().min(1).max(50),
  // null = remove this type's price; the product's base price applies again.
  price: z.number().positive().max(1_000_000).nullable(),
});

// Admin: set (or clear) one product's price for this customer type.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = setPriceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { productId, price } = parsed.data;

  if (price == null) {
    await prisma.productTypePrice.deleteMany({ where: { productId, customerTypeId: params.id } });
  } else {
    await prisma.productTypePrice.upsert({
      where: { productId_customerTypeId: { productId, customerTypeId: params.id } },
      create: { productId, customerTypeId: params.id, price },
      update: { price },
    });
  }
  return NextResponse.json({ ok: true });
}
