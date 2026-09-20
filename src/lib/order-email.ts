import { WAREHOUSE_NAME } from "@/lib/branding";
import { PAYMENT_METHOD_LABEL_HE, type PaymentMethod } from "@/lib/payment-method";

type OrderEmailMessage = {
  orderId: string;
  customerName: string;
  businessName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  total: number;
  pdfBuffer: Buffer;
  receiptPdfBuffer?: Buffer;
};

/**
 * Sends the order email via SendGrid's HTTPS API rather than raw SMTP.
 * Railway (and many hosts) block outbound SMTP ports as an anti-spam
 * measure, so a direct SMTP transport (e.g. Gmail) never reaches its
 * destination from there even with valid credentials - an HTTPS API call
 * isn't affected by that.
 */
export async function sendOrderEmail(order: OrderEmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const ownerEmail = process.env.WAREHOUSE_OWNER_EMAIL;

  if (!apiKey || !fromEmail || !ownerEmail) {
    throw new Error(
      "Email is not configured: set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL and WAREHOUSE_OWNER_EMAIL"
    );
  }

  const filename = `הזמנה-${order.orderId.slice(-6)}.pdf`;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: ownerEmail }] }],
      from: { email: fromEmail, name: WAREHOUSE_NAME },
      subject: `הזמנה חדשה מ-${order.customerName} · סה"כ ₪${order.total.toFixed(2)}`,
      content: [
        {
          type: "text/plain",
          value: [
            `הזמנה חדשה #${order.orderId.slice(-6)}`,
            `שם מלא: ${order.customerName}`,
            `מעסיק מורשה / שם העסק: ${order.businessName || "-"}`,
            `מספר טלפון: ${order.customerPhone}`,
            `אופן תשלום: ${PAYMENT_METHOD_LABEL_HE[order.paymentMethod]}`,
            `סה"כ: ₪${order.total.toFixed(2)}`,
            "",
            order.receiptPdfBuffer
              ? "פרטי ההזמנה והקבלה מצורפים כ-PDF."
              : "פרטי ההזמנה המלאים מצורפים כ-PDF.",
          ].join("\n"),
        },
      ],
      attachments: [
        {
          content: order.pdfBuffer.toString("base64"),
          filename,
          type: "application/pdf",
          disposition: "attachment",
        },
        ...(order.receiptPdfBuffer
          ? [
              {
                content: order.receiptPdfBuffer.toString("base64"),
                filename: `קבלה-${order.orderId.slice(-6)}.pdf`,
                type: "application/pdf",
                disposition: "attachment",
              },
            ]
          : []),
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SendGrid API request failed (${res.status}): ${detail}`);
  }
}
