// Server-only: the shop buyer's login (phone + customer type). The cookie
// holds only the buyer's id, signed with NEXTAUTH_SECRET, so it can't be
// edited into another buyer; the type and its prices are always read from the
// database. Separate from the owner's admin login (NextAuth).
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const BUYER_COOKIE = "buyer_session";
// Buyers stay logged in on a device for a long time; ordering shouldn't need
// a login every visit.
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

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
  name: string;
  businessName: string;
  customerType: { id: string; name: string };
};

/** The logged-in buyer, or null (guest, bad cookie, or their type was deleted). */
export async function getCurrentBuyer(): Promise<CurrentBuyer | null> {
  const token = cookies().get(BUYER_COOKIE)?.value;
  const id = token ? verify(token) : null;
  if (!id) return null;
  const buyer = await prisma.buyer.findUnique({
    where: { id },
    include: { customerType: { select: { id: true, name: true } } },
  });
  if (!buyer?.customerType) return null;
  return {
    id: buyer.id,
    phone: buyer.phone,
    name: buyer.name,
    businessName: buyer.businessName,
    customerType: buyer.customerType,
  };
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
