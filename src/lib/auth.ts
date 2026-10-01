import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearHits, clientIp, recordHit, retryAfterSeconds } from "@/lib/rate-limit";

// After this many wrong passwords (per username, and per IP) within the
// window, login is refused until the window passes - stops password guessing.
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Shown by the login page instead of "wrong username or password".
export const LOGIN_LOCKED_ERROR = "too_many_attempts";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        const userKey = `login:user:${credentials.username.trim().toLowerCase()}`;
        const ipKey = `login:ip:${clientIp(req?.headers)}`;
        if (retryAfterSeconds(userKey, MAX_FAILED_LOGINS) > 0 || retryAfterSeconds(ipKey, MAX_FAILED_LOGINS) > 0) {
          throw new Error(LOGIN_LOCKED_ERROR);
        }

        const admin = await prisma.admin.findUnique({
          where: { username: credentials.username },
        });
        const valid = admin ? await bcrypt.compare(credentials.password, admin.passwordHash) : false;
        if (!admin || !valid) {
          recordHit(userKey, LOCKOUT_MS);
          recordHit(ipKey, LOCKOUT_MS);
          return null;
        }

        clearHits(userKey);
        clearHits(ipKey);
        return { id: admin.id, name: admin.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
