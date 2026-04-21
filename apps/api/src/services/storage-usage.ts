import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Límites por plan (en bytes) ───────────────────────────────
export const PLAN_STORAGE_LIMITS: Record<string, number> = {
  BASIC:        1  * 1024 * 1024 * 1024, //  1 GB
  PROFESSIONAL: 5  * 1024 * 1024 * 1024, //  5 GB
  PREMIUM:      20 * 1024 * 1024 * 1024, // 20 GB
};

const DEFAULT_LIMIT = PLAN_STORAGE_LIMITS.BASIC;

// ─── Calcular tamaño real en disco (solo para reconciliación) ──
export async function getDirSize(dirPath: string): Promise<number> {
  let total = 0;
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dirPath, entry);
    try {
      const info = await stat(full);
      if (info.isDirectory()) {
        total += await getDirSize(full);
      } else {
        total += info.size;
      }
    } catch {
      // archivo puede haber desaparecido entre readdir y stat
    }
  }
  return total;
}

// ─── Obtener límite del plan ────────────────────────────────────
export async function getStorageLimit(prisma: any, tenantId: string): Promise<number> {
  const sub = await prisma.tenantSubscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
    include: { plan: true },
  });
  if (!sub?.plan) return DEFAULT_LIMIT;

  // Intentar leer limits.storage (en MB) del plan
  const planLimits = sub.plan.limits as Record<string, number> | null;
  if (planLimits?.storage) {
    if (planLimits.storage === -1) return PLAN_STORAGE_LIMITS.PREMIUM; // ilimitado → cap 20GB
    return planLimits.storage * 1024 * 1024; // MB → bytes
  }

  // Fallback por tier
  return PLAN_STORAGE_LIMITS[sub.plan.tier] ?? DEFAULT_LIMIT;
}

// ─── Leer storageUsed desde DB (sin tocar disco) ───────────────
export async function getStorageUsedFromDb(prisma: any, tenantId: string): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storageUsed: true },
  });
  if (!tenant) return 0;
  return Number(tenant.storageUsed);
}

// ─── Incrementar uso al subir archivo ──────────────────────────
export async function incrementStorageUsed(prisma: any, tenantId: string, bytes: number): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { storageUsed: { increment: bytes } },
  });
}

// ─── Decrementar uso al eliminar archivo ───────────────────────
export async function decrementStorageUsed(prisma: any, tenantId: string, bytes: number): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storageUsed: true },
  });
  const current = tenant ? Number(tenant.storageUsed) : 0;
  const newValue = Math.max(0, current - bytes);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { storageUsed: newValue },
  });
}

// ─── Obtener uso completo (DB) ─────────────────────────────────
export async function getStorageUsage(prisma: any, tenantId: string) {
  const [used, limit] = await Promise.all([
    getStorageUsedFromDb(prisma, tenantId),
    getStorageLimit(prisma, tenantId),
  ]);
  const percentage = limit > 0 ? Math.round((used / limit) * 100 * 100) / 100 : 0;
  return { used, limit, percentage };
}

// ─── Validar cuota antes de subir ─────────────────────────────
export async function checkStorageQuota(
  prisma: any,
  tenantId: string,
  incomingBytes: number,
): Promise<{ allowed: boolean; used: number; limit: number; percentage: number }> {
  const { used, limit, percentage } = await getStorageUsage(prisma, tenantId);
  const allowed = used + incomingBytes <= limit;
  return { allowed, used, limit, percentage };
}

// ─── Reconciliar DB contra disco real ─────────────────────────
export async function reconcileStorageForTenant(prisma: any, tenantId: string): Promise<{ before: number; after: number; diff: number }> {
  const base = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
  const tenantDir = join(base, tenantId);
  const realSize = await getDirSize(tenantDir);
  const dbSize = await getStorageUsedFromDb(prisma, tenantId);

  if (realSize !== dbSize) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { storageUsed: realSize },
    });
    console.log(`[STORAGE RECONCILE] tenant=${tenantId} db=${dbSize} disk=${realSize} diff=${realSize - dbSize}`);
  }
  return { before: dbSize, after: realSize, diff: realSize - dbSize };
}
