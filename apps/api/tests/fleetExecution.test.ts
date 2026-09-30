// Tests de aceptación del refactor de mantenimiento preventivo.
// Correr: node --import tsx --test tests/fleetExecution.test.ts
//
// Cobertura de escenarios A–L sobre el servicio unificado y la proyección:
//   A) OT con tareas seleccionadas: solo esas avanzan.
//   B) Intervención sin plan: ningún intervalo se reinicia.
//   C) OT parcial: tarea completada vs tarea pendiente.
//   D) Idempotencia: mismo sourceKey / re-cierre no duplica.
//   E) Registro histórico desfasado: se registra pero no desplaza referencia.
//   F) Validación: tarea con pata km sin odómetro → PENDIENTE_KM.
//   G) Intervalo dual km+días: vence por el primero; ambas patas se actualizan.
//   H) Calendario fijo: próxima desde la fecha programada, no desde ejecutada.
//   I) OT correctiva sin tareas: no toca planes.
//   J) Vencimiento: sin referencia de ejecución no es evaluable (sin datos ≠ vencido).
//   K) Proyección: match por texto NO cuenta como ejecución (solo sugerencia).
//   L) Consistencia: la misma ejecución alimenta historial/plan/proyección.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  registrarEjecucionPlan,
  aplicarEjecucionesOT,
  evaluarVencimientoPlan,
  pataKmDelPlan,
  pataDiasDelPlan,
} from '../src/services/fleetExecution.js';
import {
  ultimaEjecucionExplicita,
  sugerenciaPorTexto,
  COMPONENTES_DEF,
} from '../src/services/fleetProjection.js';

// ── Mock prisma en memoria (solo lo que usa fleetExecution) ──
function makeDb() {
  const plans = new Map<string, any>();
  const execs: any[] = [];
  const tasks = new Map<string, any>();

  const applyUpdate = (p: any, data: any) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'increment' in (v as any)) p[k] = (p[k] || 0) + (v as any).increment;
      else (p as any)[k] = v;
    }
  };

  const tx: any = {
    maintenancePlan: {
      findFirst: async ({ where }: any) => {
        const p = plans.get(where.id);
        return p && (where.tenantId == null || p.tenantId === where.tenantId) ? p : null;
      },
      findUnique: async ({ where }: any) => plans.get(where.id) ?? null,
      update: async ({ where, data }: any) => { const p = plans.get(where.id); applyUpdate(p, data); return p; },
    },
    maintenancePlanExecution: {
      findFirst: async ({ where }: any) => execs.find((e) => e.sourceKey === where.sourceKey) ?? null,
      create: async ({ data }: any) => {
        if (data.sourceKey && execs.some((e) => e.sourceKey === data.sourceKey)) {
          const e: any = new Error('Unique constraint failed'); e.code = 'P2002'; throw e;
        }
        execs.push(data); return data;
      },
    },
    workOrderTask: {
      findMany: async ({ where }: any) => [...tasks.values()].filter((t) => t.workOrderId === where.workOrderId && t.tenantId === where.tenantId),
      create: async ({ data }: any) => { data.id ||= randomUUID(); tasks.set(data.id, data); return data; },
      update: async ({ where, data }: any) => { const t = tasks.get(where.id); Object.assign(t, data); return t; },
    },
  };

  return { tx, plans, execs, tasks };
}

const TENANT = 'tenant-1';
const planKm = (over: any = {}) => ({
  id: 'plan-km', tenantId: TENANT, title: 'Cambio de aceite',
  frequencyUnit: 'KM', frequencyValue: 30000, triggerKm: 30000, frecuenciaDias: null,
  lastExecutionDate: null, lastOdometerExecution: null, nextExecutionDate: null,
  totalExecutions: 0, componentKey: 'aceite_motor', intervaloModo: 'DESDE_EJECUCION', ...over,
});
const planDias = (over: any = {}) => ({
  id: 'plan-dias', tenantId: TENANT, title: 'Revisión general',
  frequencyUnit: 'DAYS', frequencyValue: 180, triggerKm: null, frecuenciaDias: null,
  lastExecutionDate: null, lastOdometerExecution: null, nextExecutionDate: new Date('2026-01-01'),
  totalExecutions: 0, componentKey: null, intervaloModo: 'DESDE_EJECUCION', ...over,
});

