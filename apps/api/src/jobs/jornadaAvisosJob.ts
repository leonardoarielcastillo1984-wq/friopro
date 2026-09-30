// ──────────────────────────────────────────────────────────────────────────
// Job periódico: avisos de duración de jornada (anticipado + exceso).
// Recorre los tenants y delega en procesarAvisosJornada (jornadaService),
// que respeta la política vigente al abrir cada jornada (snapshot) y no
// duplica avisos (@@unique [jornadaId, tipo]).
// Intervalo: cada 15 minutos.
// ──────────────────────────────────────────────────────────────────────────

import { procesarAvisosJornada } from '../services/jornadaService.js';

const INTERVAL_MS = 15 * 60 * 1000;

export function startJornadaAvisosJob(prisma: any): void {
  const run = async () => {
    try {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      for (const t of tenants) {
        await procesarAvisosJornada(prisma, t.id).catch((e: any) =>
          console.error(`[JORNADA AVISOS] tenant ${t.id}:`, e?.message || e)
        );
      }
    } catch (e: any) {
      console.error('[JORNADA AVISOS] Error en ciclo:', e?.message || e);
    }
  };
  setInterval(run, INTERVAL_MS);
  setTimeout(run, 60 * 1000); // primera corrida 1 minuto después del arranque
}
