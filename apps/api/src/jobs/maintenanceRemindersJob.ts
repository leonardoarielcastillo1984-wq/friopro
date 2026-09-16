// ──────────────────────────────────────────────────────────────
// Cron diario: recordatorios de mantenimiento preventivo
// Detecta planes vencidos o próximos a vencer (por fecha o por km)
// y envía un digest a los admins del tenant.
// Se ejecuta una vez por día a las 11:00 UTC (08:00 ART aprox.)
// ──────────────────────────────────────────────────────────────

import { notifyPreventiveReminder, notifyOtsEscalated } from '../services/notifyService.js';

const HOUR_TO_RUN_UTC = 11;
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const REMINDER_THROTTLE_MS = 3 * MS_IN_DAY; // máx. 1 recordatorio cada 3 días por plan
const UPCOMING_DAYS = 7;                    // avisar si vence dentro de 7 días
const UPCOMING_KM_PCT = 0.1;                // avisar al 90% del intervalo km
const OT_OVERDUE_DAYS = 2;                  // escalar OTs vencidas hace más de 2 días
const OT_ESCALATION_THROTTLE_MS = 3 * MS_IN_DAY;

const PRIORITY_LADDER: Record<string, string> = {
  LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'CRITICAL', CRITICAL: 'CRITICAL',
};

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(HOUR_TO_RUN_UTC, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export function startMaintenanceRemindersJob(prisma: any): void {
  const run = async () => {
    console.log('[MAINT REMINDERS] Starting daily check...');
    try {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });

      const now = new Date();
      const throttleLimit = new Date(now.getTime() - REMINDER_THROTTLE_MS);
      let totalNotified = 0;
      let totalEscalated = 0;

      for (const tenant of tenants) {
        try {
          const planes = await prisma.maintenancePlan.findMany({
            where: {
              tenantId: tenant.id,
              status: 'ACTIVE',
              OR: [
                { lastReminderSentAt: null },
                { lastReminderSentAt: { lt: throttleLimit } },
              ],
            },
            include: { asset: { select: { name: true, currentOdometer: true } } },
          });

          const pendientes: Array<{ planId: string; title: string; code: string; assetName?: string | null; estado: 'VENCIDO' | 'PROXIMO'; detalle: string }> = [];

          for (const p of planes) {
            let estado: 'VENCIDO' | 'PROXIMO' | null = null;
            let detalle = '';

            if (p.frequencyUnit === 'KM' && p.triggerKm) {
              const kmActual = p.asset?.currentOdometer;
              if (kmActual != null) {
                const base = p.lastOdometerExecution ?? 0;
                const restante = (base + p.triggerKm) - kmActual;
                detalle = `Cada ${p.triggerKm.toLocaleString('es-AR')} km · faltan ${Math.max(0, Math.round(restante)).toLocaleString('es-AR')} km (actual: ${Math.round(kmActual).toLocaleString('es-AR')} km)`;
                if (restante <= 0) estado = 'VENCIDO';
                else if (restante <= Math.max(500, p.triggerKm * UPCOMING_KM_PCT)) estado = 'PROXIMO';
              }
            } else if (p.nextExecutionDate) {
              const dias = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
              detalle = `Próxima ejecución: ${new Date(p.nextExecutionDate).toLocaleDateString('es-AR')} (${dias < 0 ? `venció hace ${-dias} días` : `en ${dias} días`})`;
              if (dias < 0) estado = 'VENCIDO';
              else if (dias <= UPCOMING_DAYS) estado = 'PROXIMO';
            }

            if (estado) {
              pendientes.push({ planId: p.id, title: p.title, code: p.code, assetName: p.asset?.name ?? null, estado, detalle });
            }
          }

          if (pendientes.length > 0) {
            await notifyPreventiveReminder(prisma, { tenantId: tenant.id, planes: pendientes });
            await prisma.maintenancePlan.updateMany({
              where: { id: { in: pendientes.map(p => p.planId) } },
              data: { lastReminderSentAt: now },
            });
            totalNotified += pendientes.length;
          }

          // ── Escalado de OTs vencidas ──
          const otThrottle = new Date(now.getTime() - OT_ESCALATION_THROTTLE_MS);
          const limiteVencida = new Date(now.getTime() - OT_OVERDUE_DAYS * MS_IN_DAY);
          const otsVencidas = await prisma.workOrder.findMany({
            where: {
              tenantId: tenant.id,
              status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] },
              scheduledDate: { lt: limiteVencida },
              OR: [{ escalatedAt: null }, { escalatedAt: { lt: otThrottle } }],
            },
            include: { asset: { select: { name: true } } },
          });

          if (otsVencidas.length > 0) {
            const escaladas: Array<{ otId: string; code: string; title: string; assetName?: string | null; diasVencida: number; nuevaPrioridad: string }> = [];
            for (const ot of otsVencidas) {
              const nuevaPrioridad = PRIORITY_LADDER[ot.priority] || 'HIGH';
              const diasVencida = Math.floor((now.getTime() - new Date(ot.scheduledDate).getTime()) / MS_IN_DAY);
              await prisma.workOrder.update({
                where: { id: ot.id },
                data: { priority: nuevaPrioridad, escalatedAt: now },
              });
              escaladas.push({ otId: ot.id, code: ot.code, title: ot.title, assetName: ot.asset?.name ?? null, diasVencida, nuevaPrioridad });
            }
            await notifyOtsEscalated(prisma, { tenantId: tenant.id, ots: escaladas });
            totalEscalated += escaladas.length;
          }
        } catch (err) {
          console.error(`[MAINT REMINDERS] Error on tenant ${tenant.id}:`, err);
        }
      }

      console.log(`[MAINT REMINDERS] Done. ${tenants.length} tenants checked, ${totalNotified} plans notified, ${totalEscalated} OTs escalated.`);
    } catch (err) {
      console.error('[MAINT REMINDERS] Fatal error:', err);
    }
  };

  const delay = msUntilNextRun();
  console.log(`[MAINT REMINDERS] First run scheduled in ${Math.round(delay / 1000 / 60)} minutes.`);

  setTimeout(() => {
    run();
    setInterval(run, MS_IN_DAY);
  }, delay);
}
