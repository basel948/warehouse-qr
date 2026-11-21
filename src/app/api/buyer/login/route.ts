import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setBuyerCookie } from "@/lib/buyer-session";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/phone";
import { clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";

const loginSchema = z.object({
  phone: z.string().trim().max(CHECKOUT_LIMITS.phone),
  customerTypeId: z.string().min(1).max(50),
});

const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

// Shop login: phone + the customer type the buyer chooses. There is no code
// or verification yet (the owner's decision), so a buyer can pick any type;
// the phone and chosen type are recorded so the owner can see who chose what.
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

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { phone, customerTypeId } = parsed.data;

  if (!isValidIsraeliPhone(phone)) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  const type = await prisma.customerType.findUnique({ where: { id: customerTypeId }, select: { id: true } });
  if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const normalized = normalizeIsraeliPhone(phone);
  const buyer = await prisma.buyer.upsert({
    where: { phone: normalized },
    create: { phone: normalized, customerTypeId },
    update: { customerTypeId, lastLoginAt: new Date() },
  });

  const response = NextResponse.json({ ok: true });
  setBuyerCookie(response, buyer.id);
  return response;
}
