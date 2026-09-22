import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
  inStock: z.boolean().optional(),
  onSale: z.boolean().optional(),
  salePrice: z.number().positive().nullable().optional(),
  saleBannerImageUrl: z.string().url().nullable().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  subcategoryId: z.string().min(1).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { categoryIds, ...rest } = parsed.data;

  if (rest.onSale !== undefined || rest.salePrice !== undefined || rest.price !== undefined) {
    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const resolvedOnSale = rest.onSale ?? existing.onSale;
    const resolvedSalePrice = rest.salePrice !== undefined ? rest.salePrice : existing.salePrice;
    const resolvedPrice = rest.price ?? existing.price;
    if (resolvedOnSale && (resolvedSalePrice == null || resolvedSalePrice >= resolvedPrice)) {
      return NextResponse.json(
        { error: "salePrice must be set and lower than price when onSale is true" },
        { status: 400 }
      );
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...rest,
      categories: categoryIds ? { set: categoryIds.map((id) => ({ id })) } : undefined,
    },
    include: { categories: true, subcategory: true },
  });
  return NextResponse.json(product);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
