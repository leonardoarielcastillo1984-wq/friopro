import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Límites por plan (en bytes) ───────────────────────────────
const PLAN_STORAGE_LIMITS: Record<string, number> = {
  BASIC:        1  * 1024 * 1024 * 1024, //  1 GB
  PROFESSIONAL: 5  * 1024 * 1024 * 1024, //  5 GB
  PREMIUM:      20 * 1024 * 1024 * 1024, // 20 GB
};

const DEFAULT_LIMIT = PLAN_STORAGE_LIMITS.BASIC;

// ─── Calcular tamaño total de un directorio recursivamente ─────
async function getDirSize(dirPath: string): Promise<number> {
  let total = 0;
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return 0; // directorio no existe aún
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

// ─── Obtener límite del plan actual del tenant ─────────────────
export async function getStorageLimit(prisma: any, tenantId: string): Promise<number> {
  const sub = await prisma.tenantSubscription.findFirst({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub?.plan?.tier) return DEFAULT_LIMIT;
  return PLAN_STORAGE_LIMITS[sub.plan.tier] ?? DEFAULT_LIMIT;
}

// ─── Calcular uso real en disco ────────────────────────────────
export async function getStorageUsed(tenantId: string): Promise<number> {
  const base = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
  const tenantDir = join(base, tenantId);
  return getDirSize(tenantDir);
}

// ─── Obtener uso completo formateado ──────────────────────────
export async function getStorageUsage(prisma: any, tenantId: string) {
  const [used, limit] = await Promise.all([
    getStorageUsed(tenantId),
    getStorageLimit(prisma, tenantId),
  ]);
  const percentage = limit > 0 ? Math.round((used / limit) * 100 * 100) / 100 : 0;
  return { used, limit, percentage };
}

// ─── Validar si hay espacio para subir más bytes ───────────────
export async function checkStorageQuota(
  prisma: any,
  tenantId: string,
  incomingBytes: number,
): Promise<{ allowed: boolean; used: number; limit: number; percentage: number }> {
  const { used, limit, percentage } = await getStorageUsage(prisma, tenantId);
  const allowed = used + incomingBytes <= limit;
  return { allowed, used, limit, percentage };
}