// ── A) OT con tareas seleccionadas ──
test('A — solo las tareas seleccionadas avanzan su plan', async () => {
  const { tx, plans, tasks } = makeDb();
  plans.set('plan-km', planKm());
  plans.set('plan-dias', planDias());
  const woId = 'wo-1';
  tasks.set('t1', { id: 't1', tenantId: TENANT, workOrderId: woId, planId: 'plan-km', status: 'PENDING' });
  tasks.set('t2', { id: 't2', tenantId: TENANT, workOrderId: woId, planId: 'plan-dias', status: 'PENDING' });

  const res = await aplicarEjecucionesOT(tx, {
    tenantId: TENANT, workOrder: { id: woId, code: 'OT-001' },
    executedAt: new Date('2026-07-01'), odometro: 150000,
    tareas: [{ planId: 'plan-km', status: 'COMPLETED' }],
  });

  assert.equal(res.aplicadas.length, 1);
  assert.equal(res.aplicadas[0].planId, 'plan-km');
  assert.equal(plans.get('plan-km').lastOdometerExecution, 150000);
  // La tarea de días no marcada queda PENDING y su plan intacto
  assert.equal(tasks.get('t2').status, 'PENDING');
  assert.equal(plans.get('plan-dias').totalExecutions, 0);
});

// ── B) Intervención sin plan ──
test('B — intervención sin tareas no reinicia ningún intervalo', async () => {
  const { tx, plans, execs } = makeDb();
  plans.set('plan-km', planKm());
  const res = await aplicarEjecucionesOT(tx, {
    tenantId: TENANT, workOrder: { id: 'wo-2', code: 'OT-002' },
    executedAt: new Date('2026-07-01'), odometro: 150000,
  });
  assert.equal(res.sinVinculo, true);
  assert.equal(execs.length, 0);
  assert.equal(plans.get('plan-km').lastOdometerExecution, null);
});

// ── C) OT parcial: COMPLETED vs SKIPPED ──
test('C — OT parcial: COMPLETED avanza, SKIPPED no resetea', async () => {
  const { tx, plans, tasks } = makeDb();
  plans.set('plan-km', planKm());
  plans.set('plan-dias', planDias());
  tasks.set('t1', { id: 't1', tenantId: TENANT, workOrderId: 'wo-3', planId: 'plan-km', status: 'PENDING' });
  tasks.set('t2', { id: 't2', tenantId: TENANT, workOrderId: 'wo-3', planId: 'plan-dias', status: 'PENDING' });

  const res = await aplicarEjecucionesOT(tx, {
    tenantId: TENANT, workOrder: { id: 'wo-3', code: 'OT-003' },
    executedAt: new Date('2026-07-01'), odometro: 150000,
    tareas: [{ planId: 'plan-km', status: 'COMPLETED' }, { planId: 'plan-dias', status: 'SKIPPED' }],
  });

  assert.equal(res.aplicadas.length, 1);
  assert.equal(res.omitidas.length, 1);
  assert.equal(tasks.get('t2').status, 'SKIPPED');
  assert.equal(plans.get('plan-dias').totalExecutions, 0);
});

// ── D) Idempotencia ──
test('D — misma sourceKey no duplica ejecución ni avance de plan', async () => {
  const { tx, plans, execs } = makeDb();
  plans.set('plan-km', planKm());
  const fecha = new Date('2026-07-01');

  const r1 = await registrarEjecucionPlan(tx, { tenantId: TENANT, planId: 'plan-km', workOrderId: 'wo-9', executedAt: fecha, odometro: 150000 });
  const r2 = await registrarEjecucionPlan(tx, { tenantId: TENANT, planId: 'plan-km', workOrderId: 'wo-9', executedAt: fecha, odometro: 150000 });

  assert.equal(r1.status, 'APLICADA');
  assert.equal(r2.status, 'DUPLICADA');
  assert.equal(execs.length, 1);
  assert.equal(plans.get('plan-km').totalExecutions, 1);
});

test('D2 — re-cierre de OT: tarea ya COMPLETED no re-ejecuta', async () => {
  const { tx, plans, tasks, execs } = makeDb();
  plans.set('plan-km', planKm());
  tasks.set('t1', { id: 't1', tenantId: TENANT, workOrderId: 'wo-9', planId: 'plan-km', status: 'PENDING' });

  await aplicarEjecucionesOT(tx, { tenantId: TENANT, workOrder: { id: 'wo-9', code: 'OT-009' }, executedAt: new Date('2026-07-01'), odometro: 150000 });
  const res2 = await aplicarEjecucionesOT(tx, { tenantId: TENANT, workOrder: { id: 'wo-9', code: 'OT-009' }, executedAt: new Date('2026-07-01'), odometro: 150000 });

  assert.equal(res2.duplicadas.length, 1);
  assert.equal(res2.aplicadas.length, 0);
  assert.equal(execs.length, 1);
  assert.equal(plans.get('plan-km').totalExecutions, 1);
});

