import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/order-status";
import { VAT_PERCENT } from "@/lib/order-totals";
import { redeductOrderStock, restoreOrderStock } from "@/lib/stock";

// One of three admin actions per request:
// - status: pending / confirmed / cancelled (stock follows cancelling);
// - prices: the owner prices the order (every line, before VAT);
// - markSent: the owner sent the buyer the WhatsApp link to the priced order.
const updateOrderSchema = z.union([
  z.object({ status: z.enum([ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]) }),
  z.object({
    prices: z
      .array(z.object({ itemId: z.string().min(1).max(50), price: z.number().min(0).max(1_000_000) }))
      .min(1)
      .max(300),
  }),
  z.object({ markSent: z.literal(true) }),
]);

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;

  if ("prices" in body) {
    const current = await prisma.order.findUnique({
      where: { id: params.id },
      select: { shareToken: true, vatPercent: true, items: { select: { id: true } } },
    });
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Every line needs a price, and only this order's lines can be changed.
    const itemIds = new Set(current.items.map((item) => item.id));
    const given = new Map(body.prices.map((p) => [p.itemId, p.price]));
    if (given.size !== itemIds.size || Array.from(given.keys()).some((id) => !itemIds.has(id))) {
      return NextResponse.json({ error: "every_item_needs_a_price" }, { status: 400 });
    }
    const order = await prisma.$transaction(async (tx) => {
      for (const [itemId, price] of Array.from(given)) {
        await tx.orderItem.update({ where: { id: itemId }, data: { price: round2(price) } });
      }
      return tx.order.update({
        where: { id: params.id },
        data: {
          pricedAt: new Date(),
          // VAT is snapshotted when first priced (an old order keeps its rate).
          vatPercent: current.vatPercent ?? VAT_PERCENT,
          shareToken: current.shareToken ?? randomBytes(18).toString("base64url"),
          // New prices: the buyer hasn't seen these yet.
          sentToBuyerAt: null,
        },
      });
    });
    return NextResponse.json(order);
  }

  if ("markSent" in body) {
    const current = await prisma.order.findUnique({ where: { id: params.id }, select: { pricedAt: true } });
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!current.pricedAt) return NextResponse.json({ error: "not_priced" }, { status: 409 });
    const order = await prisma.order.update({ where: { id: params.id }, data: { sentToBuyerAt: new Date() } });
    return NextResponse.json(order);
  }

  const next = body.status;
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!current) return null;
    // Cancelling returns the order's stock; reopening a cancelled order takes it again.
    if (next === ORDER_STATUS.CANCELLED && current.status !== ORDER_STATUS.CANCELLED) {
      await restoreOrderStock(tx, params.id);
    } else if (current.status === ORDER_STATUS.CANCELLED && next !== ORDER_STATUS.CANCELLED) {
      await redeductOrderStock(tx, params.id);
    }
    return tx.order.update({ where: { id: params.id }, data: { status: next } });
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
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
