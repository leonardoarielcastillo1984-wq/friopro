// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Registro unificado de ejecuciones de mantenimiento.
// Punto único usado por: "Registrar mantenimiento ejecutado",
// cierre de OT (web y QR del mecánico) y ejecución directa de plan.
//
// Reglas:
// - Solo se actualizan las tareas efectivamente realizadas (vínculo
//   explícito por ID: WorkOrderTask → MaintenancePlan → ejecución).
// - Idempotente: cada ejecución tiene sourceKey única; reintentos,
//   doble clic y re-cierres no duplican avances, historial ni stock.
// - Intervalo dual: triggerKm (km) + frecuenciaDias (días) conviven;
//   vence por el primero que se alcance.
// - Una tarea con pata en km exige el odómetro real para confirmarse.
// - Una ejecución histórica se registra pero NO desplaza una
//   referencia posterior válida (referenciaAplicada=false).
// ═══════════════════════════════════════════════════════════════

const MS_DIA = 86400000;

// ── Patas del intervalo del plan ──
export function pataKmDelPlan(plan: any): number | null {
  return plan?.triggerKm ? Number(plan.triggerKm) : null;
}
export function pataDiasDelPlan(plan: any): number | null {
  if (plan?.frecuenciaDias) return plan.frecuenciaDias;
  if (plan?.frequencyUnit === 'DAYS') return plan.frequencyValue;
  if (plan?.frequencyUnit === 'WEEKS') return plan.frequencyValue * 7;
  if (plan?.frequencyUnit === 'MONTHS') return plan.frequencyValue * 30;
  if (plan?.frequencyUnit === 'YEARS') return plan.frequencyValue * 365;
  return null;
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_DIA);
}

// ── Estado de vencimiento de un plan (fuente única para cronograma,
//    alertas, ficha y proyección). "primero que ocurra" = OR. ──
export function evaluarVencimientoPlan(plan: any, currentOdometer: number | null, now = new Date()) {
  const triggerKm = pataKmDelPlan(plan);
  const frecDias = pataDiasDelPlan(plan);

  const proximoKm = triggerKm != null && plan.lastOdometerExecution != null
    ? plan.lastOdometerExecution + triggerKm
    : null;
  const kmRestantes = proximoKm != null && currentOdometer != null
    ? Math.round(proximoKm - currentOdometer)
    : null;

  const diasRestantes = plan.nextExecutionDate
    ? Math.ceil((new Date(plan.nextExecutionDate).getTime() - now.getTime()) / MS_DIA)
    : null;

  const vencidoPorKm = kmRestantes != null && kmRestantes <= 0;
  const vencidoPorFecha = diasRestantes != null && diasRestantes <= 0;
  const vencido = vencidoPorKm || vencidoPorFecha;
  const motivo = vencidoPorKm && vencidoPorFecha ? 'KM_Y_FECHA'
    : vencidoPorKm ? 'KM' : vencidoPorFecha ? 'FECHA' : null;

  // Evaluabilidad: sin referencias no se puede calcular → pendiente de datos.
  const evaluable = proximoKm != null || plan.nextExecutionDate != null;
  return {
    vencido, motivo, evaluable,
    kmRestantes, diasRestantes, proximoKm,
    proximaFecha: plan.nextExecutionDate ?? null,
    intervaloKm: triggerKm, intervaloDias: frecDias,
  };
}

export type ResultadoEjecucion =
  | { status: 'APLICADA'; plan: any; referenciaAplicada: boolean }
  | { status: 'DUPLICADA'; plan: any }
  | { status: 'PENDIENTE_KM'; plan: any; motivo: string }
  | { status: 'SIN_PLAN'; motivo: string };

