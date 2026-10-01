import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { clearHits } from "@/lib/rate-limit";

const confirmSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

// Public: sets a new admin password using a valid, unused, unexpired token
// from the reset email. The token is single-use.
export async function POST(request: Request) {
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const tooShort = parsed.error?.issues.some((issue) => issue.path[0] === "password");
    return NextResponse.json({ error: tooShort ? "password_too_short" : "invalid_token" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { admin: { select: { id: true, username: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.admin.update({ where: { id: record.adminId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { adminId: record.adminId, usedAt: null } }),
  ]);

  // A fresh password shouldn't be blocked by earlier wrong guesses.
  clearHits(`login:user:${record.admin.username.toLowerCase()}`);

  return NextResponse.json({ ok: true });
}
