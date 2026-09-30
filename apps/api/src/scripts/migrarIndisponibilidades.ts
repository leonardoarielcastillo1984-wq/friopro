// ═══════════════════════════════════════════════════════════════
// MIGRACIÓN FLOTA 360 — VehiculoEstadoEvento → UnidadIndisponibilidad
//
// Qué hace (idempotente, por unidad):
//  1) Lee el historial de VehiculoEstadoEvento de cada unidad.
//  2) Agrupa cada tramo no-OPERATIVO en un episodio: el evento que
//     entra abre el episodio; el evento OPERATIVO siguiente lo cierra.
//     Cambios EN_TALLER↔EN_REPARACION dentro del tramo = etapas.
//  3) Unidades con estado no operativo pero SIN historial de eventos:
//     no se inventa una fecha — se crea un episodio ABIERTO con
//     ambiguo=true e inicioAt=updatedAt (referencia explícita).
//  4) Unidades con status='EN_TALLER' cuyo último evento es OPERATIVO
//     (estado quedó desincronizado): status pasa a ACTIVO — es el
//     espejo derivado, no una corrección silenciosa de historial.
//  5) Nada se borra: VehiculoEstadoEvento se conserva como fuente
//     histórica y auditoría.
//
// Uso:
//   DRY:   npx tsx src/scripts/migrarIndisponibilidades.ts --dry
//   REAL:  npx tsx src/scripts/migrarIndisponibilidades.ts
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const ETAPA_DE_ESTADO: Record<string, string> = {
  EN_TALLER: 'OTRO',            // no se sabe la fase real → OTRO + ambiguo
  EN_REPARACION: 'REPARACION_EN_CURSO',
};

