import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allFeatures = {
    documentos: true,
    no_conformidades: true,
    riesgos: true,
    indicadores: true,
    auditorias_iso: true,
    capacitaciones: true,
    mantenimiento: true,
    project360: true,
    simulacros: true,
    normativos: true,
    normativos_compliance: true,
    clientes: true,
    reportes: true,
    encuestas: true,
    rrhh: true,
    audit_ia: true,
  };

  // ── Plan único: PREMIUM $99/mes — acceso total a todos los módulos ──
  const premiumPlan = await prisma.plan.upsert({
    where: { tier: 'PREMIUM' },
    update: {
      name: 'SGI 360 — Plan Completo',
      features: allFeatures,
      limits: {
        users: -1,           // ilimitado
        storage: 20480,      // 20 GB en MB
        max_documents: -1,
        max_normatives: -1,
      },
      isActive: true,
    },
    create: {
      tier: 'PREMIUM',
      name: 'SGI 360 — Plan Completo',
      features: allFeatures,
      limits: {
        users: -1,
        storage: 20480,
        max_documents: -1,
        max_normatives: -1,
      },
      isActive: true,
    },
  });

  console.log(`✅ Plan PREMIUM upserted: ${premiumPlan.id}`);

  // Desactivar planes legacy (no los eliminamos para no romper FKs)
  await prisma.plan.updateMany({
    where: { tier: { in: ['BASIC', 'PROFESSIONAL'] } },
    data: { isActive: false },
  });

  console.log('✅ Planes BASIC y PROFESSIONAL marcados como inactivos');

  // Migrar todas las suscripciones activas al plan PREMIUM
  const updated = await prisma.tenantSubscription.updateMany({
    where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
    data: { planId: premiumPlan.id },
  });

  console.log(`✅ ${updated.count} suscripciones migradas al plan PREMIUM`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
