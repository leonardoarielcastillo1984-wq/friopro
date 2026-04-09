import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth-secret";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            status: true,
          },
        });

        if (!user) return null;

        if (user.status !== "ACTIVE") return null;

        const stored = user.passwordHash;

        // Supports legacy sha256 hashes from early seeds, while keeping bcrypt as the intended hashing.
        const isLegacySha256 = /^[a-f0-9]{64}$/i.test(stored);

        const ok = isLegacySha256
          ? sha256(password) === stored
          : await bcrypt.compare(password, stored);

        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
