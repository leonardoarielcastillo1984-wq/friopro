import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { buildApp } from '../src/app.js';

const prisma = new PrismaClient();

async function createUser(email: string, passwordHash: string, globalRole?: 'SUPER_ADMIN') {
  return prisma.platformUser.create({
    data: { email, passwordHash, globalRole: globalRole ?? null },
  });
}

async function withContext<T>(
  ctx: { userId?: string; tenantId?: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (ctx.userId) {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
    }
    if (ctx.tenantId) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    }
    return fn(tx);
  });
}

async function createTenantAsSuperAdmin(superAdminId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${superAdminId}, true)`;
    return tx.tenant.create({
      data: { name: 'Tenant', slug: `t-${Date.now()}-${Math.random().toString(16).slice(2)}` },
    });
  });
}

async function upsertBasicPlan() {
  return prisma.plan.upsert({
    where: { tier: 'BASIC' },
    update: { name: 'Básico', features: { documentos: true }, limits: null, isActive: true },
    create: { tier: 'BASIC', name: 'Básico', features: { documentos: true }, limits: null, isActive: true },
  });
}

test('Normal user without membership -> 403 on tenant-scoped documents', async () => {
  const app = await buildApp();

  // Arrange: tenant + user (no membership)
  const superAdmin = await createUser(`sa-${Date.now()}@x.com`, 'hash', 'SUPER_ADMIN');
  const tenant = await createTenantAsSuperAdmin(superAdmin.id);
  const user = await createUser(`u-${Date.now()}@x.com`, 'hash');

  const plan = await upsertBasicPlan();
  await withContext({ userId: superAdmin.id }, async (tx) => {
    await tx.tenantSubscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE' },
    });
  });

  // Fake token (bypass real login for unit test)
  const token = app.signAccessToken({ userId: user.id, tenantId: tenant.id, tenantRole: 'TENANT_USER' });

  const res = await app.inject({
    method: 'GET',
    url: '/documents',
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body, /No membership active for tenant/);

  await app.close();
});

test('Membership inactive -> 403 on tenant-scoped documents', async () => {
  const app = await buildApp();

  const superAdmin = await createUser(`sa2-${Date.now()}@x.com`, 'hash', 'SUPER_ADMIN');
  const tenant = await createTenantAsSuperAdmin(superAdmin.id);
  const user = await createUser(`u3-${Date.now()}@x.com`, 'hash');

  const plan = await upsertBasicPlan();
  await withContext({ userId: superAdmin.id }, async (tx) => {
    await tx.tenantSubscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE' },
    });
    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_USER', status: 'SUSPENDED' },
    });
  });

  const token = app.signAccessToken({ userId: user.id, tenantId: tenant.id, tenantRole: 'TENANT_USER' });

  const res = await app.inject({
    method: 'GET',
    url: '/documents',
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body, /No membership active for tenant/);

  await app.close();
});

test('Active membership + plan with documentos -> can create document and AuditEvent is created', async () => {
  const app = await buildApp();

  const superAdmin = await createUser(`sa3-${Date.now()}@x.com`, 'hash', 'SUPER_ADMIN');
  const tenant = await createTenantAsSuperAdmin(superAdmin.id);
  const user = await createUser(`u2-${Date.now()}@x.com`, 'hash');

  const plan = await upsertBasicPlan();
  await withContext({ userId: superAdmin.id }, async (tx) => {
    await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
      },
    });
    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
      },
    });
  });

  const token = app.signAccessToken({ userId: user.id, tenantId: tenant.id, tenantRole: 'TENANT_ADMIN' });

  const res = await app.inject({
    method: 'POST',
    url: '/documents',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Proc 1', type: 'PROCEDURE' },
  });

  assert.equal(res.statusCode, 201);

  // Verify at least one AuditEvent exists for this tenant.
  const events = await prisma.auditEvent.findMany({ where: { tenantId: tenant.id } });
  assert.ok(events.length >= 1);

  await app.close();
});

test('Auditor role requires tenant context (DB-level): missing app.tenant_id denies Document select', async () => {
  const auditor = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_AUDITOR });

  // No SET LOCAL app.tenant_id -> should fail once RLS is enabled.
  // We assert that the query throws.
  await assert.rejects(async () => {
    await auditor.document.findMany({ take: 1 });
  });

  await auditor.$disconnect();
});

test('Auditor role with app.tenant_id set -> can read documents within that tenant only', async () => {
  const auditor = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_AUDITOR });

  const superAdmin = await createUser(`sa4-${Date.now()}@x.com`, 'hash', 'SUPER_ADMIN');
  const tenant = await createTenantAsSuperAdmin(superAdmin.id);
  const user = await createUser(`u4-${Date.now()}@x.com`, 'hash');

  const plan = await upsertBasicPlan();
  await withContext({ userId: superAdmin.id }, async (tx) => {
    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
    });
    await tx.tenantSubscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE' },
    });
  });

  // Create a document via app-role with proper context.
  await withContext({ userId: user.id, tenantId: tenant.id }, async (tx) => {
    await tx.document.create({
      data: {
        tenantId: tenant.id,
        title: 'Doc A',
        type: 'PROCEDURE',
        status: 'DRAFT',
        version: 1,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  const docs = await auditor.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
    return tx.document.findMany();
  });

  assert.ok(docs.length >= 1);

  await auditor.$disconnect();
});
