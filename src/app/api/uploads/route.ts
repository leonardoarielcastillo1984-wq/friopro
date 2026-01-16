import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth-secret";

export async function POST(req: Request) {
  const token = await getToken({ req: req as any, secret: getAuthSecret() });
  const userId = (token?.sub as string | undefined) ?? undefined;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "").trim() || null;
  const workOrderId = String(form.get("workOrderId") ?? "").trim();

  if (!workOrderId) {
    return NextResponse.json({ error: "WORKORDER_REQUIRED" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  const owned = await prisma.workOrder.findFirst({
    where: { id: workOrderId, userId },
    select: { id: true },
  });

  if (!owned) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeName = (file.name || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);

  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);

  const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}_${base}${ext || ".jpg"}`;
  const relDir = path.join("uploads", userId, workOrderId);
  const absDir = path.join(process.cwd(), "public", relDir);

  await fs.mkdir(absDir, { recursive: true });

  const absPath = path.join(absDir, fileName);
  await fs.writeFile(absPath, buffer);

  const fileUrl = `/${relDir}/${fileName}`.replace(/\\/g, "/");

  const evidence = await prisma.evidencePhoto.create({
    data: {
      workOrderId,
      category,
      fileUrl,
    },
    select: { id: true, fileUrl: true },
  });

  const count = await prisma.evidencePhoto.count({ where: { workOrderId } });

  return NextResponse.json({ ok: true, evidence, count });
}
