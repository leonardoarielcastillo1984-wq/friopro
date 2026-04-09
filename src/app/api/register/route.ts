import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (exists) {
    return NextResponse.json(
      { error: "EMAIL_IN_USE" },
      { status: 409 },
    );
  }

  const plan = await prisma.plan.findUnique({
    where: { code: "FREE" },
    select: { id: true },
  });

  if (!plan) {
    return NextResponse.json(
      { error: "PLAN_FREE_NOT_FOUND" },
      { status: 500 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 50);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "TECHNICIAN",
      status: "ACTIVE",
      licenses: {
        create: {
          planId: plan.id,
          startsAt: now,
          expiresAt,
          active: true,
          status: "ACTIVE",
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
