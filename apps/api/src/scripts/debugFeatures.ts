import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Plans ===');
  const plans = await prisma.plan.findMany();
  for (const p of plans) {
    console.log(`  ${p.tier}: features =`, JSON.stringify(p.features));
  }

  console.log('\n=== Tenants ===');
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    console.log(`  ${t.name} (${t.slug}) - id: ${t.id}`);
  }

  console.log('\n=== Subscriptions ===');
  const subs = await prisma.tenantSubscription.findMany({
    include: { plan: true, tenant: true },
  });
  if (subs.length === 0) {
    console.log('  ⚠ NO SUBSCRIPTIONS FOUND!');
  }
  for (const s of subs) {
    console.log(`  Tenant: ${s.tenant.name} → Plan: ${s.plan.tier} (${s.status}) - deletedAt: ${s.deletedAt}`);
    console.log(`    Features:`, JSON.stringify(s.plan.features));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); });