async function main() {
  console.log(`[migración] Modo: ${DRY ? 'DRY-RUN (sin escritura)' : 'REAL'}`);

  const vehiculos = await prisma.vehiculo.findMany({
    select: {
      id: true, tenantId: true, dominio: true, status: true,
      estadoOperativo: true, updatedAt: true, maintenanceAssetId: true,
      estadoEventos: { orderBy: { createdAt: 'asc' } },
      indisponibilidades: { select: { id: true, estado: true } },
    },
  });
  console.log(`[migración] ${vehiculos.length} unidades`);

  let episodiosCreados = 0, etapasCreadas = 0, ambiguos = 0, statusCorregidos = 0, omitidas = 0;

  for (const v of vehiculos as any[]) {
    // Idempotencia: si ya tiene episodios, la unidad ya fue migrada
    if (v.indisponibilidades.length > 0) { omitidas++; continue; }

    const eventos = v.estadoEventos as any[];
    type Tramo = { inicio: Date; fin: Date | null; eventos: any[] };
    const tramos: Tramo[] = [];
    let abierto: Tramo | null = null;

    for (const e of eventos) {
      if (e.estado === 'OPERATIVO') {
        if (abierto) { abierto.fin = e.createdAt; tramos.push(abierto); abierto = null; }
      } else if (e.estado === 'EN_TALLER' || e.estado === 'EN_REPARACION' || e.estado === 'RESTRINGIDA') {
        if (abierto) abierto.eventos.push(e);
        else abierto = { inicio: e.createdAt, fin: null, eventos: [e] };
      }
    }
    if (abierto) tramos.push(abierto);

    // Sin historial pero con estado no operativo: episodio ambiguo
    // (inicioAt = updatedAt como referencia explícita, marcado ambiguo).
    if (tramos.length === 0) {
      const noOperativo = v.estadoOperativo !== 'OPERATIVO' || v.status === 'EN_TALLER';
      if (noOperativo && v.status !== 'BAJA' && v.status !== 'INACTIVO') {
        ambiguos++;
        if (!DRY) {
          await prisma.$transaction(async (tx: any) => {
            await tx.unidadIndisponibilidad.create({
              data: {
                tenantId: v.tenantId, vehiculoId: v.id,
                inicioAt: v.updatedAt, origen: 'MIGRACION',
                motivo: 'Estado no operativo heredado sin historial de eventos',
                ambiguo: true,
                observaciones: `Migración: la unidad figuraba "${v.estadoOperativo}/${v.status}" sin eventos. La fecha de inicio es una referencia (última actualización), no un dato real.`,
                etapas: {
                  create: {
                    tenantId: v.tenantId, etapa: v.estadoOperativo === 'EN_REPARACION' ? 'REPARACION_EN_CURSO' : 'OTRO',
                    comentario: 'Etapa reconstruida por migración — fase real desconocida',
                    inicioAt: v.updatedAt,
                  },
                },
              },
            });
            await tx.vehiculo.update({
              where: { id: v.id },
              data: { estadoOperativo: v.estadoOperativo === 'EN_REPARACION' ? 'EN_REPARACION' : 'EN_TALLER' },
            });
          });
        }
      }
      continue;
    }

    // Episodios desde eventos
    if (!DRY) {
      await prisma.$transaction(async (tx: any) => {
        for (const t of tramos) {
          const workOrderIds = [...new Set(t.eventos.map((e: any) => e.workOrderId).filter(Boolean))];
          const ep = await tx.unidadIndisponibilidad.create({
            data: {
              tenantId: v.tenantId, vehiculoId: v.id,
              inicioAt: t.inicio, finAt: t.fin,
              estado: t.fin ? 'CERRADA' : 'ABIERTA',
              origen: 'MIGRACION', ambiguo: true,
              motivo: t.eventos[0]?.notas || null,
              workOrderIds,
              observaciones: 'Episodio reconstruido desde eventos de estadío (migración). Las etapas reflejan los estados observados; la fase real de cada tramo es desconocida.',
              cierreMotivo: t.fin ? 'Evento OPERATIVO registrado' : null,
            },
          });
          episodiosCreados++;
          for (const [i, e] of t.eventos.entries()) {
            const siguiente = t.eventos[i + 1];
            await tx.unidadIndisponibilidadEtapa.create({
              data: {
                tenantId: v.tenantId, indisponibilidadId: ep.id,
                etapa: ETAPA_DE_ESTADO[e.estado] ?? 'OTRO',
                comentario: e.notas ?? `Migrado desde evento ${e.estado}`,
                inicioAt: e.createdAt,
                finAt: siguiente?.createdAt ?? t.fin,
                workOrderId: e.workOrderId ?? null,
                registradoPorName: e.createdByName ?? null,
              },
            });
            etapasCreadas++;
          }
        }

        // Estado derivado tras la migración
        const episodioAbierto = tramos.some((t) => t.fin == null);
        const restricciones = await tx.restriccionServicio.count({ where: { tenantId: v.tenantId, vehiculoId: v.id, activa: true } });
        const nuevoEstadoOp = episodioAbierto
          ? (tramos[tramos.length - 1].eventos.at(-1)?.estado === 'EN_REPARACION' ? 'EN_REPARACION' : 'EN_TALLER')
          : (restricciones > 0 ? 'RESTRINGIDA' : 'OPERATIVO');
        let nuevoStatus = v.status;
        if (v.status !== 'BAJA' && v.status !== 'INACTIVO') {
          nuevoStatus = episodioAbierto ? 'EN_TALLER' : 'ACTIVO';
          // EN_TALLER residual sin episodio abierto → ACTIVO (espejo derivado)
          if (v.status === 'EN_TALLER' && !episodioAbierto) statusCorregidos++;
        }
        if (nuevoEstadoOp !== v.estadoOperativo || nuevoStatus !== v.status) {
          await tx.vehiculo.update({ where: { id: v.id }, data: { estadoOperativo: nuevoEstadoOp, status: nuevoStatus } });
        }
      });
    } else {
      episodiosCreados += tramos.length;
      etapasCreadas += tramos.reduce((a, t) => a + t.eventos.length, 0);
    }
  }

  console.log(`[migración] Episodios: ${episodiosCreados} | Etapas: ${etapasCreadas} | Ambiguos sin historial: ${ambiguos} | status EN_TALLER→ACTIVO: ${statusCorregidos} | Ya migradas: ${omitidas}`);
}

main()
  .catch((e) => { console.error('[migración] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
