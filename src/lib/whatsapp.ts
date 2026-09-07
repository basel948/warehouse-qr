const GRAPH_API_VERSION = "v20.0";

type OrderNotificationItem = {
  productName: string;
  quantity: number;
  price: number;
};

type OrderNotification = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: OrderNotificationItem[];
  subtotal: number;
  couponCode: string | null;
  discountPercent: number | null;
  total: number;
};

function buildMessageBody(order: OrderNotification): string {
  const lines = order.items.map(
    (item) => `- ${item.quantity}x ${item.productName} ($${item.price.toFixed(2)} each)`
  );

  const totalLines =
    order.couponCode && order.discountPercent
      ? [
          `Subtotal: $${order.subtotal.toFixed(2)}`,
          `Coupon: ${order.couponCode} (-${order.discountPercent}%)`,
          `Total: $${order.total.toFixed(2)}`,
        ]
      : [`Total: $${order.total.toFixed(2)}`];

  return [
    `New order #${order.orderId.slice(-6)}`,
    `From: ${order.customerName} (${order.customerPhone})`,
    "",
    ...lines,
    "",
    ...totalLines,
  ].join("\n");
}

/**
 * Sends a plain-text WhatsApp message to the warehouse owner via the Meta
 * WhatsApp Cloud API. Note: outside Meta's 24-hour customer service window,
 * business-initiated text messages are rejected — you'd need an approved
 * message template instead. See README for setup details.
 */
export async function sendOrderWhatsAppMessage(order: OrderNotification): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ownerPhone = process.env.WAREHOUSE_OWNER_PHONE;

  if (!token || !phoneNumberId || !ownerPhone) {
    throw new Error(
      "WhatsApp is not configured: set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WAREHOUSE_OWNER_PHONE"
    );
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ownerPhone,
        type: "text",
        text: { body: buildMessageBody(order) },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp API request failed (${res.status}): ${detail}`);
  }
}
