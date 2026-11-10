/**
 * seedCCTenant.ts — Crea el tenant CC Logistik + usuario admin y revincula
 * la API key del sistema externo al nuevo tenant.
 * Run: docker exec -w /app/apps/api flota-api npx tsx src/scripts/seedCCTenant.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'cclogistik@flota360.com';
  const slug = 'cc-logistik';

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      name: 'CC Logistik',
      slug,
      status: 'ACTIVE',
      licensePlan: 'PREMIUM',
      licenseStatus: 'ACTIVE',
      licenseStartAt: new Date(),
      licenseEndAt: new Date(Date.now() + 365 * 86400_000),
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Usuario admin
  const passwordHash = await argon2.hash('Dada2026');
  const user = await prisma.platformUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, isActive: true },
  });
  console.log(`Usuario: ${email} (${user.id})`);

  // 3. Membership TENANT_ADMIN
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: 'TENANT_ADMIN', status: 'ACTIVE' },
    create: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
  });

  // 4. Suscripción PREMIUM si existe el plan
  const plan = await prisma.plan.findUnique({ where: { tier: 'PREMIUM' } });
  if (plan) {
    const existing = await prisma.tenantSubscription.findFirst({ where: { tenantId: tenant.id } });
    if (!existing) {
      await prisma.tenantSubscription.create({
        data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE', startedAt: new Date() },
      });
      console.log('Suscripción PREMIUM creada');
    }
  }

  // 5. Setup marcado como PAID (evita pantalla de implementación)
  await prisma.$executeRawUnsafe(`
    INSERT INTO tenant_setups (id, "tenantId", amount, currency, status, "paidAt", provider, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), $1::uuid, 200, 'USD', 'PAID', now(), 'manual', now(), now())
    ON CONFLICT ("tenantId") DO UPDATE SET status='PAID', "paidAt"=now()
  `, tenant.id);

  // 6. Revincular la API key del sistema externo al nuevo tenant
  const moved = await prisma.$executeRawUnsafe(`
    UPDATE api_keys SET "tenantId" = $1::uuid, "createdById" = $2::uuid
    WHERE name = 'sistema-externo-amigo' AND "revokedAt" IS NULL
  `, tenant.id, user.id);
  console.log(`API keys revinculadas: ${moved}`);

  console.log('\n✅ Listo. Login: cclogistik@flota360.com / Dada2026');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
