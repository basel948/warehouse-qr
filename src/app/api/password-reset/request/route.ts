import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createResetToken, resetLink, sendPasswordResetEmail } from "@/lib/password-reset";
import { clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";

const requestSchema = z.object({ username: z.string().trim().min(1).max(100) });

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

// Public: emails a reset link for the given admin username. Always answers
// the same way whether or not the username exists, so it can't be used to
// discover admin usernames.
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { username } = parsed.data;

  const ipKey = `reset:ip:${clientIp(request.headers)}`;
  const userKey = `reset:user:${username.toLowerCase()}`;
  if (retryAfterSeconds(ipKey, REQUEST_LIMIT) > 0 || retryAfterSeconds(userKey, REQUEST_LIMIT) > 0) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  recordHit(ipKey, REQUEST_WINDOW_MS);
  recordHit(userKey, REQUEST_WINDOW_MS);

  const admin = await prisma.admin.findUnique({ where: { username } });
  const to = admin?.email || process.env.WAREHOUSE_OWNER_EMAIL;
  if (admin && to) {
    try {
      const token = await createResetToken(admin.id);
      await sendPasswordResetEmail(to, admin.username, resetLink(token));
    } catch (err) {
      // Logged for the developer; the visitor still gets the generic answer.
      console.error("Password reset email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
