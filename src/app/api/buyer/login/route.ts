import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setBuyerCookie } from "@/lib/buyer-session";
import { buyerDetailsError, buyerDetailsSchema, normalizeBuyerDetails } from "@/lib/buyer-details";
import { clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";

const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

// Shop sign-up / sign-in: first name, business name, ח.פ and phone. No
// password and no owner approval: the buyer is logged in straight away. The
// phone is the identity, so signing up again with the same phone (a new phone,
// or after logging out) updates that buyer's details instead of making a copy.
export async function POST(request: Request) {
  const ipKey = `buyer-login:ip:${clientIp(request.headers)}`;
  const retryAfter = retryAfterSeconds(ipKey, LOGIN_LIMIT);
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  recordHit(ipKey, LOGIN_WINDOW_MS);

  const parsed = buyerDetailsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "missing_info" }, { status: 400 });
  const problem = buyerDetailsError(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { phone, ...details } = normalizeBuyerDetails(parsed.data);
  const buyer = await prisma.buyer.upsert({
    where: { phone },
    create: { phone, ...details },
    update: { ...details, lastLoginAt: new Date() },
  });

  const response = NextResponse.json({ ok: true, name: buyer.name });
  setBuyerCookie(response, buyer.id);
  return response;
}