// ── Registra UNA ejecución de un plan (tarea) dentro de una transacción ──
export async function registrarEjecucionPlan(tx: any, opts: {
  tenantId: string;
  planId: string;
  workOrderId?: string | null;
  executedAt: Date;
  odometro?: number | null;
  notes?: string | null;
  registradoPor?: string | null;
  sourceKey?: string | null;
}): Promise<ResultadoEjecucion> {
  const { tenantId, planId, workOrderId, executedAt, odometro, notes, registradoPor } = opts;
  const plan = await tx.maintenancePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) return { status: 'SIN_PLAN', motivo: 'Plan no encontrado o de otro tenant' };

  // Clave de idempotencia: por OT+plan (soporta OT multi-tarea) o explícita.
  const sourceKey = opts.sourceKey || (workOrderId ? `ot:${workOrderId}|${planId}` : null);
  if (sourceKey) {
    const dup = await tx.maintenancePlanExecution.findFirst({ where: { sourceKey } });
    if (dup) return { status: 'DUPLICADA', plan };
  }

  // Una tarea cuyo intervalo depende de km exige el odómetro real:
  // no se confirma ni se recalcula sin él, ni se inventa el actual.
  const requiereKm = pataKmDelPlan(plan) != null;
  if (requiereKm && odometro == null) {
    return { status: 'PENDIENTE_KM', plan, motivo: 'Falta el kilometraje de ejecución para una tarea con intervalo en km' };
  }

  // Ejecución histórica: se registra, pero si hay una referencia posterior
  // válida (fecha mayor o misma fecha con mayor odómetro) no la desplaza.
  let referenciaAplicada = true;
  if (plan.lastExecutionDate) {
    const refFecha = new Date(plan.lastExecutionDate);
    if (executedAt.getTime() < refFecha.getTime()) referenciaAplicada = false;
    else if (executedAt.getTime() === refFecha.getTime() && odometro != null
      && plan.lastOdometerExecution != null && odometro < plan.lastOdometerExecution) {
      referenciaAplicada = false;
    }
  }

  const data: any = { lastExecutionDate: executedAt, totalExecutions: { increment: 1 } };

  if (referenciaAplicada) {
    if (requiereKm) {
      // odometro validado arriba (no nulo)
      data.lastOdometerExecution = odometro;
    }
    const frecDias = pataDiasDelPlan(plan);
    if (frecDias != null) {
      if (plan.intervaloModo === 'CALENDARIO_FIJO' && plan.nextExecutionDate) {
        // Calendario fijo: conserva la periodicidad desde la fecha programada;
        // un solo paso (no se inventan ejecuciones para períodos omitidos).
        data.nextExecutionDate = sumarDias(new Date(plan.nextExecutionDate), frecDias);
      } else {
        // Política por defecto: intervalo desde la ejecución real.
        data.nextExecutionDate = sumarDias(executedAt, frecDias);
      }
    } else if (requiereKm && plan.nextExecutionDate && new Date(plan.nextExecutionDate) <= executedAt) {
      // Plan solo-km: limpia el marcador "vencido" que verificarPlanesKm*
      // podía haber escrito en nextExecutionDate.
      data.nextExecutionDate = null;
    }
  }

  try {
    await tx.maintenancePlan.update({ where: { id: planId }, data });
    await tx.maintenancePlanExecution.create({
      data: {
        planId, workOrderId: workOrderId ?? null, executedAt,
        odometroEjecucion: odometro ?? null,
        sourceKey, referenciaAplicada,
        registradoPor: registradoPor ?? null,
        notes: notes || null,
      },
    });
    const planNuevo = await tx.maintenancePlan.findUnique({ where: { id: planId } });
    return { status: 'APLICADA', plan: planNuevo ?? plan, referenciaAplicada };
  } catch (e: any) {
    // Choque de unicidad en sourceKey (concurrencia): es un duplicado, no un error.
    if (e?.code === 'P2002') return { status: 'DUPLICADA', plan };
    throw e;
  }
}

