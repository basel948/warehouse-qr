import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateCouponSchema = z.object({
  active: z.boolean().optional(),
  discountPercent: z.number().int().min(1).max(100).optional(),
  categoryIds: z.array(z.string().min(1)).max(100).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateCouponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { categoryIds, ...rest } = parsed.data;
  const coupon = await prisma.coupon.update({
    where: { id: params.id },
    data: {
      ...rest,
      categories: categoryIds ? { set: categoryIds.map((id) => ({ id })) } : undefined,
    },
    include: { categories: { select: { id: true, name: true } } },
  });
  return NextResponse.json(coupon);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.coupon.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
