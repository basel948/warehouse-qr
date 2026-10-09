import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const validateSchema = z.object({ code: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = validateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { categories: { select: { id: true, name: true } } },
  });

  if (!coupon || !coupon.active) {
    return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
  }

  // Empty categoryIds = applies to the whole order.
  return NextResponse.json({
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    categoryIds: coupon.categories.map((c) => c.id),
    categoryNames: coupon.categories.map((c) => c.name),
  });
}
