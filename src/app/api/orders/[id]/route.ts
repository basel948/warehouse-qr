import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/order-status";

const updateOrderSchema = z.object({
  status: z.enum([ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json(order);
}

// Only cancelled orders can be deleted, so a real order (or a pay-later
// debt) can't disappear from one mis-click - cancel it first, then delete.
// Its items are removed with it (OrderItem has onDelete: Cascade).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== ORDER_STATUS.CANCELLED) {
    return NextResponse.json({ error: "not_cancelled" }, { status: 409 });
  }

  await prisma.order.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
