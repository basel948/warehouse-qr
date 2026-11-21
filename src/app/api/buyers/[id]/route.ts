import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  customerTypeId: z.string().min(1).max(50).optional(),
  name: z.string().trim().max(CHECKOUT_LIMITS.name).optional(),
  businessName: z.string().trim().max(CHECKOUT_LIMITS.businessName).optional(),
});

// Admin: change a buyer's type (and so their prices) or their details.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (parsed.data.customerTypeId) {
    const type = await prisma.customerType.findUnique({ where: { id: parsed.data.customerTypeId }, select: { id: true } });
    if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const buyer = await prisma.buyer.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(buyer);
}

// Removes a buyer from the list; their login stops working (they can log in
// again). Their past orders stay, without the link to the buyer.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.buyer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