// ── Aplica el cierre de una OT: tareas realizadas, planes, historial ──
// Debe llamarse dentro de prisma.$transaction. Devuelve resumen por tarea.
export async function aplicarEjecucionesOT(tx: any, opts: {
  tenantId: string;
  workOrder: any;                       // OT ya actualizada a COMPLETED
  executedAt: Date;
  odometro?: number | null;
  registradoPor?: string | null;
  tareas?: { planId: string; status: 'COMPLETED' | 'SKIPPED' }[] | null;
}): Promise<{
  aplicadas: { planId: string; title: string; referenciaAplicada: boolean }[];
  pendientesKm: { planId: string; title: string }[];
  duplicadas: { planId: string; title: string }[];
  omitidas: { planId: string; title: string }[];
  sinVinculo: boolean;
}> {
  const { tenantId, workOrder, executedAt, odometro, registradoPor, tareas } = opts;
  const res = { aplicadas: [] as any[], pendientesKm: [] as any[], duplicadas: [] as any[], omitidas: [] as any[], sinVinculo: true };

  // Materializar tareas: si la OT no tiene WorkOrderTask pero sí planId
  // (creada antes de esta funcionalidad), se materializa una tarea PENDING.
  let tareasOT: any[] = await tx.workOrderTask.findMany({ where: { workOrderId: workOrder.id, tenantId } });
  if (tareasOT.length === 0 && workOrder.planId) {
    await tx.workOrderTask.create({
      data: { tenantId, workOrderId: workOrder.id, planId: workOrder.planId, status: 'PENDING' },
    });
    tareasOT = await tx.workOrderTask.findMany({ where: { workOrderId: workOrder.id, tenantId } });
  }

  if (tareasOT.length === 0) return res; // OT sin tareas preventivas: nada que avanzar
  res.sinVinculo = false;

  // Qué tareas se confirman: si el cliente envió estados explícitos se respetan;
  // si no, se completan las PENDING (comportamiento heredado de cierre simple).
  const estados = new Map<string, 'COMPLETED' | 'SKIPPED'>();
  for (const t of tareas ?? []) estados.set(t.planId, t.status);
  const decisionExplicita = (tareas ?? []).length > 0;

  for (const tarea of tareasOT) {
    if (tarea.status !== 'PENDING') {
      // Ya procesada antes: no re-ejecutar (idempotencia de re-cierre).
      if (tarea.status === 'COMPLETED') {
        const plan = await tx.maintenancePlan.findFirst({ where: { id: tarea.planId, tenantId } });
        if (plan) res.duplicadas.push({ planId: tarea.planId, title: plan.title });
      }
      continue;
    }
    const decision = decisionExplicita ? (estados.get(tarea.planId) ?? 'PENDING') : 'COMPLETED';
    if (decision === 'PENDING') continue; // queda pendiente, no avanza

    if (decision === 'SKIPPED') {
      await tx.workOrderTask.update({ where: { id: tarea.id }, data: { status: 'SKIPPED' } });
      const plan = await tx.maintenancePlan.findFirst({ where: { id: tarea.planId, tenantId } });
      if (plan) res.omitidas.push({ planId: tarea.planId, title: plan.title });
      continue;
    }

    const r = await registrarEjecucionPlan(tx, {
      tenantId, planId: tarea.planId, workOrderId: workOrder.id,
      executedAt, odometro, registradoPor,
      notes: `Completada vía OT ${workOrder.code}`,
    });
    if (r.status === 'APLICADA') {
      await tx.workOrderTask.update({ where: { id: tarea.id }, data: { status: 'COMPLETED', completedAt: executedAt } });
      res.aplicadas.push({ planId: tarea.planId, title: r.plan.title, referenciaAplicada: r.referenciaAplicada });
    } else if (r.status === 'DUPLICADA') {
      await tx.workOrderTask.update({ where: { id: tarea.id }, data: { status: 'COMPLETED', completedAt: executedAt } });
      res.duplicadas.push({ planId: tarea.planId, title: r.plan.title });
    } else if (r.status === 'PENDIENTE_KM') {
      // La tarea queda PENDING: el cierre se reporta como parcial.
      res.pendientesKm.push({ planId: tarea.planId, title: r.plan.title });
    }
  }
  return res;
}
