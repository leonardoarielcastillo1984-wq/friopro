const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function main() {
  // Plans
  const plans = [
    {
      code: "FREE",
      name: "Free",
      maxWorkOrdersPerMonth: 15,
      maxEquipments: 30,
      aiEnabled: false,
      pdfEnabled: false,
      qrEnabled: true,
    },
    {
      code: "PRO",
      name: "Pro",
      maxWorkOrdersPerMonth: 200,
      maxEquipments: 500,
      aiEnabled: true,
      pdfEnabled: true,
      qrEnabled: true,
    },
    {
      code: "PRO_PLUS",
      name: "Pro+",
      maxWorkOrdersPerMonth: 2000,
      maxEquipments: 5000,
      aiEnabled: true,
      pdfEnabled: true,
      qrEnabled: true,
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        maxWorkOrdersPerMonth: p.maxWorkOrdersPerMonth,
        maxEquipments: p.maxEquipments,
        aiEnabled: p.aiEnabled,
        pdfEnabled: p.pdfEnabled,
        qrEnabled: p.qrEnabled,
      },
      create: p,
    });
  }

  // Super admin
  const adminEmail = "admin@friopro.local";
  const adminPassword = "admin123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Super Admin",
      role: "SUPER_ADMIN",
    },
    create: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "SUPER_ADMIN",
      currency: "USD",
    },
  });

  const pro = await prisma.plan.findUnique({ where: { code: "PRO" } });
  if (!pro) throw new Error("Seed error: PRO plan not found");

  // License (1 year)
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await prisma.license.create({
    data: {
      userId: admin.id,
      planId: pro.id,
      startsAt: now,
      expiresAt,
      active: true,
    },
  });

  console.log("Seed done.");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
