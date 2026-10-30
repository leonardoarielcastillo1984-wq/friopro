import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock SOLO el transporte: las plantillas (notificationEmail, welcomeTenantEmail)
// siguen siendo las reales, así el test valida que el registro efectivamente
// intenta mandar los correos — la falla original fue que nunca se llamaban.
vi.mock('../services/email.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/email.js')>();
  return {
    ...mod,
    sendEmail: vi.fn(async () => ({ success: true })),
  };
});

import { buildApp } from '../app.js';
import { sendEmail } from '../services/email.js';

const TEST_EMAIL = 'regflow-test@example.com';
const TEST_ORG = 'RegFlow Test Org';
const TEST_EMAIL_CAPS = 'RegFlow-Case@Example.com';

describe('Register flow — regresión (blindaje)', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await buildApp();
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    // Asegurar que exista al menos un plan activo para el trial
    await prisma.plan.upsert({
      where: { tier: 'PROFESSIONAL' },
      update: { isActive: true },
      create: { tier: 'PROFESSIONAL', name: 'Test Professional', features: {} },
    });
  });

  afterAll(async () => {
    // Cleanup dirigido: SOLO lo que creó este test (nunca deleteMany global)
    await prisma.tenant.deleteMany({ where: { name: { in: [TEST_ORG, 'Case Org'] } } });
    await prisma.platformUser.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_CAPS.toLowerCase()] } } });
    await (prisma as any).adminNotification.deleteMany({
      where: { type: 'NEW_REGISTRATION', message: { contains: 'regflow' } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('register envía bienvenida al usuario + notificación a admins', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: TEST_EMAIL, password: 'password123', organizationName: TEST_ORG },
    });
    expect(res.statusCode).toBe(201);

    const calls = vi.mocked(sendEmail).mock.calls.map(([p]: any[]) => p);
    // Bienvenida al usuario registrado
    expect(calls.some((p) => p.to === TEST_EMAIL)).toBe(true);
    // Notificación a admins (soporte + hotmail fijos)
    expect(calls.some((p) => p.to === 'soporte@logismart.ar')).toBe(true);
    expect(calls.some((p) => p.to === 'leonardoarielcastillo@hotmail.com')).toBe(true);
  });

  it('register crea suscripción TRIAL aunque no exista plan BASIC', async () => {
    // Simular el escenario real de prod: no hay plan BASIC activo
    const basic = await prisma.plan.findUnique({ where: { tier: 'BASIC' } });
    const wasActive = basic?.isActive ?? false;
    if (basic) await prisma.plan.update({ where: { tier: 'BASIC' }, data: { isActive: false } });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: TEST_EMAIL_CAPS, password: 'password123', organizationName: 'Case Org' },
      });
      expect(res.statusCode).toBe(201);

      const tenant = await prisma.tenant.findFirst({ where: { name: 'Case Org' } });
      expect(tenant).not.toBeNull();
      const sub = await prisma.tenantSubscription.findFirst({ where: { tenantId: tenant!.id } });
      expect(sub).not.toBeNull();
      expect(sub!.status).toBe('TRIAL');
    } finally {
      if (basic && wasActive) {
        await prisma.plan.update({ where: { tier: 'BASIC' }, data: { isActive: true } });
      }
    }
  });

  it('register crea notificación in-app para super admin', async () => {
    const tenant = await prisma.tenant.findFirst({ where: { name: TEST_ORG } });
    const notif = await (prisma as any).adminNotification.findFirst({
      where: { type: 'NEW_REGISTRATION', data: { path: ['tenantId'], equals: tenant!.id } },
    });
    expect(notif).not.toBeNull();
  });

  it('login funciona con email en cualquier casing', async () => {
    // El usuario TEST_EMAIL_CAPS se guardó en minúsculas; loguear con mayúsculas debe funcionar
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL_CAPS, password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('forgot-password encuentra al usuario con cualquier casing', async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: TEST_EMAIL_CAPS },
    });
    expect(res.statusCode).toBe(200);
    // Si encontró al usuario, mandó el mail de reset
    const calls = vi.mocked(sendEmail).mock.calls.map(([p]: any[]) => p);
    expect(calls.some((p) => p.to === TEST_EMAIL_CAPS)).toBe(true);
  });
});
