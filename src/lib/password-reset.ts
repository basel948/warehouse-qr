import crypto from "node:crypto";
import { WAREHOUSE_NAME } from "@/lib/branding";
import { prisma } from "@/lib/prisma";

// Server-only: "forgot password" links for admins.

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a fresh one-time token for the admin, invalidating any earlier
 * unused ones, and returns the raw token (only its hash is stored).
 */
export async function createResetToken(adminId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { adminId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { adminId, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);
  return token;
}

/**
 * The link is built from NEXT_PUBLIC_SITE_URL, never from the request's Host
 * header - otherwise a forged Host could make the email point at someone
 * else's site and leak the token.
 */
export function resetLink(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return `${base}/admin/reset-password?token=${token}`;
}

/** Sends the reset link via SendGrid (same setup as the order emails). */
export async function sendPasswordResetEmail(to: string, username: string, link: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw new Error("Email is not configured: set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL");
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: WAREHOUSE_NAME },
      subject: `איפוס סיסמה – ${WAREHOUSE_NAME}`,
      content: [
        {
          type: "text/plain",
          value: [
            `התקבלה בקשה לאיפוס הסיסמה של המשתמש "${username}" בממשק הניהול.`,
            "",
            "לבחירת סיסמה חדשה, היכנסו לקישור (בתוקף ל-30 דקות, לשימוש חד-פעמי):",
            link,
            "",
            "אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל הזה – הסיסמה לא תשתנה.",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
  }
}
