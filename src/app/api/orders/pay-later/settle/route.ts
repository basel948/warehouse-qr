import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD } from "@/lib/payment-method";

// Marks the given orders paid (or unpaid). The pay-later page sends exactly
// the orders shown on a customer's card, so a customer's older paid orders
// aren't touched when their new ones are settled.
const settleSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
  settled: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = settleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderIds, settled } = parsed.data;

  const result = await prisma.order.updateMany({
    where: { id: { in: orderIds }, paymentMethod: PAYMENT_METHOD.PAY_LATER },
    data: { settledAt: settled ? new Date() : null },
  });

  return NextResponse.json({ updated: result.count });
}
