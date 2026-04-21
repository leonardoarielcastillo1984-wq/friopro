// ──────────────────────────────────────────────────────────────
// Cron diario: reconciliar storageUsed en DB contra disco real
// Se ejecuta una vez por día a las 03:00 UTC
// ──────────────────────────────────────────────────────────────

import { reconcileStorageForTenant } from '../services/storage-usage.js';

const HOUR_TO_RUN_UTC = 3;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(HOUR_TO_RUN_UTC, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export function startStorageReconcileJob(prisma: any): void {
  const run = async () => {
    console.log('[STORAGE RECONCILE] Starting daily reconciliation...');
    try {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      let corrected = 0;
      for (const tenant of tenants) {
        try {
          const result = await reconcileStorageForTenant(prisma, tenant.id);
          if (result.diff !== 0) corrected++;
        } catch (err) {
          console.error(`[STORAGE RECONCILE] Error on tenant ${tenant.id}:`, err);
        }
      }

      console.log(`[STORAGE RECONCILE] Done. ${tenants.length} tenants checked, ${corrected} corrected.`);
    } catch (err) {
      console.error('[STORAGE RECONCILE] Fatal error during reconciliation:', err);
    }
  };

  const delay = msUntilNextRun();
  console.log(`[STORAGE RECONCILE] First run scheduled in ${Math.round(delay / 1000 / 60)} minutes.`);

  setTimeout(() => {
    run();
    setInterval(run, MS_IN_DAY);
  }, delay);
}