// ── E) Registro histórico desfasado ──
test('E — ejecución histórica se registra pero no desplaza la referencia válida', async () => {
  const { tx, plans, execs } = makeDb();
  plans.set('plan-km', planKm({
    lastExecutionDate: new Date('2026-07-10'), lastOdometerExecution: 160000, totalExecutions: 1,
    nextExecutionDate: null,
  }));

  const r = await registrarEjecucionPlan(tx, {
    tenantId: TENANT, planId: 'plan-km', sourceKey: 'hist:1',
    executedAt: new Date('2026-06-15'), odometro: 140000,
  });

  assert.equal(r.status, 'APLICADA');
  assert.equal(r.referenciaAplicada, false);
  assert.equal(execs.length, 1); // queda en historial
  assert.equal(plans.get('plan-km').lastOdometerExecution, 160000); // referencia intacta
  assert.equal(plans.get('plan-km').lastExecutionDate.toISOString().slice(0, 10), '2026-06-15'); // última fecha registrada
});

// ── F) Validación: km obligatorio ──
test('F — tarea con intervalo km sin odómetro → PENDIENTE_KM, no confirma', async () => {
  const { tx, plans, execs } = makeDb();
  plans.set('plan-km', planKm());
  const r = await registrarEjecucionPlan(tx, {
    tenantId: TENANT, planId: 'plan-km', executedAt: new Date('2026-07-01'), odometro: null,
  });
  assert.equal(r.status, 'PENDIENTE_KM');
  assert.equal(execs.length, 0);
  assert.equal(plans.get('plan-km').totalExecutions, 0);
});

// ── G) Intervalo dual ──
test('G — plan con km+días: ambas patas se actualizan y vence por el primero', async () => {
  const { tx, plans } = makeDb();
  plans.set('plan-dual', planKm({ id: 'plan-dual', frecuenciaDias: 365 }));

  const r = await registrarEjecucionPlan(tx, {
    tenantId: TENANT, planId: 'plan-dual', executedAt: new Date('2026-07-01'), odometro: 150000,
  });
  assert.equal(r.status, 'APLICADA');
  assert.equal(plans.get('plan-dual').lastOdometerExecution, 150000);
  assert.equal(plans.get('plan-dual').nextExecutionDate.toISOString().slice(0, 10), '2027-07-01');

  // Vence por km primero
  const vKm = evaluarVencimientoPlan(plans.get('plan-dual'), 180000, new Date('2026-10-01'));
  assert.equal(vKm.vencido, true);
  assert.equal(vKm.motivo, 'KM');
  // Vence por fecha si no llega el km
  const vF = evaluarVencimientoPlan(plans.get('plan-dual'), 160000, new Date('2027-08-01'));
  assert.equal(vF.vencido, true);
  assert.equal(vF.motivo, 'FECHA');
});

// ── H) Calendario fijo ──
test('H — intervaloModo CALENDARIO_FIJO: próxima desde la programada, no desde la ejecutada', async () => {
  const { tx, plans } = makeDb();
  plans.set('plan-cal', planDias({
    id: 'plan-cal', frecuenciaDias: 90, intervaloModo: 'CALENDARIO_FIJO',
    nextExecutionDate: new Date('2026-07-01'),
  }));
  // Se ejecuta 10 días tarde → la próxima cuenta desde el 01-07 (programada)
  const r = await registrarEjecucionPlan(tx, {
    tenantId: TENANT, planId: 'plan-cal', executedAt: new Date('2026-07-10'),
  });
  assert.equal(r.status, 'APLICADA');
  assert.equal(plans.get('plan-cal').nextExecutionDate.toISOString().slice(0, 10), '2026-09-29');
});

// ── I) OT correctiva sin tareas ──
test('I — OT correctiva (sin planId ni tareas) no toca planes', async () => {
  const { tx, plans, execs } = makeDb();
  plans.set('plan-km', planKm());
  const res = await aplicarEjecucionesOT(tx, {
    tenantId: TENANT, workOrder: { id: 'wo-c', code: 'OT-C', planId: null },
    executedAt: new Date('2026-07-01'), odometro: 150000,
  });
  assert.equal(res.sinVinculo, true);
  assert.equal(execs.length, 0);
});

// ── J) Sin referencia = pendiente de datos ──
test('J — plan sin ejecución previa no es evaluable ni vencido', async () => {
  const p = planKm(); // sin lastOdometerExecution, sin nextExecutionDate
  const v = evaluarVencimientoPlan(p, 500000, new Date());
  assert.equal(v.evaluable, false);
  assert.equal(v.vencido, false);
  assert.equal(v.kmRestantes, null);
});

