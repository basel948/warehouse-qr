import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin: everyone who signed up in the shop, most recent login first. Buyers
// sign up themselves (POST /api/buyer/login); the owner can fix or remove them.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const buyers = await prisma.buyer.findMany({
    orderBy: { lastLoginAt: "desc" },
    select: {
      id: true,
      phone: true,
      name: true,
      businessName: true,
      businessId: true,
      lastLoginAt: true,
      _count: { select: { orders: true } },
    },
  });
  return NextResponse.json(buyers);
}
