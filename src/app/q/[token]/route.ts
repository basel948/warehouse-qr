import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderPdf } from "@/lib/order-pdf";

// The buyer's link to their priced order (sent by the owner over WhatsApp
// from the admin orders page): /q/<shareToken> opens the PDF. The token is a
// long random secret made when the order is first priced; there's no login,
// so anyone with the link can view that one order (like a shared document).
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const order = await prisma.order.findUnique({
    where: { shareToken: params.token },
    include: { items: { include: { product: true } } },
  });
  if (!order || !order.pricedAt || order.items.some((item) => item.price == null)) {
    return new NextResponse("ההזמנה לא נמצאה", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const pdf = await generateOrderPdf({
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
      price: item.price,
      imageUrl: item.product.imageUrl,
      couponCode: item.couponCode,
      discountPercent: item.discountPercent,
    })),
    couponCode: order.couponCode,
    discountPercent: order.discountPercent,
    vatPercent: order.vatPercent,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Opens in the phone's viewer; the name is used when saving it.
      "Content-Disposition": `inline; filename="order-${order.id.slice(-6)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
