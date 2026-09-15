import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSubcategorySchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSubcategorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const subcategory = await prisma.subcategory.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(subcategory);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Products in this subcategory fall back to no subcategory (onDelete: SetNull).
  await prisma.subcategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
