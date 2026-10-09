import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABEL_HE, type PaymentMethod } from "@/lib/payment-method";
import { generateOrderPdf, generateOrderReceiptPdf } from "@/lib/order-pdf";
import { sendOrderEmail } from "@/lib/order-email";
import { sendOrderPdfWhatsAppMessage } from "@/lib/whatsapp";
import { getEffectivePrice } from "@/lib/effective-price";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/phone";
import { clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";
import { VAT_PERCENT, bestCouponFor, calculateOrderTotals, type CouponRule } from "@/lib/order-totals";
import { deductStock, quantitiesByProduct, type StockShortage } from "@/lib/stock";

// Paused on the owner's request while the WhatsApp Business number/template
// setup is still pending - orders only go out by email for now. Flip back
// to true once that's ready.
const ORDER_WHATSAPP_NOTIFICATIONS_ENABLED = false;

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
  customerName: z.string().trim().min(1).max(CHECKOUT_LIMITS.name),
  businessName: z.string().trim().min(1).max(CHECKOUT_LIMITS.businessName),
  customerPhone: z.string().trim().max(CHECKOUT_LIMITS.phone),
  paymentMethod: z.enum([
    PAYMENT_METHOD.CASH,
    PAYMENT_METHOD.CREDIT,
    PAYMENT_METHOD.PAY_LATER,
  ]),
  // Several coupons may be applied; `couponCode` (one) is what checkout sent
  // before that, still accepted from a page loaded before the update.
  couponCodes: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
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

// Every order sends the owner an email (and WhatsApp when enabled), so cap how
// fast one visitor or one phone number can place them.
const ORDER_LIMIT = 5;
const ORDER_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { customerName, businessName, customerPhone, paymentMethod, couponCode, couponCodes, items } = parsed.data;

  if (!isValidIsraeliPhone(customerPhone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const ipKey = `order:ip:${clientIp(request.headers)}`;
  const phoneKey = `order:phone:${normalizeIsraeliPhone(customerPhone)}`;
  const retryAfter = Math.max(retryAfterSeconds(ipKey, ORDER_LIMIT), retryAfterSeconds(phoneKey, ORDER_LIMIT));
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: "too_many_orders", retryAfterSeconds: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { categories: { select: { id: true } } },
  });

  if (products.length !== productIds.length) {
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

  // The checkout's coupon preview isn't trusted: each code is looked up again
  // and every item's discount re-derived here (best covering coupon, no stacking).
  const codes = Array.from(
    new Set([...(couponCodes ?? []), ...(couponCode ? [couponCode] : [])].map((c) => c.trim().toUpperCase()))
  );
  const coupons: CouponRule[] = [];
  for (const code of codes) {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: { categories: { select: { id: true } } },
    });
    if (!coupon || !coupon.active) {
      return NextResponse.json({ error: "Invalid or expired coupon code", code }, { status: 400 });
    }
    coupons.push({
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      categoryIds: coupon.categories.map((c) => c.id),
    });
  }
  const couponByProduct = new Map(
    products.map((product) => [product.id, bestCouponFor(product.categories.map((c) => c.id), coupons)])
  );
  // Only coupons that actually discounted an item count (and get recorded).
  const usedCodes = coupons
    .map((c) => c.code)
    .filter((code) => Array.from(couponByProduct.values()).some((c) => c?.code === code));
  const appliedCouponCode = usedCodes.length > 0 ? usedCodes.join(", ") : null;
  // Card payment isn't connected to a payment provider yet, so nothing would
  // actually be charged (yet a "paid" receipt would go out). The checkout UI
  // only shows a "not available yet" notice; this blocks direct requests.
  if (paymentMethod === PAYMENT_METHOD.CREDIT) {
    return NextResponse.json({ error: "credit_unavailable" }, { status: 400 });
  }
  // Pay-later is only offered to buyers with a valid coupon; the checkout UI
  // hides it otherwise, and this stops a hand-crafted request getting it.
  if (paymentMethod === PAYMENT_METHOD.PAY_LATER && !appliedCouponCode) {
    return NextResponse.json({ error: "pay_later_requires_coupon" }, { status: 400 });
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  recordHit(ipKey, ORDER_WINDOW_MS);
  recordHit(phoneKey, ORDER_WINDOW_MS);

  // Stock is taken off and the order saved together: if any tracked product
  // is short, nothing is saved and the buyer is told what's available.
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const stock = await deductStock(tx, quantitiesByProduct(items));
      if (!stock.ok) throw new StockShortageError(stock.shortages);
      return tx.order.create({
        data: {
          customerName,
          businessName,
          customerPhone,
          paymentMethod,
          couponCode: appliedCouponCode,
          vatPercent: VAT_PERCENT,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: getEffectivePrice(productById.get(item.productId)!),
              stockDeducted: stock.deducted.has(item.productId),
              couponCode: couponByProduct.get(item.productId)?.code ?? null,
              discountPercent: couponByProduct.get(item.productId)?.discountPercent ?? null,
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

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Prices are before VAT; the buyer pays the total including VAT.
  const totals = calculateOrderTotals(order.items, null, order.vatPercent);
  const { discountAmount, total } = totals;

  let whatsappError: string | null = null;
  let emailError: string | null = null;

  try {
    const pdfBuffer = await generateOrderPdf({
      orderId: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName,
      businessName: order.businessName,
      customerPhone: order.customerPhone,
      paymentMethod: order.paymentMethod as PaymentMethod,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unit: item.product.unit,
        price: item.price,
        imageUrl: item.product.imageUrl,
        couponCode: item.couponCode,
        discountPercent: item.discountPercent,
      })),
      subtotal,
      couponCode: appliedCouponCode,
      discountPercent: null,
      vatPercent: order.vatPercent,
    });

    // A receipt only makes sense once payment is actually taken at order
    // time - currently that's credit only (cash is collected on delivery,
    // pay-later is settled at month-end, so nothing's been paid yet).
    // Unreachable while credit is rejected above (no payment provider yet);
    // kept for when card payments are connected. The cast stops TypeScript
    // flagging the comparison as impossible after that early return.
    const receiptPdfBuffer =
      (paymentMethod as PaymentMethod) === PAYMENT_METHOD.CREDIT
        ? await generateOrderReceiptPdf({
            orderId: order.id,
            createdAt: order.createdAt,
            customerName: order.customerName,
            businessName: order.businessName,
            customerPhone: order.customerPhone,
            paymentMethod: order.paymentMethod as PaymentMethod,
            items: order.items.map((item) => ({
              productName: item.product.name,
              quantity: item.quantity,
              unit: item.product.unit,
              price: item.price,
              imageUrl: item.product.imageUrl,
              couponCode: item.couponCode,
              discountPercent: item.discountPercent,
            })),
            subtotal,
            couponCode: appliedCouponCode,
            discountPercent: null,
            vatPercent: order.vatPercent,
          })
        : null;

    if (ORDER_WHATSAPP_NOTIFICATIONS_ENABLED) {
      const ownerPhone = process.env.WAREHOUSE_OWNER_PHONE;
      try {
        if (!ownerPhone) throw new Error("WAREHOUSE_OWNER_PHONE is not configured");
        await sendOrderPdfWhatsAppMessage({
          orderId: order.id,
          to: ownerPhone,
          caption: `הזמנה חדשה מ-${order.customerName} · סה"כ ₪${total.toFixed(2)} · ${PAYMENT_METHOD_LABEL_HE[paymentMethod]}`,
          pdfBuffer,
        });
        if (receiptPdfBuffer) {
          await sendOrderPdfWhatsAppMessage({
            orderId: order.id,
            to: ownerPhone,
            caption: `קבלה עבור ההזמנה מ-${order.customerName} · סה"כ ₪${total.toFixed(2)}`,
            pdfBuffer: receiptPdfBuffer,
            filenameLabel: "קבלה",
          });
        }
        await prisma.order.update({
          where: { id: order.id },
          data: { whatsappSentAt: new Date() },
        });
      } catch (error) {
        whatsappError = error instanceof Error ? error.message : "Unknown WhatsApp error";
        console.error("Failed to send WhatsApp order notification:", whatsappError);
      }

      // Best-effort: send the buyer their own copy too. Unlike the owner (who
      // can stay in Meta's 24h session window by messaging the business number
      // periodically), a first-time buyer usually hasn't - so this will often
      // fail until an approved message template is set up. That's expected and
      // shouldn't block anything, same as the sends above.
      try {
        await sendOrderPdfWhatsAppMessage({
          orderId: order.id,
          to: order.customerPhone,
          caption: `תודה על ההזמנה! מצורפת ההזמנה שלך · סה"כ ₪${total.toFixed(2)}`,
          pdfBuffer,
        });
        if (receiptPdfBuffer) {
          await sendOrderPdfWhatsAppMessage({
            orderId: order.id,
            to: order.customerPhone,
            caption: `מצורפת הקבלה שלך · סה"כ ₪${total.toFixed(2)}`,
            pdfBuffer: receiptPdfBuffer,
            filenameLabel: "קבלה",
          });
        }
        await prisma.order.update({
          where: { id: order.id },
          data: { buyerWhatsappSentAt: new Date() },
        });
      } catch (error) {
        const buyerWhatsappError =
          error instanceof Error ? error.message : "Unknown WhatsApp error";
        console.error("Failed to send buyer's WhatsApp order copy:", buyerWhatsappError);
      }
    }

    try {
      await sendOrderEmail({
        orderId: order.id,
        customerName: order.customerName,
        businessName: order.businessName,
        customerPhone: order.customerPhone,
        paymentMethod: order.paymentMethod as PaymentMethod,
        totalBeforeVat: totals.totalBeforeVat,
        vatPercent: totals.vatPercent,
        vatAmount: totals.vatAmount,
        total,
        pdfBuffer,
        receiptPdfBuffer: receiptPdfBuffer ?? undefined,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { emailSentAt: new Date() },
      });
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Unknown email error";
      console.error("Failed to send order email:", emailError);
    }
  } catch (error) {
    const pdfError = error instanceof Error ? error.message : "Unknown PDF error";
    console.error("Failed to generate order PDF:", pdfError);
    whatsappError = pdfError;
    emailError = pdfError;
  }

  return NextResponse.json(
    {
      order,
      subtotal,
      discountAmount,
      totalBeforeVat: totals.totalBeforeVat,
      vatAmount: totals.vatAmount,
      total,
      whatsappError,
      emailError,
    },
    { status: 201 }
  );
}
