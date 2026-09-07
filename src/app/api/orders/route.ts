import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOrderWhatsAppMessage } from "@/lib/whatsapp";

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
  customerPhone: z.string().min(5),
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

  const { customerName, customerPhone, couponCode, items } = parsed.data;

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
      customerPhone,
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
  try {
    await sendOrderWhatsAppMessage({
      orderId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal,
      couponCode: appliedCouponCode,
      discountPercent,
      total,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { whatsappSentAt: new Date() },
    });
  } catch (error) {
    whatsappError = error instanceof Error ? error.message : "Unknown WhatsApp error";
    console.error("Failed to send WhatsApp order notification:", whatsappError);
  }

  return NextResponse.json(
    { order, subtotal, discountAmount, total, whatsappError },
    { status: 201 }
  );
}
