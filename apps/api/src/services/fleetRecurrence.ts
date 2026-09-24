// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Detección de reparaciones recurrentes por componente.
// Lógica compartida: la usan las rutas /fleet-recurrence y el hook
// de applyWorkOrderUpdate (maintenance.ts) al completar una OT.
//
// Reglas:
// - Cuenta intervenciones reales = OTs completadas vinculadas al
//   componente con clasificación CONFIRMADA (nunca renglones de
//   repuestos ni clasificaciones sugeridas sin confirmar).
// - Excluye OTs CANCELLED y, si la regla es soloFallas, también
//   PREVENTIVE/PREDICTIVE (mantenimiento programado ≠ reparación).
// - No duplica casos abiertos del mismo vehículo+componente+regla.
// - Una instancia nueva no hereda recurrencias de la retirada:
//   cuando hay instancia vigente, solo cuentan los vínculos a esa
//   instancia (o sin instancia asignada, que se reportan como dato
//   faltante, no como hecho verificado).
// ═══════════════════════════════════════════════════════════════

const TIPOS_FALLA = ['CORRECTIVE', 'EMERGENCY'];
const TIPOS_PROGRAMADO = ['PREVENTIVE', 'PREDICTIVE'];

export interface EvaluacionComponente {
  componentId: string;
  intervenciones: number;
  reglaDisparada: any | null;
  casoAbierto: any | null;
  casoCreado: boolean;
  datosFaltantes: string[];
}

/**
 * Instancia vigente de un componente en un vehículo
 * (instalación con removedAt null).
 */
export async function instanciaVigente(prisma: any, tenantId: string, vehiculoId: string, componentId: string) {
  const inst = await prisma.fleetComponentInstallation.findFirst({
    where: { tenantId, vehiculoId, removedAt: null, instance: { componentId } },
    include: { instance: true },
    orderBy: { installedAt: 'desc' },
  });
  return inst?.instance ?? null;
}

/**
 * Intervenciones reales de un componente en un vehículo dentro de una ventana.
 * Devuelve los vínculos (con su OT) que cuentan para la regla.
 */
export async function intervencionesDelComponente(
  prisma: any,
  tenantId: string,
  vehiculoId: string,
  componentId: string,
  opts: { desde?: Date; soloFallas?: boolean; instanceId?: string | null; soloConfirmadas?: boolean } = {},
) {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: vehiculoId, tenantId },
    select: { maintenanceAssetId: true },
  });
  if (!vehiculo?.maintenanceAssetId) return [];

  const woWhere: any = {
    tenantId,
    assetId: vehiculo.maintenanceAssetId,
    status: 'COMPLETED', // intervención real = OT completada; excluye CANCELLED y abiertas
  };
  if (opts.soloFallas !== false) woWhere.type = { in: TIPOS_FALLA };
  if (opts.desde) woWhere.completedAt = { gte: opts.desde };

  const linkWhere: any = {
    tenantId,
    componentId,
    workOrder: woWhere,
  };
  if (opts.soloConfirmadas !== false) linkWhere.clasificacion = 'CONFIRMADA';
  if (opts.instanceId) linkWhere.instanceId = opts.instanceId;

  const links = await prisma.fleetWorkOrderComponent.findMany({
    where: linkWhere,
    include: {
      workOrder: { select: { id: true, code: true, title: true, type: true, status: true, completedAt: true, createdAt: true, totalCost: true, laborCost: true, partsCost: true, actualDuration: true } },
      instance: { select: { id: true, serialNumber: true } },
    },
    orderBy: { workOrder: { completedAt: 'asc' } },
  });

  // Deduplicar por OT: una OT con varios vínculos al mismo componente = 1 intervención
  const porOT = new Map<string, any>();
  for (const l of links) {
    if (!porOT.has(l.workOrderId)) porOT.set(l.workOrderId, l);
  }
  return [...porOT.values()];
}

/**
 * Evalúa las reglas activas de un componente en un vehículo y abre/actualiza
 * el caso de recurrencia si corresponde. Devuelve el resultado de la evaluación.
 */
