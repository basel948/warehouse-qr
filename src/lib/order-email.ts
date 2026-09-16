import nodemailer from "nodemailer";
import { WAREHOUSE_NAME } from "@/lib/branding";

type OrderEmailMessage = {
  orderId: string;
  customerName: string;
  businessName: string;
  customerPhone: string;
  total: number;
  pdfBuffer: Buffer;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword },
  });
  return transporter;
}

export async function sendOrderEmail(order: OrderEmailMessage): Promise<void> {
  const ownerEmail = process.env.WAREHOUSE_OWNER_EMAIL;
  const client = getTransporter();

  if (!client || !ownerEmail) {
    throw new Error(
      "Email is not configured: set GMAIL_USER, GMAIL_APP_PASSWORD and WAREHOUSE_OWNER_EMAIL"
    );
  }

  const filename = `הזמנה-${order.orderId.slice(-6)}.pdf`;

  await client.sendMail({
    from: `"${WAREHOUSE_NAME}" <${process.env.GMAIL_USER}>`,
    to: ownerEmail,
    subject: `הזמנה חדשה מ-${order.customerName} · סה"כ ₪${order.total.toFixed(2)}`,
    text: [
      `הזמנה חדשה #${order.orderId.slice(-6)}`,
      `שם מלא: ${order.customerName}`,
      `מעסיק מורשה / שם העסק: ${order.businessName || "-"}`,
      `מספר טלפון: ${order.customerPhone}`,
      `סה"כ: ₪${order.total.toFixed(2)}`,
      "",
      "פרטי ההזמנה המלאים מצורפים כ-PDF.",
    ].join("\n"),
    attachments: [{ filename, content: order.pdfBuffer, contentType: "application/pdf" }],
  });
}
