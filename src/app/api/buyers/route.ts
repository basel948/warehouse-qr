import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// Admin: everyone who logged in to the shop (or the owner added), most recent first.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const buyers = await prisma.buyer.findMany({
    orderBy: { lastLoginAt: "desc" },
    include: { customerType: { select: { id: true, name: true } }, _count: { select: { orders: true } } },
  });
  return NextResponse.json(buyers);
}

const createSchema = z.object({
  phone: z.string().trim().max(CHECKOUT_LIMITS.phone),
  customerTypeId: z.string().min(1).max(50),
  name: z.string().trim().max(CHECKOUT_LIMITS.name).optional().default(""),
  businessName: z.string().trim().max(CHECKOUT_LIMITS.businessName).optional().default(""),
});

// Admin: add a buyer by hand (phone + type, name/business optional). They
// still log in on the shop with that phone; their details are then prefilled.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { phone, customerTypeId, name, businessName } = parsed.data;

  if (!isValidIsraeliPhone(phone)) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  const type = await prisma.customerType.findUnique({ where: { id: customerTypeId }, select: { id: true } });
  if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const normalized = normalizeIsraeliPhone(phone);
  const existing = await prisma.buyer.findUnique({ where: { phone: normalized }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "phone_exists" }, { status: 409 });

  const buyer = await prisma.buyer.create({
    data: { phone: normalized, customerTypeId, name, businessName },
  });
  return NextResponse.json(buyer, { status: 201 });
}
