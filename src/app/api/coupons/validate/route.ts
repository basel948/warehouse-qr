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
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.active) {
    return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
  }

  return NextResponse.json({ code: coupon.code, discountPercent: coupon.discountPercent });
}
