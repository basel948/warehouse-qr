import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD } from "@/lib/payment-method";

const settleSchema = z.object({
  businessName: z.string().min(1),
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

  const { businessName, month, settled } = parsed.data;
  const [year, monthNum] = month.split("-").map(Number);
  const rangeStart = new Date(year, monthNum - 1, 1);
  const rangeEnd = new Date(year, monthNum, 1);

  const result = await prisma.order.updateMany({
    where: {
      businessName,
      paymentMethod: PAYMENT_METHOD.PAY_LATER,
      createdAt: { gte: rangeStart, lt: rangeEnd },
    },
    data: { settledAt: settled ? new Date() : null },
  });

  return NextResponse.json({ updated: result.count });
}
