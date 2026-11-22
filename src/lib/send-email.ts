import { WAREHOUSE_NAME } from "@/lib/branding";

// Server-only: sends one email through Brevo's HTTPS API. Railway (and many
// hosts) block outbound SMTP ports, so an HTTPS API call is used instead.

type Email = {
  to: string;
  subject: string;
  text: string;
  attachments?: { name: string; content: Buffer }[];
};

export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw new Error("Email is not configured: set BREVO_API_KEY and BREVO_FROM_EMAIL");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: fromEmail, name: WAREHOUSE_NAME },
      to: [{ email: email.to }],
      subject: email.subject,
      textContent: email.text,
      ...(email.attachments?.length && {
        attachment: email.attachments.map((a) => ({ name: a.name, content: a.content.toString("base64") })),
      }),
    }),
  });

  if (!res.ok) {
    throw new Error(`Brevo API request failed (${res.status}): ${await res.text()}`);
  }
}
