import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { updateTenantLicenseStatus } from '../services/license/licenseStatus.js';
import flotaRoutes from './flota.js';
import talleresRoutes from './flota-talleres.js';
import fleetOpsRoutes from './fleet-ops.js';
import maintenanceRoutes from './maintenance.js';
import fleetRecurrenceRoutes from './fleet-recurrence.js';

export const API_KEY_SCOPES = ['read', 'write', 'delete'] as const;
type Scope = (typeof API_KEY_SCOPES)[number];

type ApiKeyRow = {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdById: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

let tableReady = false;
async function ensureApiKeysTable(prisma: any) {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" UUID NOT NULL,
      name TEXT NOT NULL,
      "keyPrefix" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL UNIQUE,
      scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
      "createdById" UUID,
      "lastUsedAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ,
      "revokedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys ("tenantId")`);
  tableReady = true;
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

function requiredScope(method: string, url: string): Scope {
  const path = url.split('?')[0];
  if (method === 'DELETE' || /\/eliminar$/.test(path)) return 'delete';
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return 'write';
  return 'read';
}

const CreateKeyS = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).default(['read']),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

// ═══════════════════════════════════════════════════════════════
// Gestión de API keys (usuario logueado, TENANT_ADMIN) — prefix /api-keys
// ═══════════════════════════════════════════════════════════════
export async function apiKeyManagementRoutes(app: FastifyInstance) {
  const requireAdmin = (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    const tenantId = (req as any).db?.tenantId;
    if (!auth || !tenantId) {
      reply.code(401).send({ error: 'No autenticado' });
      return null;
    }
    if (auth.tenantRole !== 'TENANT_ADMIN' && auth.globalRole !== 'SUPER_ADMIN') {
      reply.code(403).send({ error: 'Solo administradores pueden gestionar API keys' });
      return null;
    }
    return { tenantId: tenantId as string, userId: auth.userId as string };
  };

  app.get('/', async (req, reply) => {
    const ctx = requireAdmin(req, reply);
    if (!ctx) return;
    await ensureApiKeysTable(app.prisma);
    const rows = await app.prisma.$queryRawUnsafe<ApiKeyRow[]>(
      `SELECT id, "tenantId", name, "keyPrefix", scopes, "createdById", "lastUsedAt", "expiresAt", "revokedAt", "createdAt"
       FROM api_keys WHERE "tenantId" = $1::uuid ORDER BY "createdAt" DESC`,
      ctx.tenantId
    );
    return reply.send({ keys: rows });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireAdmin(req, reply);
    if (!ctx) return;
    const body = CreateKeyS.parse(req.body ?? {});
    await ensureApiKeysTable(app.prisma);

    const key = `f360_${randomBytes(24).toString('base64url')}`;
    const keyPrefix = key.slice(0, 12);
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400_000) : null;

    const [row] = await app.prisma.$queryRawUnsafe<ApiKeyRow[]>(
      `INSERT INTO api_keys ("tenantId", name, "keyPrefix", "keyHash", scopes, "createdById", "expiresAt")
       VALUES ($1::uuid, $2, $3, $4, $5::text[], $6::uuid, $7)
       RETURNING id, "tenantId", name, "keyPrefix", scopes, "createdById", "lastUsedAt", "expiresAt", "revokedAt", "createdAt"`,
      ctx.tenantId, body.name, keyPrefix, hashKey(key), body.scopes, ctx.userId, expiresAt
    );

    return reply.code(201).send({
      ...row,
      key,
      warning: 'Guardá esta clave ahora: no se vuelve a mostrar.',
    });
  });

  app.delete('/:id', async (req, reply) => {
    const ctx = requireAdmin(req, reply);
    if (!ctx) return;
    const { id } = req.params as { id: string };
    await ensureApiKeysTable(app.prisma);
    const n = await app.prisma.$executeRawUnsafe(
      `UPDATE api_keys SET "revokedAt" = NOW() WHERE id = $1::uuid AND "tenantId" = $2::uuid AND "revokedAt" IS NULL`,
      id, ctx.tenantId
    );
    if (!n) return reply.code(404).send({ error: 'API key no encontrada o ya revocada' });
    return reply.send({ ok: true });
  });
}

// ═══════════════════════════════════════════════════════════════
// API pública v1 (autenticación por X-API-Key) — prefix /public/v1
// Reutiliza los handlers de Flota360 con el tenant de la key.
// ═══════════════════════════════════════════════════════════════
export async function publicApiV1Routes(app: FastifyInstance) {
  const lastTouch = new Map<string, number>();

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = req.headers['x-api-key'];
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key) {
      return reply.code(401).send({ error: 'API key requerida', code: 'API_KEY_MISSING', hint: 'Enviá el header X-API-Key' });
    }

    await ensureApiKeysTable(app.prisma);
    const [row] = await app.prisma.$queryRawUnsafe<ApiKeyRow[]>(
      `SELECT id, "tenantId", name, "keyPrefix", scopes, "createdById", "lastUsedAt", "expiresAt", "revokedAt", "createdAt"
       FROM api_keys WHERE "keyHash" = $1 LIMIT 1`,
      hashKey(key)
    );

    if (!row || row.revokedAt) {
      return reply.code(401).send({ error: 'API key inválida o revocada', code: 'API_KEY_INVALID' });
    }
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return reply.code(401).send({ error: 'API key vencida', code: 'API_KEY_EXPIRED' });
    }

    const scope = requiredScope(req.method, req.url);
    if (!row.scopes.includes(scope)) {
      return reply.code(403).send({ error: `La API key no tiene el permiso '${scope}'`, code: 'API_KEY_SCOPE', required: scope, granted: row.scopes });
    }

    const license = await updateTenantLicenseStatus((app as any).prisma, row.tenantId);
    if (license.status === 'EXPIRED') {
      return reply.code(403).send({ error: 'Licencia vencida', code: 'LICENSE_EXPIRED' });
    }
    if (license.status === 'GRACE' && !license.canWrite && scope !== 'read') {
      return reply.code(403).send({ error: 'Licencia en período de gracia: solo lectura', code: 'LICENSE_GRACE' });
    }

    (req as any).auth = { userId: row.createdById, tenantId: row.tenantId, tenantRole: 'TENANT_ADMIN', apiKeyId: row.id };
    (req as any).db = { prisma: app.prisma, tenantId: row.tenantId, userId: row.createdById ?? undefined, isAuditorMode: false };
    (req as any).tenantId = row.tenantId;
    (req as any).userId = row.createdById ?? undefined;
    (req as any).apiKey = { id: row.id, name: row.name, scopes: row.scopes };

    const now = Date.now();
    if ((lastTouch.get(row.id) ?? 0) < now - 60_000) {
      lastTouch.set(row.id, now);
      app.prisma.$executeRawUnsafe(`UPDATE api_keys SET "lastUsedAt" = NOW() WHERE id = $1::uuid`, row.id).catch(() => {});
    }
  });

  app.get('/me', async (req, reply) => {
    const apiKey = (req as any).apiKey;
    const tenant = await app.prisma.tenant.findUnique({
      where: { id: (req as any).db.tenantId },
      select: { id: true, name: true, licenseStatus: true, licensePlan: true },
    });
    return reply.send({ apiKey, tenant });
  });

  await app.register(flotaRoutes, { prefix: '/flota' });
  await app.register(talleresRoutes, { prefix: '/flota' });
  await app.register(fleetOpsRoutes, { prefix: '/fleet-ops' });
  await app.register(maintenanceRoutes, { prefix: '/maintenance' });
  await app.register(fleetRecurrenceRoutes, { prefix: '/fleet-recurrence' });
}
