import type { FastifyInstance, FastifyRequest } from 'fastify';

interface DbContext { tenantId?: string }

/**
 * Autorización del módulo Auditor IA.
 *
 * El plugin global user-permissions es fail-open y usa prefijos /api/*;
 * estas funciones se invocan explícitamente en cada handler.
 *
 * Matriz (spec 02 §8):
 *   view     → TENANT_ADMIN | TENANT_USER con permiso view/edit | SUPER_ADMIN
 *   operate  → permiso 'edit' en 'auditor-ia' o TENANT_ADMIN
 *   admin    → TENANT_ADMIN o SUPER_ADMIN (aprobar extracciones, aprobar N/A)
 *
 * Empleados: User.permissions['auditor-ia'] = 'view' | 'edit' (convención
 * del módulo — misma clave que el href del sidebar sin '/').
 */

export type AuditorAction =
  | 'view' // leer matriz, evaluaciones, evidencias, historial
  | 'extract' // iniciar extracción de una norma
  | 'approveExtraction' // aprobar/rechazar la extracción
  | 'editRequirements' // aprobar/descartar requisitos propuestos
  | 'runReview' // crear/ejecutar/cancelar revisiones
  | 'decide' // decisiones humanas sobre evaluaciones
  | 'proposeNA' // proponer no aplicabilidad
  | 'approveNA' // aprobar no aplicabilidad (admin)
  | 'addEvidence' // evidencia manual
  | 'linkFindings' // crear/vincular NC o Plan de Acción
  | 'export'; // generar informe

const MODULE_KEY = 'auditor-ia';

// Acciones que requieren nivel admin del tenant.
const ADMIN_ACTIONS: ReadonlySet<AuditorAction> = new Set<AuditorAction>(['approveExtraction', 'approveNA']);

// Acciones que requieren permiso de edición.
const EDIT_ACTIONS: ReadonlySet<AuditorAction> = new Set<AuditorAction>([
  'extract',
  'editRequirements',
  'runReview',
  'decide',
  'proposeNA',
  'addEvidence',
  'linkFindings',
  'export',
]);

type EmployeeAccess = 'none' | 'view' | 'edit';

async function employeeAccess(
  app: FastifyInstance,
  userId: string,
  tenantId: string,
): Promise<EmployeeAccess | null> {
  const platformUser = await app.prisma.platformUser.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!platformUser?.email) return null;

  const user = await app.prisma.user.findUnique({
    where: { email: platformUser.email },
    select: { permissions: true, status: true, employee: { select: { tenantId: true } } },
  });
  if (!user) return null; // no es empleado → se decide por rol de tenant
  // Los permisos del empleado son de SU organización: no se heredan a otra.
  if (user.employee?.tenantId !== tenantId || user.status !== 'ACTIVE') return 'none';

  const permissions = (user.permissions as Record<string, unknown>) || {};
  const raw = permissions[MODULE_KEY];
  const level =
    typeof raw === 'string' ? raw : (raw as { access?: string } | undefined)?.access;
  if (level === 'edit') return 'edit';
  if (level === 'view') return 'view';
  return 'none';
}

/**
 * Devuelve el tenant efectivo + verifica autorización. Lanza error con
 * statusCode 401/403 según corresponda. Todas las rutas del módulo deben
 * llamarla antes de tocar datos.
 */
export async function requireAuditorAccess(
  req: FastifyRequest,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  app: FastifyInstance,
  action: AuditorAction,
): Promise<{ tenantId: string; userId: string } | null> {
  const auth = req.auth;
  if (!auth?.userId) {
    reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Sesión requerida' });
    return null;
  }

  // Tenant explícito obligatorio. NO se usa el fallback de
  // getEffectiveTenantId (que elige el primer tenant para SUPER_ADMIN
  // sin contexto) para evitar acceso implícito a datos de otra org.
  const tenantId =
    (req as FastifyRequest & { db?: DbContext }).db?.tenantId ?? auth.tenantId ?? null;
  if (!tenantId) {
    reply.code(403).send({
      error: 'NO_TENANT',
      message: 'Seleccioná una organización para usar Auditor IA',
    });
    return null;
  }

  const isAdmin = auth.globalRole === 'SUPER_ADMIN' || auth.tenantRole === 'TENANT_ADMIN';

  if (isAdmin) return { tenantId, userId: auth.userId };

  // Usuario de tenant: verificar permiso del módulo
  const access = await employeeAccess(app, auth.userId, tenantId);

  if (access === null) {
    // Empleado sin registro interno → solo rol TENANT_ADMIN (ya evaluado).
    // Usuario de tenant sin permisos configurados → denegar (fail-closed).
    reply.code(403).send({
      error: 'PERMISSION_DENIED',
      message: 'Sin permisos para Auditor IA',
      module: MODULE_KEY,
    });
    return null;
  }

  if (ADMIN_ACTIONS.has(action)) {
    reply.code(403).send({
      error: 'PERMISSION_DENIED',
      message: 'Esta acción requiere rol de administración',
      module: MODULE_KEY,
    });
    return null;
  }

  if (EDIT_ACTIONS.has(action) && access !== 'edit') {
    reply.code(403).send({
      error: 'PERMISSION_DENIED',
      message: 'Se requiere permiso de edición en Auditor IA',
      module: MODULE_KEY,
    });
    return null;
  }

  if (access === 'none') {
    reply.code(403).send({
      error: 'PERMISSION_DENIED',
      message: 'Sin permisos para Auditor IA',
      module: MODULE_KEY,
    });
    return null;
  }

  return { tenantId, userId: auth.userId };
}

/** Feature key del módulo (spec 02 §8). */
export const AUDITOR_IA_FEATURE = 'auditor_ia';
