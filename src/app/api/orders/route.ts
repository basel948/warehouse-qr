import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderPdf } from "@/lib/order-pdf";
import { sendOrderEmail } from "@/lib/order-email";
import { getCurrentBuyer, setBuyerCookie } from "@/lib/buyer-session";
import { buyerDetailsError, buyerDetailsSchema, normalizeBuyerDetails } from "@/lib/buyer-details";
import { formatLocalPhone } from "@/lib/phone";
import { clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";
import { deductStock, quantitiesByProduct, type StockShortage } from "@/lib/stock";

// Thrown inside the order transaction to roll it back when stock runs short.
class StockShortageError extends Error {
  constructor(readonly shortages: StockShortage[]) {
    super("insufficient_stock");
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });
  return NextResponse.json(orders);
}

const createOrderSchema = z.object({
  details: buyerDetailsSchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(50),
        quantity: z.number().int().positive().max(10000),
      })
    )
    .min(1)
    .max(300),
});

// Every order sends the owner an email, so cap how fast one visitor or one
// buyer can place them.
const ORDER_LIMIT = 5;
const ORDER_WINDOW_MS = 10 * 60 * 1000;

// A buyer's order request: products and quantities only. Buyers see no
// prices, so the order is saved unpriced (item prices null); the owner prices
// it in the admin and sends it back to the buyer (PATCH /api/orders/[id]).
export async function POST(request: Request) {
  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { items } = parsed.data;

  const buyer = await getCurrentBuyer();
  if (!buyer) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const problem = buyerDetailsError(parsed.data.details);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const details = normalizeBuyerDetails(parsed.data.details);

  // The buyer may have changed their details at checkout. A new phone that
  // belongs to another buyer can't be taken over from here.
  if (details.phone !== buyer.phone) {
    const other = await prisma.buyer.findUnique({ where: { phone: details.phone }, select: { id: true } });
    if (other) return NextResponse.json({ error: "phone_taken" }, { status: 409 });
  }

  const ipKey = `order:ip:${clientIp(request.headers)}`;
  const buyerKey = `order:buyer:${buyer.id}`;
  const retryAfter = Math.max(retryAfterSeconds(ipKey, ORDER_LIMIT), retryAfterSeconds(buyerKey, ORDER_LIMIT));
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: "too_many_orders", retryAfterSeconds: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== new Set(productIds).size) {
    return NextResponse.json({ error: "One or more products were not found" }, { status: 400 });
  }

  // The storefront hides "add to cart" for out-of-stock products, but a cart
  // can be stale (or the request hand-crafted), so the server checks too.
  const outOfStock = products.filter((product) => !product.inStock);
  if (outOfStock.length > 0) {
    return NextResponse.json(
      { error: "out_of_stock", productIds: outOfStock.map((p) => p.id), names: outOfStock.map((p) => p.name) },
      { status: 409 }
    );
  }

  recordHit(ipKey, ORDER_WINDOW_MS);
  recordHit(buyerKey, ORDER_WINDOW_MS);

  // Stock is taken off and the order saved together: if any tracked product
  // is short, nothing is saved and the buyer is told what's available.
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const stock = await deductStock(tx, quantitiesByProduct(items));
      if (!stock.ok) throw new StockShortageError(stock.shortages);
      await tx.buyer.update({ where: { id: buyer.id }, data: details });
      return tx.order.create({
        data: {
          customerName: details.name,
          businessName: details.businessName,
          businessId: details.businessId,
          customerPhone: formatLocalPhone(details.phone),
          buyerId: buyer.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: null,
              stockDeducted: stock.deducted.has(item.productId),
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });
  } catch (error) {
    if (error instanceof StockShortageError) {
      return NextResponse.json(
        {
          error: "insufficient_stock",
          items: error.shortages.map((s) => ({ productId: s.productId, name: s.name, available: s.available })),
        },
        { status: 409 }
      );
    }
    throw error;
  }

  // Notification failures never fail the order: it is saved, emailSentAt
  // stays null and the admin sees it wasn't sent.
  let emailError: string | null = null;
  try {
    const pdfBuffer = await generateOrderPdf({
      orderId: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName,
      businessName: order.businessName,
      businessId: order.businessId,
      customerPhone: order.customerPhone,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unit: item.product.unit,
        price: null,
        imageUrl: item.product.imageUrl,
      })),
      couponCode: null,
      discountPercent: null,
      vatPercent: null,
    });
    await sendOrderEmail({
      orderId: order.id,
      customerName: order.customerName,
      businessName: order.businessName,
      businessId: order.businessId,
      customerPhone: order.customerPhone,
      itemCount: order.items.length,
      pdfBuffer,
    });
    await prisma.order.update({ where: { id: order.id }, data: { emailSentAt: new Date() } });
  } catch (error) {
    emailError = error instanceof Error ? error.message : "Unknown email error";
    console.error("Failed to send order email:", emailError);
  }

  const response = NextResponse.json({ orderId: order.id, emailError }, { status: 201 });
  // A changed phone is still the same buyer (same id); renewing the cookie
  // keeps a regular buyer logged in for good.
  setBuyerCookie(response, buyer.id);
  return response;
}
