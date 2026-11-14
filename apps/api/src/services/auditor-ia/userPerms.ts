// ──────────────────────────────────────────────────────────────
// Auditor IA — resolución de permisos de módulos por usuario.
//
// Reconstruye el objeto { modulo: 'view'|'edit' } que usan los
// conectores para el gating de fuentes. Compartido entre rutas
// (request) y jobs (worker, sin request).
//
// FAIL-CLOSED: un usuario que no se puede resolver obtiene {}
// (los conectores no ven fuentes → evaluación conservadora), nunca
// 'admin' por defecto. Solo es 'admin' quien lo es de verdad:
// SUPER_ADMIN global o TENANT_ADMIN del tenant.
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { UserPerms } from './connectors/types.js';

interface UserPermsDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  platformUser: { findUnique: (args: any) => Promise<{ email: string | null; globalRole: string | null } | null> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantMembership: { findFirst: (args: any) => Promise<{ role: string } | null> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: { findUnique: (args: any) => Promise<{ permissions: unknown; status?: string; employee?: { tenantId: string } | null } | null> };
}

async function resolveFromDb(db: UserPermsDb, userId: string | null, tenantId?: string): Promise<UserPerms> {
  if (!userId) return {};

  const platformUser = await db.platformUser.findUnique({
    where: { id: userId },
    select: { email: true, globalRole: true },
  });
  if (!platformUser) return {};

  // SUPER_ADMIN de plataforma: acceso total a las fuentes.
  if (platformUser.globalRole === 'SUPER_ADMIN') return 'admin';

  // TENANT_ADMIN del tenant: acceso total a las fuentes.
  if (tenantId) {
    const membership = await db.tenantMembership.findFirst({
      where: { userId, tenantId, status: 'ACTIVE', deletedAt: null },
      select: { role: true },
    });
    if (membership?.role === 'TENANT_ADMIN') return 'admin';
  }

  // Empleado (User por email): sus permisos de módulo.
  if (!platformUser.email) return {};
  const user = await db.user.findUnique({
    where: { email: platformUser.email },
    select: { permissions: true, status: true, employee: { select: { tenantId: true } } },
  });
  if (!user) return {}; // no es empleado y no es admin → sin fuentes
  // Permisos de otra organización o usuario inactivo → sin fuentes.
  if (!tenantId || user.employee?.tenantId !== tenantId || user.status !== 'ACTIVE') return {};
  return (user.permissions as UserPerms) ?? {};
}

/** Para jobs (PrismaClient propio). */
export async function resolveUserPerms(
  db: UserPermsDb,
  userId: string | null,
  tenantId?: string,
): Promise<UserPerms> {
  return resolveFromDb(db, userId, tenantId);
}

/** Para rutas (app.prisma). */
export async function resolveUserPermsForRequest(
  app: FastifyInstance,
  userId: string | null,
  tenantId?: string,
): Promise<UserPerms> {
  return resolveFromDb(app.prisma as unknown as UserPermsDb, userId, tenantId);
}
