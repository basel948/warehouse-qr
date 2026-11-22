import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { isValidBusinessId, normalizeBusinessId } from "@/lib/business-id";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(CHECKOUT_LIMITS.name),
  businessName: z.string().trim().min(1).max(CHECKOUT_LIMITS.businessName),
  businessId: z.string().trim().max(CHECKOUT_LIMITS.businessId),
});

// Admin: fix a buyer's details. The phone isn't editable: it's who they are
// (signing up with a new phone makes a new buyer).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "missing_info" }, { status: 400 });
  if (!isValidBusinessId(parsed.data.businessId)) {
    return NextResponse.json({ error: "invalid_business_id" }, { status: 400 });
  }

  const buyer = await prisma.buyer.update({
    where: { id: params.id },
    data: { ...parsed.data, businessId: normalizeBusinessId(parsed.data.businessId) },
  });
  return NextResponse.json(buyer);
}

// Removes a buyer from the list; their login stops working (they can sign up
// again). Their past orders stay, without the link to the buyer.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.buyer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
