import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABEL_HE, type PaymentMethod } from "@/lib/payment-method";
import { generateOrderPdf, generateOrderReceiptPdf } from "@/lib/order-pdf";
import { sendOrderEmail } from "@/lib/order-email";
import { sendOrderPdfWhatsAppMessage } from "@/lib/whatsapp";

// Paused on the owner's request while the WhatsApp Business number/template
// setup is still pending - orders only go out by email for now. Flip back
// to true once that's ready.
const ORDER_WHATSAPP_NOTIFICATIONS_ENABLED = false;

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
  customerName: z.string().min(1),
  businessName: z.string().min(1),
  customerPhone: z.string().min(5),
  paymentMethod: z.enum([
    PAYMENT_METHOD.CASH,
    PAYMENT_METHOD.CREDIT,
    PAYMENT_METHOD.PAY_LATER,
  ]),
  couponCode: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { customerName, businessName, customerPhone, paymentMethod, couponCode, items } = parsed.data;

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "One or more products were not found" }, { status: 400 });
  }

  let discountPercent: number | null = null;
  let appliedCouponCode: string | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });
    if (!coupon || !coupon.active) {
      return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 400 });
    }
    discountPercent = coupon.discountPercent;
    appliedCouponCode = coupon.code;
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  const order = await prisma.order.create({
    data: {
      customerName,
      businessName,
      customerPhone,
      paymentMethod,
      couponCode: appliedCouponCode,
      discountPercent,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: productById.get(item.productId)!.price,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = discountPercent ? subtotal * (discountPercent / 100) : 0;
  const total = subtotal - discountAmount;

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
        price: item.price,
        imageUrl: item.product.imageUrl,
      })),
      subtotal,
      couponCode: appliedCouponCode,
      discountPercent,
      total,
    });

    // A receipt only makes sense once payment is actually taken at order
    // time - currently that's credit only (cash is collected on delivery,
    // pay-later is settled at month-end, so nothing's been paid yet).
    const receiptPdfBuffer =
      paymentMethod === PAYMENT_METHOD.CREDIT
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
              price: item.price,
              imageUrl: item.product.imageUrl,
            })),
            subtotal,
            couponCode: appliedCouponCode,
            discountPercent,
            total,
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
    { order, subtotal, discountAmount, total, whatsappError, emailError },
    { status: 201 }
  );
}
