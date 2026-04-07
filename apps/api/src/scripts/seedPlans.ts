import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 14 módulos únicos - TODOS disponibles en todos los planes (usuario controla habilitación/deshabilitación)
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
    clientes: true,
    reportes: true,
    rrhh: true,
    audit_ia: true,
  };

  await prisma.plan.upsert({
    where: { tier: 'BASIC' },
    update: {
      name: 'Básico',
      features: allFeatures,
      limits: {
        max_users: 25,
        max_documents: 500,
        max_normatives: 0,
      },
      isActive: true,
    },
    create: {
      tier: 'BASIC',
      name: 'Básico',
      features: allFeatures,
      limits: {
        max_users: 25,
        max_documents: 500,
        max_normatives: 0,
      },
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { tier: 'PROFESSIONAL' },
    update: {
      name: 'Profesional',
      features: allFeatures,
      limits: {
        max_users: 100,
        max_documents: 5000,
        max_normatives: 10,
      },
      isActive: true,
    },
    create: {
      tier: 'PROFESSIONAL',
      name: 'Profesional',
      features: allFeatures,
      limits: {
        max_users: 100,
        max_documents: 5000,
        max_normatives: 10,
      },
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { tier: 'PREMIUM' },
    update: {
      name: 'Premium',
      features: allFeatures,
      limits: {
        max_users: 500,
        max_documents: 50000,
        max_normatives: 100,
      },
      isActive: true,
    },
    create: {
      tier: 'PREMIUM',
      name: 'Premium',
      features: allFeatures,
      limits: {
        max_users: 500,
        max_documents: 50000,
        max_normatives: 100,
      },
      isActive: true,
    },
  });
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