export async function evaluarRecurrencia(
  prisma: any,
  tenantId: string,
  vehiculoId: string,
  componentId: string,
  ctx: { userId?: string | null; userName?: string | null } = {},
): Promise<EvaluacionComponente> {
  const reglas = await prisma.fleetRecurrenceRule.findMany({
    where: { tenantId, componentId, isActive: true },
  });
  const resultado: EvaluacionComponente = {
    componentId, intervenciones: 0, reglaDisparada: null, casoAbierto: null, casoCreado: false, datosFaltantes: [],
  };
  if (reglas.length === 0) return resultado;

  const instancia = await instanciaVigente(prisma, tenantId, vehiculoId, componentId);

  for (const regla of reglas) {
    const desde = new Date(Date.now() - regla.ventanaDias * 86400000);
    const faltantes: string[] = [];

    // Intervenciones de la instancia vigente (si existe). Si no hay instancia
    // registrada, se evalúan todos los vínculos confirmados del componente y
    // se marca la falta de trazabilidad de instancia como dato faltante.
    let intervenciones = await intervencionesDelComponente(prisma, tenantId, vehiculoId, componentId, {
      desde, soloFallas: regla.soloFallas, instanceId: instancia?.id ?? undefined,
    });
    if (!instancia) {
      intervenciones = await intervencionesDelComponente(prisma, tenantId, vehiculoId, componentId, {
        desde, soloFallas: regla.soloFallas,
      });
      if (intervenciones.length > 0) {
        faltantes.push('Sin instancia de componente registrada: no se puede separar el historial por pieza instalada');
      }
    }

    resultado.intervenciones = Math.max(resultado.intervenciones, intervenciones.length);
    if (intervenciones.length < regla.maxIntervenciones) continue;

    // Condición opcional de km entre intervenciones (solo si hay datos de odómetro)
    let kmOk = true;
    if (regla.kmMaxEntre != null) {
      // Los km entre intervenciones se estiman con el odómetro registrado en el historial del vehículo
      const historial = await prisma.vehiculoHistorialMantenimiento.findMany({
        where: { tenantId, vehiculoId, workOrderId: { in: intervenciones.map((l: any) => l.workOrderId) } },
        select: { workOrderId: true, odometro: true },
      });
      const kmPorOT = new Map(historial.map((h: any) => [h.workOrderId, h.odometro]));
      const kmsOrd = intervenciones.map((l: any) => kmPorOT.get(l.workOrderId)).filter((k: any) => k != null) as number[];
      if (kmsOrd.length >= 2) {
        const diffs = kmsOrd.slice(1).map((k, i) => k - kmsOrd[i]);
        kmOk = diffs.some((d) => d <= (regla.kmMaxEntre as number));
      } else {
        faltantes.push('Sin odómetro en las intervenciones: no se pudo evaluar la condición de km entre fallas');
      }
    }
    if (!kmOk) continue;

    // ¿Ya hay caso abierto para este vehículo+componente+regla?
    const casoAbierto = await prisma.fleetRecurrenceCase.findFirst({
      where: { tenantId, vehiculoId, componentId, ruleId: regla.id, status: { not: 'CERRADO' } },
    });

    const motivo = `${intervenciones.length} intervenciones en ${regla.ventanaDias} días sobre «${(await prisma.fleetComponent.findFirst({ where: { id: componentId, tenantId }, select: { nombre: true } }))?.nombre ?? 'componente'}» (umbral configurado: ${regla.maxIntervenciones})${regla.soloFallas ? ' — solo reparaciones por falla' : ''}`;

    if (casoAbierto) {
      // Actualizar el caso existente: nueva intervención actualiza, no duplica
      await prisma.fleetRecurrenceCase.update({
        where: { id: casoAbierto.id },
        data: {
          motivoResumen: motivo,
          datosFaltantes: faltantes,
          instanceId: casoAbierto.instanceId ?? instancia?.id ?? null,
        },
      });
      await prisma.fleetCaseEvent.create({
        data: {
          tenantId, caseId: casoAbierto.id, tipo: 'DETECCION',
          detalle: `Nueva intervención registrada — ${motivo}`,
          userId: ctx.userId ?? null, userName: ctx.userName ?? null,
        },
      });
      resultado.casoAbierto = casoAbierto;
      resultado.reglaDisparada = regla;
      resultado.datosFaltantes = faltantes;
    } else {
      const caso = await prisma.fleetRecurrenceCase.create({
        data: {
          tenantId, vehiculoId, componentId,
          instanceId: instancia?.id ?? null,
          ruleId: regla.id,
          status: 'DETECTADO',
          motivoResumen: motivo,
          datosFaltantes: faltantes,
        },
      });
      await prisma.fleetCaseEvent.create({
        data: {
          tenantId, caseId: caso.id, tipo: 'DETECCION',
          detalle: `Caso abierto por regla — ${motivo}`,
          userId: ctx.userId ?? null, userName: ctx.userName ?? null,
        },
      });
      resultado.casoAbierto = caso;
      resultado.casoCreado = true;
      resultado.reglaDisparada = regla;
      resultado.datosFaltantes = faltantes;
    }
  }
  return resultado;
}

/**
 * Hook al completar una OT: si la OT tiene vínculos a componentes,
 * evalúa recurrencia para cada componente del vehículo afectado.
 * No bloquea ni rompe el flujo principal (errores solo se loguean).
 */
export async function evaluarRecurrenciasDeOT(prisma: any, tenantId: string, workOrderId: string, assetId: string | null) {
  try {
    if (!assetId) return;
    const vehiculo = await prisma.vehiculo.findFirst({
      where: { maintenanceAssetId: assetId, tenantId },
      select: { id: true },
    });
    if (!vehiculo) return;

    const links = await prisma.fleetWorkOrderComponent.findMany({
      where: { tenantId, workOrderId, clasificacion: 'CONFIRMADA' },
      select: { componentId: true },
    });
    const componentes = [...new Set<string>(links.map((l: any) => l.componentId as string))];
    for (const componentId of componentes) {
      await evaluarRecurrencia(prisma, tenantId, vehiculo.id, componentId);
    }
  } catch (e: any) {
    console.error('[fleet-recurrence] evaluarRecurrenciasDeOT error:', e?.message || e);
  }
}

