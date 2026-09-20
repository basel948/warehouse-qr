const GRAPH_API_VERSION = "v20.0";

type OrderPdfMessage = {
  orderId: string;
  to: string;
  caption: string;
  pdfBuffer: Buffer;
  /** Hebrew word used as the attached filename's prefix, e.g. "הזמנה" or "קבלה". */
  filenameLabel?: string;
};

/**
 * Buyers type their phone in local Israeli format (leading 0), but the
 * WhatsApp Cloud API requires international format with no leading 0
 * (e.g. "972501234567"). Owner numbers in env vars are already stored in
 * that format, so this is a no-op for those.
 */
function normalizeIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `972${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Sends the order as a WhatsApp document message (PDF + short caption) to
 * the given recipient via the Meta WhatsApp Cloud API. Note: outside Meta's
 * 24-hour customer service window, business-initiated messages are
 * rejected — you'd need an approved message template instead. This applies
 * per-recipient: the owner staying in-window (by messaging the business
 * number periodically) doesn't help a buyer who has never messaged it, so
 * buyer-copy sends will often fail until that's set up. See README for
 * setup details.
 */
export async function sendOrderPdfWhatsAppMessage(order: OrderPdfMessage): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp is not configured: set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID");
  }

  const filename = `${order.filenameLabel ?? "הזמנה"}-${order.orderId.slice(-6)}.pdf`;

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
        to: normalizeIsraeliPhone(order.to),
        type: "document",
        document: {
          id: mediaId,
          filename,
          caption: order.caption,
        },
      }),
    }
  );

  if (!messageRes.ok) {
    const detail = await messageRes.text();
    throw new Error(`WhatsApp API request failed (${messageRes.status}): ${detail}`);
  }
}
