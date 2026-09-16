const GRAPH_API_VERSION = "v20.0";

type OrderPdfMessage = {
  orderId: string;
  customerName: string;
  total: number;
  pdfBuffer: Buffer;
};

/**
 * Sends the order as a WhatsApp document message (PDF + short caption) to
 * the warehouse owner via the Meta WhatsApp Cloud API. Note: outside Meta's
 * 24-hour customer service window, business-initiated messages are
 * rejected — you'd need an approved message template instead. See README
 * for setup details.
 */
export async function sendOrderPdfWhatsAppMessage(order: OrderPdfMessage): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ownerPhone = process.env.WAREHOUSE_OWNER_PHONE;

  if (!token || !phoneNumberId || !ownerPhone) {
    throw new Error(
      "WhatsApp is not configured: set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WAREHOUSE_OWNER_PHONE"
    );
  }

  const filename = `הזמנה-${order.orderId.slice(-6)}.pdf`;

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(order.pdfBuffer)], { type: "application/pdf" }), filename);
  form.append("type", "application/pdf");
  form.append("messaging_product", "whatsapp");

  const uploadRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    throw new Error(`WhatsApp media upload failed (${uploadRes.status}): ${detail}`);
  }

  const { id: mediaId } = (await uploadRes.json()) as { id: string };

  const messageRes = await fetch(
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
        type: "document",
        document: {
          id: mediaId,
          filename,
          caption: `הזמנה חדשה מ-${order.customerName} · סה"כ ₪${order.total.toFixed(2)}`,
        },
      }),
    }
  );

  if (!messageRes.ok) {
    const detail = await messageRes.text();
    throw new Error(`WhatsApp API request failed (${messageRes.status}): ${detail}`);
  }
}
