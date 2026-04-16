import type { FastifyRequest } from 'fastify';

interface AuthContext {
  userId: string;
  tenantId?: string;
  globalRole?: string;
  tenantRole?: string;
}

interface DbContext {
  tenantId?: string;
}

interface ExtendedRequest extends Omit<FastifyRequest, 'auth' | 'db'> {
  auth: AuthContext | null;
  db?: DbContext;
}

/**
 * Verifica si el usuario es SUPER_ADMIN y puede operar sin tenant
 */
export function isSuperAdmin(req: FastifyRequest): boolean {
  const extendedReq = req as ExtendedRequest;
  return extendedReq.auth?.globalRole === 'SUPER_ADMIN';
}

/**
 * Valida si el contexto de tenant es requerido
 * Retorna true si se debe requerir tenant (usuario no es superadmin)
 * Retorna false si se puede bypass (usuario es superadmin)
 */
export function requiresTenantContext(req: FastifyRequest): boolean {
  // Si el usuario es SUPER_ADMIN, no requiere tenant context
  if (isSuperAdmin(req)) {
    const extendedReq = req as ExtendedRequest;
    // Logging para auditoría
    console.log('[TENANT_BYPASS] SUPER_ADMIN bypassing tenant context check', {
      url: req.url,
      method: req.method,
      userId: extendedReq.auth?.userId,
      globalRole: extendedReq.auth?.globalRole
    });
    return false;
  }
  
  return true;
}

/**
 * Obtiene el tenantId del request, con fallback para superadmin
 * Si el usuario es superadmin y no tiene tenantId, retorna null
 */
export function getTenantId(req: FastifyRequest): string | null {
  if (!requiresTenantContext(req)) {
    return null;
  }
  const extendedReq = req as ExtendedRequest;
  return extendedReq.db?.tenantId || null;
}

/**
 * Obtiene el tenantId efectivo para operaciones que requieren un tenant
 * Para SUPER_ADMIN, busca el primer tenant disponible si no tiene uno asignado
 */
export async function getEffectiveTenantId(req: FastifyRequest, prisma: any): Promise<string | null> {
  const extendedReq = req as ExtendedRequest;
  
  // Si el usuario no es SUPER_ADMIN, usar el tenantId del request
  if (!isSuperAdmin(req)) {
    return extendedReq.db?.tenantId || null;
  }
  
  // Si es SUPER_ADMIN y tiene tenantId, usarlo
  if (extendedReq.db?.tenantId) {
    return extendedReq.db.tenantId;
  }
  
  // Si es SUPER_ADMIN sin tenantId, buscar el primer tenant disponible
  console.log('[TENANT_BYPASS] SUPER_ADMIN without tenantId, selecting first available tenant');
  const firstTenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true }
  });
  
  if (firstTenant) {
    console.log('[TENANT_BYPASS] Selected tenant for SUPER_ADMIN:', firstTenant.id);
    return firstTenant.id;
  }
  
  console.log('[TENANT_BYPASS] No active tenant found for SUPER_ADMIN');
  return null;
}