/**
 * Horas de inmovilización atribuibles a una OT, desde los eventos de estado
 * del vehículo (EN_TALLER / EN_REPARACION vinculados a la OT). Si la OT está
 * vinculada a N componentes, la parada se reparte entre ellos (no se le
 * atribuye toda la parada a cada componente).
 */
export async function horasParadaPorOT(prisma: any, tenantId: string, vehiculoId: string, workOrderIds: string[]) {
  if (workOrderIds.length === 0) return new Map<string, number>();
  const eventos = await prisma.vehiculoEstadoEvento.findMany({
    where: { tenantId, vehiculoId },
    orderBy: { createdAt: 'asc' },
    select: { estado: true, workOrderId: true, createdAt: true },
  });
  const now = Date.now();
  const horasPorOT = new Map<string, number>();
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    if (!e.workOrderId || !workOrderIds.includes(e.workOrderId)) continue;
    if (!['EN_TALLER', 'EN_REPARACION'].includes(e.estado)) continue;
    const hasta = i + 1 < eventos.length ? new Date(eventos[i + 1].createdAt).getTime() : now;
    const horas = Math.max(0, (hasta - new Date(e.createdAt).getTime()) / 3600000);
    horasPorOT.set(e.workOrderId, (horasPorOT.get(e.workOrderId) || 0) + horas);
  }
  return horasPorOT;
}

/**
 * Evalúa el seguimiento de un caso EN_SEGUIMIENTO:
 * - RECURRENCIA si hubo nuevas intervenciones confirmadas del componente
 *   (en la instancia nueva si se reemplazó) después de ejecutar la acción.
 * - SIN_RECURRENCIA si se cumplió la revisión (días o km) sin nuevas fallas.
 * - PENDIENTE si aún no hay suficiente uso observado.
 */
export async function evaluarSeguimiento(prisma: any, tenantId: string, caso: any) {
  if (!caso.accionEjecutadaAt) {
    return { resultado: 'PENDIENTE', detalle: 'Acción aprobada sin fecha de ejecución registrada', kmObservados: null, diasObservados: null, nuevasIntervenciones: 0 };
  }
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: caso.vehiculoId, tenantId },
    select: { currentOdometer: true },
  });
  const diasObservados = Math.floor((Date.now() - new Date(caso.accionEjecutadaAt).getTime()) / 86400000);
  const kmObservados = caso.accionEjecutadaKm != null && vehiculo?.currentOdometer != null
    ? Math.max(0, vehiculo.currentOdometer - caso.accionEjecutadaKm)
    : null;

  // Nuevas intervenciones del componente post-acción (en la instancia nueva si existe)
  const nuevas = await intervencionesDelComponente(prisma, tenantId, caso.vehiculoId, caso.componentId, {
    desde: new Date(caso.accionEjecutadaAt),
    soloFallas: caso.rule?.soloFallas ?? true,
    instanceId: caso.instanciaNuevaId ?? undefined,
  });
  const nuevasCount = caso.instanciaNuevaId
    ? nuevas.length
    : (await intervencionesDelComponente(prisma, tenantId, caso.vehiculoId, caso.componentId, {
        desde: new Date(caso.accionEjecutadaAt), soloFallas: caso.rule?.soloFallas ?? true,
      })).length;

  if (nuevasCount > 0) {
    return {
      resultado: 'RECURRENCIA',
      detalle: `${nuevasCount} nueva(s) intervención(es) del componente después de la acción`,
      kmObservados, diasObservados, nuevasIntervenciones: nuevasCount,
    };
  }

  const cumplioDias = caso.revisionDias != null && diasObservados >= caso.revisionDias;
  const cumplioKm = caso.revisionKm != null && kmObservados != null && kmObservados >= caso.revisionKm;
  if (cumplioDias || cumplioKm) {
    return {
      resultado: 'SIN_RECURRENCIA',
      detalle: `Sin nuevas intervenciones del componente durante ${diasObservados} días${kmObservados != null ? ` y ${Math.round(kmObservados).toLocaleString('es-AR')} km` : ''} observados. No implica vida útil garantizada.`,
      kmObservados, diasObservados, nuevasIntervenciones: 0,
    };
  }

  return {
    resultado: 'PENDIENTE',
    detalle: `Observación insuficiente: ${diasObservados} días${kmObservados != null ? `, ${Math.round(kmObservados).toLocaleString('es-AR')} km` : ', km no disponible'} desde la acción${caso.revisionDias ? ` (revisión a los ${caso.revisionDias} días` : ''}${caso.revisionKm ? `${caso.revisionDias ? ' o' : ' (revisión a los'} ${caso.revisionKm.toLocaleString('es-AR')} km` : ''}${caso.revisionDias || caso.revisionKm ? ')' : ''}`,
    kmObservados, diasObservados, nuevasIntervenciones: 0,
  };
}
