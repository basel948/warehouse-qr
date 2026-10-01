import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD } from "@/lib/payment-method";
import { normalizeIsraeliPhone } from "@/lib/phone";

const settleSchema = z.object({
  customerPhone: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/), // "YYYY-MM"
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

  const { customerPhone, month, settled } = parsed.data;
  const [year, monthNum] = month.split("-").map(Number);
  // UTC month bounds, matching how the pay-later page buckets orders
  // (createdAt.slice(0, 7) of the ISO string).
  const rangeStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, monthNum, 1));

  // The same customer may have typed their phone differently across orders
  // ("050-1234567" vs "0501234567"), so match on the normalized number
  // rather than the exact stored string.
  const phoneKey = normalizeIsraeliPhone(customerPhone);
  const monthOrders = await prisma.order.findMany({
    where: {
      paymentMethod: PAYMENT_METHOD.PAY_LATER,
      createdAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: { id: true, customerPhone: true },
  });
  const ids = monthOrders.filter((o) => normalizeIsraeliPhone(o.customerPhone) === phoneKey).map((o) => o.id);

  const result = await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { settledAt: settled ? new Date() : null },
  });

  return NextResponse.json({ updated: result.count });
}
