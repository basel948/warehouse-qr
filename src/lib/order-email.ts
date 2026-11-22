import { sendEmail } from "@/lib/send-email";

type OrderEmailMessage = {
  orderId: string;
  customerName: string;
  businessName: string;
  businessId: string;
  customerPhone: string;
  /** Number of order lines. */
  itemCount: number;
  /** The order request (products and quantities, no prices). */
  pdfBuffer: Buffer;
};

/** Emails the owner a new order request (to price in the admin), with the PDF attached. */
export async function sendOrderEmail(order: OrderEmailMessage): Promise<void> {
  const ownerEmail = process.env.WAREHOUSE_OWNER_EMAIL;
  if (!ownerEmail) throw new Error("Email is not configured: set WAREHOUSE_OWNER_EMAIL");

  const shortId = order.orderId.slice(-6);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  await sendEmail({
    to: ownerEmail,
    subject: `הזמנה חדשה לתמחור מ-${order.businessName} (${order.customerName})`,
    text: [
      `הזמנה חדשה #${shortId} - ממתינה לתמחור`,
      `שם פרטי: ${order.customerName}`,
      `שם העסק: ${order.businessName}`,
      `ח.פ / עוסק מורשה: ${order.businessId || "-"}`,
      `טלפון: ${order.customerPhone}`,
      `מספר מוצרים: ${order.itemCount}`,
      "",
      "רשימת המוצרים מצורפת כ-PDF.",
      siteUrl
        ? `למילוי המחירים ושליחה ללקוח: ${siteUrl}/admin/orders`
        : "למילוי המחירים ושליחה ללקוח: עמוד ההזמנות בניהול.",
    ].join("\n"),
    attachments: [{ name: `הזמנה-${shortId}.pdf`, content: order.pdfBuffer }],
  });
}
