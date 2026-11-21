import { NextResponse } from "next/server";
import { clearBuyerCookie } from "@/lib/buyer-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearBuyerCookie(response);
  return response;
}
