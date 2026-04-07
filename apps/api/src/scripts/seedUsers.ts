import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding users, tenant and subscription...');

  // 1. Crear Super Admin
  const superAdminPassword = await argon2.hash('Admin123!');
  const superAdmin = await prisma.platformUser.upsert({
    where: { email: 'admin@sgi360.com' },
    update: { passwordHash: superAdminPassword },
    create: {
      email: 'admin@sgi360.com',
      passwordHash: superAdminPassword,
      globalRole: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`  Super Admin: admin@sgi360.com / Admin123!  (id: ${superAdmin.id})`);

  // 2. Crear Tenant de demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'Demo Company' },
    create: {
      name: 'Demo Company',
      slug: 'demo',
      status: 'ACTIVE',
    },
  });
  console.log(`  Tenant: ${tenant.name} (id: ${tenant.id})`);

  // 3. Crear usuario regular del tenant
  const userPassword = await argon2.hash('User123!');
  const demoUser = await prisma.platformUser.upsert({
    where: { email: 'usuario@demo.com' },
    update: { passwordHash: userPassword },
    create: {
      email: 'usuario@demo.com',
      passwordHash: userPassword,
      isActive: true,
    },
  });
  console.log(`  Usuario: usuario@demo.com / User123!  (id: ${demoUser.id})`);

  // 4. Crear membership (usuario → tenant)
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: demoUser.id,
      },
    },
    update: { role: 'TENANT_ADMIN', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      userId: demoUser.id,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  Membership: usuario@demo.com → Demo Company (TENANT_ADMIN)`);

  // 5. Buscar plan PREMIUM y crear suscripción
  const plan = await prisma.plan.findUnique({ where: { tier: 'PREMIUM' } });
  if (plan) {
    await prisma.tenantSubscription.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: { planId: plan.id, status: 'ACTIVE' },
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });
    console.log(`  Subscription: Demo Company → PREMIUM (ACTIVE)`);
  } else {
    console.warn('  ⚠ Plan PREMIUM no encontrado. Ejecutá primero: node --import tsx src/scripts/seedPlans.ts');
  }

  console.log('\n✅ Seed completado.');
  console.log('\nCredenciales:');
  console.log('  Super Admin:  admin@sgi360.com  /  Admin123!');
  console.log('  Usuario Demo: usuario@demo.com  /  User123!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
