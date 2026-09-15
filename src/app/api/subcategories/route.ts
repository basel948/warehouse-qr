import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const subcategories = await prisma.subcategory.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(subcategories);
}

const createSubcategorySchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
  order: z.number().int().optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSubcategorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const subcategory = await prisma.subcategory.create({ data: parsed.data });
  return NextResponse.json(subcategory, { status: 201 });
}
