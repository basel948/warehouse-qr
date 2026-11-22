// Server-only: the shop buyer's login. The buyer signs up once (first name,
// business name, ח.פ, phone) and stays logged in on that device until they log
// out. The cookie holds only the buyer's id, signed with NEXTAUTH_SECRET, so
// it can't be edited into another buyer; the details are always read from the
// database. Separate from the owner's admin login (NextAuth).
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const BUYER_COOKIE = "buyer_session";
// "Log in once": the longest lifetime browsers allow for a cookie (about 400
// days). Signing up again or checking out re-sets it (both upsert the buyer).
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function sign(value: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

export type CurrentBuyer = {
  id: string;
  phone: string;
  /** First name (שם פרטי). */
  name: string;
  businessName: string;
  /** ח.פ / עוסק מורשה, digits only. */
  businessId: string;
};

/** The logged-in buyer, or null (guest, bad cookie, or deleted by the owner). */
export async function getCurrentBuyer(): Promise<CurrentBuyer | null> {
  const token = cookies().get(BUYER_COOKIE)?.value;
  const id = token ? verify(token) : null;
  if (!id) return null;
  return prisma.buyer.findUnique({
    where: { id },
    select: { id: true, phone: true, name: true, businessName: true, businessId: true },
  });
}

export function setBuyerCookie(response: NextResponse, buyerId: string): void {
  response.cookies.set(BUYER_COOKIE, `${buyerId}.${sign(buyerId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearBuyerCookie(response: NextResponse): void {
  response.cookies.set(BUYER_COOKIE, "", { path: "/", maxAge: 0 });
}