// ── K) Texto no reinicia intervalo (solo sugerencia) ──
test('K — OT que matchea por texto pero sin vínculo explícito no cuenta como ejecución', async () => {
  const defAceite = COMPONENTES_DEF.find((d) => d.key === 'aceite_motor')!;
  const ots = [{
    id: 'wo-x', title: 'Cambio de aceite y filtro', description: '', status: 'COMPLETED',
    completedAt: new Date('2026-06-01'), executedAt: null, planId: null,
    tareas: [], vehiculoHistorial: [{ odometro: 120000 }],
  }];
  const planes = [planKm({ id: 'p-aceite', componentKey: 'aceite_motor' })];

  // El texto sugiere, pero no hay vínculo → no es ejecución explícita
  const expl = ultimaEjecucionExplicita('aceite_motor', ots, planes);
  const sug = sugerenciaPorTexto(defAceite.match, ots, planes);
  assert.equal(expl, null);
  assert.ok(sug);
  assert.equal(sug!.origen, 'OT_SUGERIDA');
});

test('K2 — OT vinculada por tarea COMPLETED sí cuenta como ejecución explícita', async () => {
  const ots = [{
    id: 'wo-y', title: 'Service', status: 'COMPLETED',
    completedAt: new Date('2026-06-01'), executedAt: new Date('2026-05-28'), planId: null,
    tareas: [{ planId: 'p-aceite', status: 'COMPLETED' }],
    vehiculoHistorial: [{ odometro: 120000 }],
  }];
  const planes = [planKm({ id: 'p-aceite', componentKey: 'aceite_motor' })];
  const expl = ultimaEjecucionExplicita('aceite_motor', ots, planes);
  assert.ok(expl);
  assert.equal(expl!.km, 120000);
  assert.equal(expl!.origen, 'OT');
});

// ── L) Consistencia: una ejecución alimenta plan + historial + proyección ──
test('L — tras aplicarEjecucionesOT, plan+ejecución+tarea quedan coherentes para proyección', async () => {
  const { tx, plans, tasks, execs } = makeDb();
  plans.set('p-aceite', planKm({ id: 'p-aceite', componentKey: 'aceite_motor' }));
  tasks.set('t1', { id: 't1', tenantId: TENANT, workOrderId: 'wo-L', planId: 'p-aceite', status: 'PENDING' });

  await aplicarEjecucionesOT(tx, {
    tenantId: TENANT, workOrder: { id: 'wo-L', code: 'OT-L', title: 'Cambio de aceite' },
    executedAt: new Date('2026-07-01'), odometro: 150000,
  });

  // La misma OT que la proyección vería (con tareas e historial)
  const otsProyeccion = [{
    id: 'wo-L', title: 'Cambio de aceite', status: 'COMPLETED',
    completedAt: new Date('2026-07-01'), executedAt: new Date('2026-07-01'), planId: null,
    tareas: [{ planId: 'p-aceite', status: tasks.get('t1').status }],
    vehiculoHistorial: [{ odometro: 150000 }],
  }];
  const ultima = ultimaEjecucionExplicita('aceite_motor', otsProyeccion, [...plans.values()]);
  assert.ok(ultima);
  assert.equal(ultima!.km, 150000);
  assert.equal(execs.length, 1);
  assert.equal(execs[0].odometroEjecucion, 150000);
  assert.equal(execs[0].sourceKey, 'ot:wo-L|p-aceite');
});

// ── Extras: patas del plan y evaluarVencimientoPlan ──
test('patas — triggerKm define la pata km; frecuenciaDias o frequencyUnit la pata días', () => {
  assert.equal(pataKmDelPlan(planKm()), 30000);
  assert.equal(pataKmDelPlan(planDias()), null);
  assert.equal(pataDiasDelPlan(planDias()), 180);
  assert.equal(pataDiasDelPlan(planKm({ frecuenciaDias: 365 })), 365);
  assert.equal(pataDiasDelPlan({ frequencyUnit: 'MONTHS', frequencyValue: 6 }), 180);
});

test('vencimiento — kmRestantes/diasRestantes negativos marcan vencido; positivos no', () => {
  const p = planKm({ lastOdometerExecution: 100000, frecuenciaDias: 365, nextExecutionDate: new Date('2026-12-31') });
  const ok = evaluarVencimientoPlan(p, 120000, new Date('2026-07-01'));
  assert.equal(ok.vencido, false);
  assert.equal(ok.kmRestantes, 10000);
  const vencidoKm = evaluarVencimientoPlan(p, 130000, new Date('2026-07-01'));
  assert.equal(vencidoKm.vencido, true);
  assert.equal(vencidoKm.motivo, 'KM');
  const vencidoAmbos = evaluarVencimientoPlan({ ...p, nextExecutionDate: new Date('2026-01-01') }, 200000, new Date('2026-07-01'));
  assert.equal(vencidoAmbos.motivo, 'KM_Y_FECHA');
});
